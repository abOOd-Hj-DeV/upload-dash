import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, type ApiSession } from '../src/api'
import { Wallet } from '../src/Wallet'

const actor = '11111111-1111-4111-8111-111111111111'
const nextActor = '22222222-2222-4222-8222-222222222222'
function session(id = actor): ApiSession {
  return {
    user: {
      id,
      name: 'Real therapist',
      email: null,
      whatsapp_number: '1234',
      role: 'therapist',
      is_active: true,
      phone_verified_at: '2026-01-01T00:00:00Z',
      timezone: 'UTC',
    },
    access_token: 'test-access-token',
    refresh_token: 'r'.repeat(64),
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
}
function withdrawal(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    therapist_id: actor,
    amount: 25.5,
    status: 'pending',
    payout_details: { method: 'wise', account: 'destination-1234' },
    note: null,
    reviewed_at: null,
    created_at: '2026-09-01T12:00:00Z',
    ...overrides,
  }
}
function summary(overrides: Record<string, unknown> = {}) {
  return {
    currency: 'EUR',
    commission_rate: 0.2,
    earned: 150,
    pending_earnings: 45,
    withdrawn: 50,
    reserved: 0,
    available: 100,
    min_withdrawal: 20,
    completed_paid_sessions: 7,
    earned_package_sessions: 3,
    recent_withdrawals: [],
    ...overrides,
  }
}
function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
type Handler = (init: RequestInit) => Response | Promise<Response>
async function harness(
  options: { wallet?: unknown; onWithdraw?: Handler; getStatus?: number } = {},
) {
  let wallet = Object.hasOwn(options, 'wallet') ? options.wallet : summary()
  const transport = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input)
    if (path.endsWith('/therapists/wallet/withdraw')) {
      if (options.onWithdraw) return options.onWithdraw(init)
      const body = JSON.parse(String(init.body))
      const request = withdrawal({ amount: body.amount, payout_details: body.payout_details })
      wallet = summary({
        available: 100 - body.amount,
        reserved: body.amount,
        recent_withdrawals: [request],
      })
      return json({ message: 'Withdrawal request submitted for review.', withdrawal: request }, 202)
    }
    if (path.endsWith('/therapists/wallet')) return json(wallet, options.getStatus ?? 200)
    return json({
      data: [],
      unread_count: 0,
      pagination: { current_page: 1, last_page: 1, total: 0 },
    })
  })
  const api = new ApiClient('https://wallet.example.test/api/v1', transport)
  await api.establish(session())
  const navigate = vi.fn()
  const view = render(<Wallet api={api} navigate={navigate} />)
  const posts = () =>
    transport.mock.calls
      .filter(
        ([input, init]) =>
          String(input).endsWith('/therapists/wallet/withdraw') && init?.method === 'POST',
      )
      .map(([input, init]) => {
        if (!init) throw new Error('Withdrawal request must include fetch options')
        return [input, init] as const
      })
  return {
    api,
    navigate,
    transport,
    posts,
    view,
    setWallet: (value: unknown) => {
      wallet = value
    },
  }
}
async function ready() {
  await screen.findByText('Lifetime net earnings')
}
function openAndFill(amount = '25.50', method = 'wise', holder = '') {
  fireEvent.click(screen.getByRole('button', { name: 'Request withdrawal' }))
  fireEvent.change(screen.getByLabelText('Select payment method'), { target: { value: method } })
  fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: amount } })
  fireEvent.change(screen.getByLabelText('Payout account'), {
    target: { value: 'destination-1234' },
  })
  if (holder)
    fireEvent.change(screen.getByLabelText('Account holder name (optional)'), {
      target: { value: holder },
    })
}
function review() {
  fireEvent.click(screen.getByRole('button', { name: 'Review request' }))
}
function confirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Confirm request for review' }))
}
function key(init: RequestInit) {
  return new Headers(init.headers).get('Idempotency-Key')
}
beforeEach(() => {
  window.history.replaceState({}, '', '/wallet')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('live wallet summary and history', () => {
  it('uses the exact root response, dynamic currency and separately named server metrics without fictitious charts', async () => {
    const h = await harness({
      wallet: summary({ currency: 'CUSTOM', reserved: 12, available: 88 }),
    })
    await ready()
    expect(h.transport.mock.calls[0][0]).toBe(
      'https://wallet.example.test/api/v1/therapists/wallet',
    )
    expect(screen.getAllByText('150.00 CUSTOM')).toHaveLength(2)
    expect(screen.getAllByText('88.00 CUSTOM')).toHaveLength(3)
    const reserved = screen.getByText('Reserved for withdrawal requests').closest('article')!
    expect(within(reserved).getByText('12.00 CUSTOM')).toBeInTheDocument()
    expect(
      within(screen.getByText('Pending earnings').closest('article')!).getByText('45.00 CUSTOM'),
    ).toBeInTheDocument()
    expect(screen.getByText('Completed paid sessions')).toBeInTheDocument()
    expect(screen.getByText('Earned package sessions')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Monthly earnings:/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/35%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$41.5k|8,400 SP|500 Riyals|3-5 business/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request withdrawal' })).toBeDisabled()
  })
  it.each([
    { data: summary() },
    summary({ earned: '150.00' }),
    summary({ recent_withdrawals: Array.from({ length: 11 }, () => withdrawal()) }),
    null,
  ])(
    'rejects invalid or wrapped wallet shapes without falling back to demo (%j)',
    async (wallet) => {
      await harness({ wallet })
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
      expect(screen.queryByText('Lifetime net earnings')).not.toBeInTheDocument()
      expect(screen.queryByText('$41.5k')).not.toBeInTheDocument()
    },
  )
  it('shows distinct request statuses, nullable/legacy payout details and masked accounts rather than earnings transactions', async () => {
    await harness({
      wallet: summary({
        recent_withdrawals: [
          withdrawal(),
          withdrawal({
            id: '44444444-4444-4444-8444-444444444444',
            status: 'approved',
            payout_details: null,
          }),
          withdrawal({
            id: '55555555-5555-4555-8555-555555555555',
            status: 'rejected',
            payout_details: ['legacy'],
            note: '<b>Review destination</b>',
          }),
          withdrawal({
            id: '66666666-6666-4666-8666-666666666666',
            status: 'paid',
            created_at: null,
          }),
        ],
      }),
    })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Withdrawals' }))
    const panel = within(screen.getByRole('region', { name: 'Wallet details' }))
    expect(panel.getByText('Pending')).toBeInTheDocument()
    expect(panel.getByText('Approved')).toBeInTheDocument()
    expect(panel.getByText('Rejected')).toBeInTheDocument()
    expect(panel.getByText('Paid')).toBeInTheDocument()
    expect(panel.getByText(/Latest 10 at most/)).toBeInTheDocument()
    expect(panel.getAllByText(/•••• 1234/)).toHaveLength(2)
    expect(screen.queryByText(/destination-1234/)).not.toBeInTheDocument()
    expect(panel.getByText('Review note: <b>Review destination</b>')).toBeInTheDocument()
    expect(document.querySelector('.wallet-transaction-copy b')).toBeNull()
    expect(screen.queryByText('Sarah Ali')).not.toBeInTheDocument()
  })
  it.each([401, 403, 429, 503])(
    'shows a sanitized GET %i error, never demo data',
    async (status) => {
      await harness({ wallet: { message: 'secret raw database exception' }, getStatus: status })
      await screen.findByRole('alert')
      expect(screen.queryByText(/secret raw/)).not.toBeInTheDocument()
      expect(screen.queryByText('$41.5k')).not.toBeInTheDocument()
    },
  )
})

describe('manual withdrawal request', () => {
  it('requires confirmation, sends exact documented JSON/headers and reports pending review instead of funds transferred', async () => {
    const h = await harness()
    await ready()
    openAndFill('25.50', 'wise', '  Real Holder  ')
    expect(screen.queryByRole('option', { name: /Shamcash|Al-Haram/ })).not.toBeInTheDocument()
    review()
    expect(h.posts()).toHaveLength(0)
    expect(screen.getByText('Confirm manual-review request')).toBeInTheDocument()
    confirm()
    await screen.findByText(/Withdrawal request pending review/)
    expect(h.posts()).toHaveLength(1)
    const [url, init] = h.posts()[0]
    expect(url).toBe('https://wallet.example.test/api/v1/therapists/wallet/withdraw')
    expect(JSON.parse(String(init.body))).toEqual({
      amount: 25.5,
      payout_details: { method: 'wise', account: 'destination-1234', holder_name: 'Real Holder' },
    })
    expect(typeof JSON.parse(String(init.body)).amount).toBe('number')
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept')).toBe('application/json')
    expect(key(init)).toMatch(/^[\da-f-]{36}$/i)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await ready()
    await waitFor(() => expect(screen.getAllByText('74.50 EUR')).toHaveLength(3))
    expect(
      screen.queryByText(/Successfully transferred|Withdrawal successful/i),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).not.toHaveTextContent('destination-1234')
  })
  it.each(['bank_transfer', 'paypal', 'wise', 'other'])(
    'supports only documented method %s and omits blank holder_name',
    async (method) => {
      const h = await harness()
      await ready()
      openAndFill('20', method)
      review()
      confirm()
      await screen.findByText(/Withdrawal request pending review/)
      expect(JSON.parse(String(h.posts()[0][1].body))).toEqual({
        amount: 20,
        payout_details: { method, account: 'destination-1234' },
      })
    },
  )
  it.each(['19.99', '100.01', '25.501', '1e2', 'NaN', 'Infinity', '-20', '100001'])(
    'rejects precision, minimum or advisory balance violation %s before POST',
    async (amount) => {
      const h = await harness()
      await ready()
      openAndFill(amount)
      review()
      expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(
        'at most two decimal places',
      )
      expect(h.posts()).toHaveLength(0)
    },
  )
  it('uses the deployment minimum instead of 20 and rejects empty destinations', async () => {
    const h = await harness({ wallet: summary({ min_withdrawal: 30 }) })
    await ready()
    openAndFill('25')
    review()
    expect(screen.getByRole('alert')).toHaveTextContent('30.00 EUR')
    fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Payout account'), { target: { value: '   ' } })
    review()
    expect(screen.getByRole('alert')).toHaveTextContent('provide a payout account')
    expect(h.posts()).toHaveLength(0)
  })
  it.each([
    summary({ available: 19 }),
    summary({ recent_withdrawals: [withdrawal()] }),
    summary({ reserved: 1 }),
    summary({ min_withdrawal: 100001, available: 200000 }),
  ])('disables withdrawal under server restrictions (%j)', async (wallet) => {
    const h = await harness({ wallet })
    await ready()
    expect(screen.getByRole('button', { name: 'Request withdrawal' })).toBeDisabled()
    expect(h.posts()).toHaveLength(0)
  })
  it('prevents rapid duplicate submission and modal dismissal during an in-flight POST', async () => {
    let resolve!: (response: Response) => void
    const h = await harness({
      onWithdraw: () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    })
    await ready()
    openAndFill()
    review()
    const button = screen.getByRole('button', { name: 'Confirm request for review' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(h.posts()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Checking request…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(h.navigate).not.toHaveBeenCalled()
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await act(async () => resolve(json({ withdrawal: withdrawal() }, 202)))
    await screen.findByText(/Withdrawal request pending review/)
    expect(h.posts()).toHaveLength(1)
  })
  it('reconciles unknown network outcome, locks editing and retries the immutable body with the same key', async () => {
    let count = 0
    const h = await harness({
      onWithdraw: () => {
        if (++count === 1) throw new Error('raw account secret')
        return json({ withdrawal: withdrawal() }, 202)
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    const retry = await screen.findByRole('button', { name: 'Retry unchanged request' })
    await waitFor(() => expect(retry).toBeEnabled())
    expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Withdrawal amount')).not.toBeInTheDocument()
    expect(screen.queryByText(/raw account secret/)).not.toBeInTheDocument()
    const first = h.posts()[0][1]
    const firstPostIndex = h.transport.mock.calls.findIndex(([, init]) => init?.method === 'POST')
    expect(
      h.transport.mock.calls
        .slice(firstPostIndex + 1)
        .some(([url]) => String(url).endsWith('/therapists/wallet')),
    ).toBe(true)
    fireEvent.click(retry)
    await screen.findByText(/Withdrawal request pending review/)
    const second = h.posts()[1][1]
    expect(key(second)).toBe(key(first))
    expect(second.body).toBe(first.body)
    expect(h.posts()).toHaveLength(2)
  })
  it('reconciles a committed but lost response from fresh history without another POST', async () => {
    const h: Awaited<ReturnType<typeof harness>> = await harness({
      onWithdraw: () => {
        h.setWallet(
          summary({ reserved: 25.5, available: 74.5, recent_withdrawals: [withdrawal()] }),
        )
        throw new Error('network disconnect after commit')
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText(/Withdrawal request pending review/)
    expect(h.posts()).toHaveLength(1)
    await ready()
    expect(screen.getByRole('button', { name: 'Request withdrawal' })).toBeDisabled()
  })
  it('retains an unresolved intent across route unmounts and replays only the original key', async () => {
    let count = 0
    const h = await harness({
      onWithdraw: () => {
        if (++count === 1) throw new Error('Synthetic lost response')
        return json({ withdrawal: withdrawal() }, 202)
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeEnabled(),
    )
    const original = h.posts()[0][1]
    h.view.unmount()
    render(<Wallet api={h.api} navigate={h.navigate} />)
    await ready()
    expect(screen.queryByLabelText('Withdrawal amount')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile recent requests' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry unchanged request' }))
    await screen.findByText(/Withdrawal request pending review/)
    expect(key(h.posts()[1][1])).toBe(key(original))
    expect(h.posts()[1][1].body).toBe(original.body)
  })
  it('clears unresolved payout drafts on same-account reauthentication, including batched identity changes', async () => {
    const h = await harness({
      onWithdraw: () => {
        throw new Error('Synthetic lost response')
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText(/Outcome unknown/)
    await act(() => h.api.establish(session()))
    await ready()
    expect(screen.queryByText(/Outcome unknown/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openAndFill()
    expect(screen.getByLabelText('Account holder name (optional)')).toHaveValue('')
  })
  it('keeps an unmatched in-flight conflict locked and never invents a fresh key', async () => {
    const h = await harness({
      onWithdraw: () => json({ message: 'sensitive conflict details' }, 409),
    })
    await ready()
    openAndFill()
    review()
    confirm()
    const retry = await screen.findByRole('button', { name: 'Retry unchanged request' })
    await waitFor(() => expect(retry).toBeEnabled())
    fireEvent.click(retry)
    await waitFor(() => expect(h.posts()).toHaveLength(2))
    await waitFor(() => expect(retry).toBeEnabled())
    expect(key(h.posts()[1][1])).toBe(key(h.posts()[0][1]))
    expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
    expect(screen.queryByText('sensitive conflict details')).not.toBeInTheDocument()
  })
  it('fails closed when reconciliation is unavailable after a server failure', async () => {
    const h: Awaited<ReturnType<typeof harness>> = await harness({
      onWithdraw: () => {
        h.setWallet({ invalid: true })
        return json({ message: 'database password' }, 500)
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText(/Unable to reconcile recent requests/)
    expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
    expect(screen.queryByText('database password')).not.toBeInTheDocument()
    expect(h.posts()).toHaveLength(1)
  })
  it('permits corrected intent only after a definitive sanitized 422 rejection, using a new key', async () => {
    let count = 0
    const h = await harness({
      onWithdraw: (init) =>
        ++count === 1
          ? json(
              {
                message: 'private exception',
                errors: { 'payout_details.account': ['destination-1234 secret'] },
              },
              422,
            )
          : json({ withdrawal: withdrawal({ amount: JSON.parse(String(init.body)).amount }) }, 202),
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByLabelText('Withdrawal amount')
    expect(screen.getByRole('alert')).toHaveTextContent('Please check the submitted information.')
    expect(screen.queryByText(/private exception|destination-1234 secret/)).not.toBeInTheDocument()
    await ready()
    fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '30.00' } })
    review()
    confirm()
    await screen.findByText(/Withdrawal request pending review/)
    expect(key(h.posts()[1][1])).not.toBe(key(h.posts()[0][1]))
    expect(JSON.parse(String(h.posts()[1][1].body)).amount).toBe(30)
  })
  it('honors Retry-After on throttling without a fake success or immediate re-submit', async () => {
    const h = await harness({
      onWithdraw: () => json({ message: 'raw rate-limit details' }, 429, { 'Retry-After': '2' }),
    })
    await ready()
    vi.useFakeTimers()
    openAndFill()
    review()
    await act(async () => confirm())
    expect(screen.getByRole('alert')).toHaveTextContent('Too many requests')
    expect(screen.getByRole('button', { name: 'Confirm request for review' })).toBeDisabled()
    expect(h.posts()).toHaveLength(1)
    await act(async () => vi.advanceTimersByTimeAsync(2100))
    expect(screen.getByRole('button', { name: 'Confirm request for review' })).toBeEnabled()
    await act(async () => confirm())
    expect(h.posts()).toHaveLength(2)
    expect(key(h.posts()[1][1])).toBe(key(h.posts()[0][1]))
    expect(screen.queryByText(/Withdrawal request pending review/)).not.toBeInTheDocument()
  })
  it('does not retry an ambiguous key after the 24-hour window or permit new intent', async () => {
    const h = await harness({
      onWithdraw: () => {
        throw new Error('unknown')
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    const retry = await screen.findByRole('button', { name: 'Retry unchanged request' })
    await waitFor(() => expect(retry).toBeEnabled())
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 86400001)
    // Trigger a render without using a new intent.
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Resolve withdrawal request' })[0])
    expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
    expect(h.posts()).toHaveLength(1)
  })
  it('does not treat approved replay as paid and refetches the actual server status', async () => {
    const h: Awaited<ReturnType<typeof harness>> = await harness({
      onWithdraw: () => {
        h.setWallet(
          summary({
            withdrawn: 75.5,
            available: 74.5,
            recent_withdrawals: [withdrawal({ status: 'approved' })],
          }),
        )
        return json({ withdrawal: withdrawal() }, 202, { 'Idempotency-Replayed': 'true' })
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText(/Withdrawal request pending review/)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Withdrawals' }))
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.queryByText('Paid')).not.toBeInTheDocument()
  })
  it('clears sensitive drafts and aborts stale mutation results on logout and actor change', async () => {
    let resolve!: (response: Response) => void
    const h = await harness({
      onWithdraw: () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    })
    await ready()
    openAndFill()
    review()
    confirm()
    const signal = h.posts()[0][1].signal!
    act(() => h.api.clear())
    expect(signal.aborted).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Lifetime net earnings')).not.toBeInTheDocument()
    await act(async () => {
      h.setWallet(summary({ currency: 'GBP' }))
      await h.api.establish(session(nextActor))
      resolve(json({ withdrawal: withdrawal() }, 202))
    })
    await ready()
    expect(screen.queryByText(/Withdrawal request pending review/)).not.toBeInTheDocument()
    openAndFill('25')
    expect(screen.getByLabelText('Account holder name (optional)')).toHaveValue('')
  })
  it('shows permission and authentication failures without moving money', async () => {
    const h = await harness({
      onWithdraw: () => json({ message: 'private permission information' }, 403),
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText('This action is not permitted for your account.')
    expect(screen.queryByText('private permission information')).not.toBeInTheDocument()
    expect(screen.queryByText(/Withdrawal request pending review/)).not.toBeInTheDocument()
    expect(h.posts()).toHaveLength(1)
  })
  it('never treats a stale frontend balance as permission to withdraw after server rejection', async () => {
    const h: Awaited<ReturnType<typeof harness>> = await harness({
      onWithdraw: () => {
        h.setWallet(summary({ available: 19, withdrawn: 131 }))
        return json(
          {
            message: 'Insufficient balance. Available: 19.',
            errors: { amount: ['Internal balance details'] },
          },
          422,
        )
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText('Please check the submitted information.')
    await ready()
    expect(screen.getByRole('button', { name: 'Review request' })).toBeDisabled()
    expect(h.posts()).toHaveLength(1)
    expect(screen.queryByText(/Withdrawal request pending review/)).not.toBeInTheDocument()
    expect(screen.queryByText('Internal balance details')).not.toBeInTheDocument()
  })
  it('clears the page rather than reporting success after a POST 401', async () => {
    const h = await harness({
      onWithdraw: () => json({ message: 'Raw unauthorized exception' }, 401),
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText('Your session has ended. Please sign in again.')
    expect(h.api.getUser()).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(/Withdrawal request pending review/)).not.toBeInTheDocument()
    expect(screen.queryByText('Raw unauthorized exception')).not.toBeInTheDocument()
  })
  it('keeps a malformed successful response financially uncertain and requires reconciliation', async () => {
    const h = await harness({
      onWithdraw: () => json({ message: 'Funds transferred!', data: withdrawal() }, 202),
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByRole('button', { name: 'Retry unchanged request' })
    expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
    expect(screen.queryByText('Funds transferred!')).not.toBeInTheDocument()
    expect(screen.queryByText(/Withdrawal request pending review/)).not.toBeInTheDocument()
    expect(h.posts()).toHaveLength(1)
  })
  it('defers reconciliation and replay until Retry-After elapses on a 503', async () => {
    const h = await harness({
      onWithdraw: () =>
        json({ message: 'Service temporarily unavailable.' }, 503, { 'Retry-After': '5' }),
    })
    await ready()
    vi.useFakeTimers()
    openAndFill()
    review()
    await act(async () => confirm())
    const walletReads = () =>
      h.transport.mock.calls.filter(([url]) => String(url).endsWith('/therapists/wallet')).length
    expect(walletReads()).toBe(1)
    expect(screen.getByRole('button', { name: 'Reconcile recent requests' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeDisabled()
    await act(async () => vi.advanceTimersByTimeAsync(5100))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Reconcile recent requests' })),
    )
    expect(walletReads()).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeEnabled()
    expect(h.posts()).toHaveLength(1)
  })
  it('blocks ambiguous replay if the configured wallet currency changes', async () => {
    const h: Awaited<ReturnType<typeof harness>> = await harness({
      onWithdraw: () => {
        h.setWallet(summary({ currency: 'GBP' }))
        throw new Error('unknown outcome')
      },
    })
    await ready()
    openAndFill()
    review()
    confirm()
    await screen.findByText(
      'Wallet currency has changed. Do not retry; finance support must reconcile the previous request.',
    )
    await ready()
    expect(screen.getByRole('button', { name: 'Retry unchanged request' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
    expect(h.posts()).toHaveLength(1)
  })
  it('retains the original explicit no-api demo preview flow', () => {
    window.history.replaceState({}, '', '/wallet?state=shamcash')
    render(<Wallet navigate={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Shamcash Code'), { target: { value: 'demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo preview only')
    expect(screen.getByRole('status')).toHaveTextContent(
      'No withdrawal request was sent and no money was moved',
    )
  })
})
