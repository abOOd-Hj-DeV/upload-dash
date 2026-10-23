import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ApiClient, type ApiSession } from '../src/api'
import { Profile } from '../src/Profile'

// Keep these tests focused on this domain while verifying Workspace receives api.
vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, api }: { children: ReactNode; api?: ApiClient }) => (
    <main data-testid="workspace" data-live={!!api}>
      {children}
    </main>
  ),
}))
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const periodId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const user = {
  id: userId,
  name: 'Real Account Name',
  email: 'real@example.test',
  whatsapp_number: '+123456789',
  role: 'therapist',
  is_active: true,
  phone_verified_at: '2026-01-01T00:00:00Z',
  timezone: 'Asia/Amman',
}
const therapist = {
  id: userId,
  full_name: 'Real Professional Name',
  specialty: 'Counselling',
  country: 'Jordan',
  languages: ['ar', 'en'],
  bio: 'Actual biography',
  rating: 4.2,
  approval_status: 'approved',
  has_license: true,
  availability: { monday: ['09:00-12:00', '13:00-17:00'], tuesday: ['10:00-11:00'] },
}
const dashboard = {
  therapist,
  clients_count: 7,
  stats: { pending: 2, confirmed: 3, completed: 12, today: 1 },
  timezone: 'Asia/Amman',
}
function session(actor = user): ApiSession {
  return {
    user: actor,
    access_token: 'test-memory-only-access',
    refresh_token: 'x'.repeat(64),
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
type Call = {
  path: string
  method: string
  body: Record<string, unknown> | undefined
  headers: Headers
  signal: AbortSignal | null | undefined
}
type Handler = (call: Call) => Response | Promise<Response> | undefined
async function client(handler?: Handler) {
  const calls: Call[] = []
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      path: String(input).replace('https://api.example.test/api/v1', ''),
      method: init?.method || 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      headers: new Headers(init?.headers),
      signal: init?.signal,
    }
    calls.push(call)
    const result = handler?.(call)
    if (result !== undefined) return await result
    if (call.path === '/auth/user') return json({ user, roles: ['therapist'] })
    if (call.path === '/therapists/me/dashboard') return json(dashboard)
    if (call.path === '/therapists/me/blocked-periods' && call.method === 'GET')
      return json({ data: [] })
    throw new Error('Unexpected test request')
  })
  const api = new ApiClient('https://api.example.test/api/v1', transport)
  await api.establish(session())
  return { api, calls }
}
function modal() {
  return within(screen.getByRole('dialog'))
}
function change(label: string, value: string) {
  fireEvent.change(modal().getByLabelText(label), { target: { value } })
}
async function loaded() {
  await screen.findByRole('heading', { name: 'Real Professional Name' })
}
beforeEach(() => {
  window.history.replaceState({}, '', '/profile')
  vi.restoreAllMocks()
})

describe('live Profile API integration', () => {
  it('loads account identity before dashboard, reports permission errors and never substitutes demo data', async () => {
    const identity = deferred<Response>()
    const { api, calls } = await client((call) =>
      call.path === '/auth/user'
        ? identity.promise
        : call.path === '/therapists/me/dashboard'
          ? json({ message: 'private backend exception' }, 403)
          : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    expect(screen.getByText('Loading profile…')).toBeInTheDocument()
    expect(calls.map((call) => call.path)).toEqual(['/auth/user'])
    await act(async () => identity.resolve(json({ user, roles: ['therapist'] })))
    expect(await screen.findByRole('alert')).toHaveTextContent('not permitted')
    expect(screen.getByText(/API has no unrestricted self-profile read/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Profile' })).toBeDisabled()
    expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
    expect(screen.queryByText('Age 28 · Male')).not.toBeInTheDocument()
    expect(screen.queryByText('private backend exception')).not.toBeInTheDocument()
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-live', 'true')
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('sends only supported settings keys, permits clearing bio and uses the returned therapist', async () => {
    const { api, calls } = await client((call) =>
      call.method === 'PUT'
        ? json({
            data: {
              ...therapist,
              specialty: 'Server normalized specialty',
              country: 'Germany',
              languages: ['de'],
              bio: null,
            },
          })
        : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }))
    expect(modal().getByLabelText('Professional name')).toBeDisabled()
    expect(modal().getByLabelText('Email')).toBeDisabled()
    expect(modal().getByLabelText('Mobile Number')).toBeDisabled()
    change('Specialty', 'Trauma therapy')
    change('Country', 'Germany')
    change('Languages (comma-separated)', 'de')
    change('Bio (optional)', '')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    await screen.findByText('Profile settings updated on the server.')
    expect(calls.find((call) => call.method === 'PUT')).toMatchObject({
      path: '/therapists/me/settings',
      body: { specialty: 'Trauma therapy', country: 'Germany', languages: ['de'], bio: null },
    })
    expect(screen.getAllByText('Server normalized specialty').length).toBeGreaterThan(0)
    expect(screen.getByText('No bio provided.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('preserves drafts on sanitized save errors and synchronously guards duplicate submissions', async () => {
    const response = deferred<Response>()
    const { api, calls } = await client((call) =>
      call.method === 'PUT' ? response.promise : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }))
    change('Bio (optional)', 'Unsaved private draft')
    const form = modal().getByLabelText('Bio (optional)').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1)
    expect(modal().getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await act(async () =>
      response.resolve(
        json(
          { message: 'server secret', errors: { bio: ['private draft echoed by backend'] } },
          422,
        ),
      ),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Bio: Please check this field.')
    expect(modal().getByLabelText('Bio (optional)')).toHaveValue('Unsaved private draft')
    expect(screen.queryByText('server secret')).not.toBeInTheDocument()
    expect(screen.queryByText('private draft echoed by backend')).not.toBeInTheDocument()
    expect(screen.queryByText('Profile settings updated on the server.')).not.toBeInTheDocument()
  })

  it('replaces the full availability map, preserves every server window and uses server timezone', async () => {
    const { api, calls } = await client((call) =>
      call.method === 'PUT'
        ? json({ data: { ...therapist, availability: call.body?.availability } })
        : undefined,
    )
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /Manage Working Hours/ }))
    expect(modal().getByText(/All times are wall-clock hours in Asia\/Amman/)).toBeInTheDocument()
    expect(modal().getByLabelText('monday start 2')).toHaveValue('13:00')
    change('monday end 1', '11:30')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    await screen.findByText(/Working hours updated on the server/)
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      availability: {
        monday: ['09:00-11:30', '13:00-17:00'],
        tuesday: ['10:00-11:00'],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    })
  })

  it('rejects overlapping and incomplete availability instead of silently removing windows', async () => {
    const { api, calls } = await client()
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /Manage Working Hours/ }))
    change('monday end 1', '14:00')
    fireEvent.submit(modal().getByLabelText('monday end 1').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('non-overlapping')
    change('monday end 1', '12:00')
    fireEvent.click(modal().getByRole('button', { name: 'Add wednesday window' }))
    fireEvent.submit(modal().getByLabelText('wednesday start 1').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('complete')
    expect(calls.filter((call) => call.method !== 'GET')).toHaveLength(0)
  })

  it('uses correct password keys, keeps inputs on 422, clears only after success and keeps this session', async () => {
    let attempts = 0
    const { api, calls } = await client((call) =>
      call.path === '/auth/user/password'
        ? ++attempts === 1
          ? json({ errors: { current_password: ['incorrect secret supplied'] } }, 422)
          : json({ message: 'Password changed.' })
        : undefined,
    )
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
    change('Current Password', 'old-test-password')
    change('New Password', 'new-test-password')
    change('Confirm New Password', 'new-test-password')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Current password: Please check this field.',
    )
    expect(modal().getByLabelText('Current Password')).toHaveValue('old-test-password')
    expect(calls.find((call) => call.path === '/auth/user/password')).toMatchObject({
      method: 'PUT',
      body: {
        current_password: 'old-test-password',
        password: 'new-test-password',
        password_confirmation: 'new-test-password',
      },
    })
    expect(screen.queryByText('incorrect secret supplied')).not.toBeInTheDocument()
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    await screen.findByText(/Password changed. Other devices have been signed out/)
    expect(api.getUser()?.id).toBe(userId)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([200, 503])(
    'revokes logout and clears local credentials even on status %s, while navigating',
    async (status) => {
      const logoutResponse = deferred<Response>()
      const { api, calls } = await client((call) =>
        call.path === '/auth/logout' ? logoutResponse.promise : undefined,
      )
      const navigate = vi.fn()
      render(<Profile page="settings" api={api} navigate={navigate} />)
      await loaded()
      fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))
      expect(modal().getByText(/remote revocation is unknown/)).toBeInTheDocument()
      const button = modal().getByRole('button', { name: 'Log out' })
      fireEvent.click(button)
      fireEvent.click(button)
      await waitFor(() => expect(api.getUser()).toBeNull())
      expect(
        screen.queryByRole('heading', { name: 'Real Professional Name' }),
      ).not.toBeInTheDocument()
      await act(async () => logoutResponse.resolve(json({ message: 'not rendered' }, status)))
      expect(navigate).toHaveBeenCalledWith(
        status === 200 ? '/login' : '/login?logout=revocation-unknown',
      )
      expect(calls.filter((call) => call.path === '/auth/logout')).toHaveLength(1)
      expect(calls.find((call) => call.path === '/auth/logout')).toMatchObject({
        method: 'POST',
        body: undefined,
      })
    },
  )

  it('uses UUID periods, retains idempotency key on uncertain retries and waits for confirmed creation/deletion', async () => {
    const period = {
      id: periodId,
      start_date: '2090-01-01',
      end_date: '2090-01-02',
      reason: 'Travel',
    }
    let rows: (typeof period)[] = []
    let writes = 0
    let deletes = 0
    const { api, calls } = await client((call) => {
      if (call.path === '/therapists/me/blocked-periods') {
        if (call.method === 'GET') return json({ data: rows })
        if (++writes === 1) throw new Error('ambiguous transport failure')
        rows = [period]
        return json({ data: period }, 201)
      }
      if (call.method === 'DELETE') {
        if (++deletes === 1) return json({ message: 'cannot remove' }, 403)
        rows = []
        return json({ message: 'removed' })
      }
    })
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /Vacations and Breaks/ }))
    await screen.findByText('No blocked periods.')
    change('Start date', period.start_date)
    change('End date (optional)', period.end_date)
    change('Reason (optional)', 'Travel')
    fireEvent.click(modal().getByRole('button', { name: 'Add blocked period' }))
    await screen.findByText(/previous result is uncertain/)
    expect(modal().getByLabelText('Start date')).toBeDisabled()
    expect(screen.queryByText('Blocked period added on the server.')).not.toBeInTheDocument()
    fireEvent.click(modal().getByRole('button', { name: 'Retry identical submission' }))
    await screen.findByText('Blocked period added on the server.')
    const posts = calls.filter((call) => call.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0].headers.get('Idempotency-Key')).toBe(posts[1].headers.get('Idempotency-Key'))
    expect(posts[0].body).toEqual({
      start_date: period.start_date,
      end_date: period.end_date,
      reason: 'Travel',
    })
    const remove = await screen.findByRole('button', {
      name: `Remove blocked period ${period.start_date}`,
    })
    fireEvent.click(remove)
    await screen.findByRole('alert')
    expect(screen.getByText('Travel')).toBeInTheDocument()
    fireEvent.click(remove)
    await screen.findByText('Blocked period removed on the server.')
    expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual([
      `/therapists/me/blocked-periods/${periodId}`,
      `/therapists/me/blocked-periods/${periodId}`,
    ])
    await screen.findByText('No blocked periods.')
  })

  it('loads paginated public FAQs as escaped text, and makes unsupported features unavailable without writes', async () => {
    const { api, calls } = await client((call) =>
      call.path.startsWith('/faqs')
        ? json({
            data: [
              {
                id: periodId,
                question: '<b>Published question</b>',
                answer: '<script>not executed</script>',
              },
            ],
            pagination: { current_page: call.path.endsWith('2') ? 2 : 1, last_page: 2 },
          })
        : undefined,
    )
    const { rerender } = render(<Profile page="help" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /FAQs/ }))
    await screen.findByText('<b>Published question</b>')
    expect(screen.getByText('<script>not executed</script>').querySelector('script')).toBeNull()
    expect(calls.find((call) => call.path.startsWith('/faqs'))?.headers.has('Authorization')).toBe(
      false,
    )
    fireEvent.click(modal().getByRole('button', { name: 'Next FAQs' }))
    await screen.findByText('Page 2 of 2')
    fireEvent.click(modal().getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(screen.getByRole('button', { name: /Contact support/ }))
    expect(modal().getByRole('button', { name: 'Send Message (unavailable)' })).toBeDisabled()
    fireEvent.click(modal().getByRole('button', { name: 'Close dialog' }))
    rerender(<Profile page="settings" api={api} navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Notification Settings/ }))
    expect(modal().getByRole('button', { name: 'Save Preferences (unavailable)' })).toBeDisabled()
    expect(
      modal()
        .getAllByRole('switch')
        .every((element) => element.matches(':disabled')),
    ).toBe(true)
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('aborts and discards an in-flight private draft/save on actor change', async () => {
    const save = deferred<Response>()
    const { api, calls } = await client((call) =>
      call.method === 'PUT' ? save.promise : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }))
    change('Bio (optional)', 'Private old actor draft')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    const write = calls.find((call) => call.method === 'PUT')!
    await act(async () => {
      await api.establish(session({ ...user, id: periodId, name: 'New Actor' }))
    })
    expect(write.signal?.aborted).toBe(true)
    await act(async () =>
      save.resolve(json({ data: { ...therapist, bio: 'Private old actor draft' } })),
    )
    expect(screen.queryByText('Private old actor draft')).not.toBeInTheDocument()
    expect(screen.queryByText('Profile settings updated on the server.')).not.toBeInTheDocument()
  })

  it('refuses dashboard reads when auth/user no longer describes an active verified therapist', async () => {
    const { api, calls } = await client((call) =>
      call.path === '/auth/user'
        ? json({ user: { ...user, is_active: false }, roles: ['therapist'] })
        : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('active, phone-verified therapist')
    expect(calls.map((call) => call.path)).toEqual(['/auth/user'])
  })
})
