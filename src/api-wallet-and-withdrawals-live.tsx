import { useEffect, useRef, useState, type FormEvent, type ComponentProps } from 'react'
import { ApiClient, ApiError, apiErrorMessage, apiId } from './api'
import { useApiResource, useApiUser } from './api-hooks'
import { Workspace } from './Workspace'
import { RemainingIcon } from './RemainingUI'
import { Modal } from './ui'

const walletPath = '/therapists/wallet'
const payoutMethods = {
  bank_transfer: 'Bank transfer',
  paypal: 'PayPal',
  wise: 'Wise',
  other: 'Other (manual review)',
} as const
type PayoutMethod = keyof typeof payoutMethods
type Withdrawal = {
  id: string
  therapist_id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  payout_details: Record<string, unknown> | unknown[] | null
  note: string | null
  reviewed_at: string | null
  created_at: string | null
}
type WalletSummary = {
  currency: string
  commission_rate: number
  earned: number
  pending_earnings: number
  withdrawn: number
  reserved: number
  available: number
  min_withdrawal: number
  completed_paid_sessions: number
  earned_package_sessions: number
  recent_withdrawals: Withdrawal[]
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(502)
  return value as Record<string, unknown>
}
function moneyValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ApiError(502)
  return value
}
function nullableText(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value
  throw new ApiError(502)
}
function withdrawalValue(value: unknown): Withdrawal {
  const item = record(value)
  if (typeof item.id !== 'string' || typeof item.therapist_id !== 'string') throw new ApiError(502)
  try {
    apiId(item.id)
    apiId(item.therapist_id)
  } catch {
    throw new ApiError(502)
  }
  if (!['pending', 'approved', 'rejected', 'paid'].includes(String(item.status)))
    throw new ApiError(502)
  if (item.payout_details !== null && typeof item.payout_details !== 'object')
    throw new ApiError(502)
  const created = nullableText(item.created_at)
  const reviewed = nullableText(item.reviewed_at)
  if (
    (created && !Number.isFinite(Date.parse(created))) ||
    (reviewed && !Number.isFinite(Date.parse(reviewed)))
  )
    throw new ApiError(502)
  return {
    id: item.id,
    therapist_id: item.therapist_id,
    amount: moneyValue(item.amount),
    status: item.status as Withdrawal['status'],
    payout_details: item.payout_details as Withdrawal['payout_details'],
    note: nullableText(item.note),
    reviewed_at: reviewed,
    created_at: created,
  }
}
function walletValue(value: unknown): WalletSummary {
  const item = record(value)
  if (
    typeof item.currency !== 'string' ||
    !item.currency.trim() ||
    item.currency.length > 32 ||
    !Array.isArray(item.recent_withdrawals) ||
    item.recent_withdrawals.length > 10
  )
    throw new ApiError(502)
  const commission = moneyValue(item.commission_rate)
  if (commission > 1) throw new ApiError(502)
  const completed = moneyValue(item.completed_paid_sessions)
  const packages = moneyValue(item.earned_package_sessions)
  if (!Number.isInteger(completed) || !Number.isInteger(packages)) throw new ApiError(502)
  return {
    currency: item.currency,
    commission_rate: commission,
    earned: moneyValue(item.earned),
    pending_earnings: moneyValue(item.pending_earnings),
    withdrawn: moneyValue(item.withdrawn),
    reserved: moneyValue(item.reserved),
    available: moneyValue(item.available),
    min_withdrawal: moneyValue(item.min_withdrawal),
    completed_paid_sessions: completed,
    earned_package_sessions: packages,
    recent_withdrawals: item.recent_withdrawals.map(withdrawalValue),
  }
}
function money(amount: number, currency: string): string {
  // Currency is deployment-configured, not necessarily an ISO code.
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}
function maskAccount(value: unknown): string {
  return typeof value === 'string' && value.length > 4 ? `•••• ${value.slice(-4)}` : '••••'
}
function methodLabel(value: unknown): string {
  return typeof value === 'string' && Object.hasOwn(payoutMethods, value)
    ? payoutMethods[value as PayoutMethod]
    : 'Legacy payout details'
}

function payoutField(item: Withdrawal, field: string): unknown {
  return item.payout_details && !Array.isArray(item.payout_details)
    ? item.payout_details[field]
    : undefined
}
function isRestricted(wallet: WalletSummary | null): boolean {
  return (
    !wallet ||
    Math.max(1, wallet.min_withdrawal) > 100000 ||
    wallet.available < Math.max(1, wallet.min_withdrawal) ||
    wallet.reserved > 0 ||
    wallet.recent_withdrawals.some((item) => item.status === 'pending')
  )
}

type WithdrawalBody = {
  amount: number
  payout_details: { method: PayoutMethod; account: string; holder_name?: string }
}
type Intent = {
  body: WithdrawalBody
  key: string
  beforeIds: string[]
  created: number
  currency: string
}
type PendingWithdrawal = { actor: string | null; intent: Intent | null; retryAt: number }
const pendingWithdrawals = new WeakMap<ApiClient, PendingWithdrawal>()
function withdrawalMemory(api: ApiClient): PendingWithdrawal {
  let memory = pendingWithdrawals.get(api)
  if (!memory) {
    const entry: PendingWithdrawal = { actor: api.getUser()?.id ?? null, intent: null, retryAt: 0 }
    pendingWithdrawals.set(api, entry)
    api.subscribe(() => {
      const actor = api.getUser()?.id ?? null
      if (entry.actor !== actor) {
        entry.actor = actor
        entry.intent = null
        entry.retryAt = 0
      }
    })
    memory = entry
  }
  return memory
}
type LiveProps = { api: ApiClient; navigate: (path: string) => void }
// Keying the data-bearing child removes wallet data and drafts on logout / actor changes.
export function ApiWalletAndWithdrawalsLive({ api, navigate }: LiveProps) {
  const user = useApiUser(api)
  return user ? (
    <LiveWallet key={api.getSessionKey()} api={api} navigate={navigate} />
  ) : (
    <Workspace api={api} title="Dashboard" mobileTitle="Wallet" active="Wallet" navigate={navigate}>
      <p className="remaining-error" role="alert">
        Your session has ended. Please sign in again.
      </p>
    </Workspace>
  )
}
function LiveWallet({ api, navigate }: LiveProps) {
  const resource = useApiResource<unknown>(api, walletPath)
  const [tab, setTab] = useState<'overview' | 'earnings' | 'withdrawals'>('overview')
  let wallet: WalletSummary | null = null
  let error: unknown =
    resource.error || (!resource.loading && resource.data === null ? new ApiError(502) : null)
  if (resource.data !== null) {
    try {
      wallet = walletValue(resource.data)
      if (wallet.recent_withdrawals.some((item) => item.therapist_id !== api.getUser()?.id))
        throw new ApiError(502)
    } catch (invalid) {
      wallet = null
      error = invalid
    }
  }
  const restricted = isRestricted(wallet)
  const flow = useWithdrawalFlow(api, wallet, resource.reload)
  const metrics: {
    icon: ComponentProps<typeof RemainingIcon>['name']
    title: string
    value: string
  }[] = wallet
    ? [
        {
          icon: 'withdrawn',
          title: 'Withdrawn (approved and paid)',
          value: money(wallet.withdrawn, wallet.currency),
        },
        {
          icon: 'available',
          title: 'Available now',
          value: money(wallet.available, wallet.currency),
        },
        {
          icon: 'pending',
          title: 'Pending earnings',
          value: money(wallet.pending_earnings, wallet.currency),
        },
        {
          icon: 'pending',
          title: 'Reserved for withdrawal requests',
          value: money(wallet.reserved, wallet.currency),
        },
        {
          icon: 'sessions',
          title: 'Completed paid sessions',
          value: wallet.completed_paid_sessions.toLocaleString(),
        },
        {
          icon: 'sessions',
          title: 'Earned package sessions',
          value: wallet.earned_package_sessions.toLocaleString(),
        },
      ]
    : []
  return (
    <Workspace
      api={api}
      title="Dashboard"
      mobileTitle="Wallet"
      active="Wallet"
      navigate={(path) => {
        if (flow.canLeave()) navigate(path)
      }}
    >
      <div className={`wallet-layout wallet-live wallet-${tab}`}>
        <p className="wallet-phone-heading">Therapist Overview</p>
        {resource.loading && <p role="status">Loading wallet…</p>}
        {!!error && (
          <p className="remaining-error" role="alert">
            {apiErrorMessage(error)} <button onClick={resource.reload}>Refresh wallet</button>
          </p>
        )}
        {wallet && (
          <>
            <div className="wallet-metrics">
              <article className="wallet-total textured">
                <div>
                  <header>
                    <span>Overview</span>
                    <h2>Lifetime net earnings</h2>
                  </header>
                  <div className="wallet-total-numbers">
                    <div>
                      <span>Net earned</span>
                      <strong>{money(wallet.earned, wallet.currency)}</strong>
                    </div>
                    <div>
                      <span>Minimum withdrawal</span>
                      <strong>{money(wallet.min_withdrawal, wallet.currency)}</strong>
                    </div>
                    <div>
                      <span>Net available</span>
                      <strong>{money(wallet.available, wallet.currency)}</strong>
                    </div>
                  </div>
                </div>
              </article>
              <article className="wallet-phone-total">
                <button onClick={() => setTab('withdrawals')}>
                  <span>Net Available Balance</span>
                  <strong className="remaining-badge">
                    {money(wallet.available, wallet.currency)}
                  </strong>
                </button>
                <p>
                  <span>Net earned</span>
                  <span>{money(wallet.earned, wallet.currency)}</span>
                </p>
                <p>
                  <span>Minimum withdrawal</span>
                  <span>{money(wallet.min_withdrawal, wallet.currency)}</span>
                </p>
              </article>
              <div className="wallet-stat-grid">
                {metrics.map((metric) => (
                  <article key={metric.title}>
                    <p>
                      <RemainingIcon name={metric.icon} />
                      <span>{metric.title}</span>
                    </p>
                    <strong>{metric.value}</strong>
                  </article>
                ))}
              </div>
            </div>
            <section className="wallet-panel" aria-label="Wallet details">
              <nav className="wallet-tabs" aria-label="Wallet sections">
                {(['overview', 'earnings', 'withdrawals'] as const).map((value) => (
                  <button
                    key={value}
                    className={tab === value ? 'selected' : ''}
                    aria-current={tab === value ? 'page' : undefined}
                    onClick={() => setTab(value)}
                  >
                    <RemainingIcon name={`${value}${tab === value ? 'Active' : 'Idle'}`} />
                    {value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
                <button
                  className="remaining-primary wallet-withdraw-button"
                  disabled={flow.busy || (!flow.intent && restricted)}
                  onClick={() => flow.setOpen(true)}
                >
                  {flow.uncertain ? 'Resolve withdrawal request' : 'Request withdrawal'}
                </button>
              </nav>
              {tab === 'withdrawals' ? (
                <div className="wallet-transactions">
                  <div className="wallet-mobile-list-heading">
                    <button onClick={() => setTab('overview')}>← Overview</button>
                    <h2>Recent withdrawal requests</h2>
                    <button
                      className="remaining-primary"
                      disabled={flow.busy || (!flow.intent && restricted)}
                      onClick={() => flow.setOpen(true)}
                    >
                      {flow.uncertain ? 'Resolve request' : 'Request withdrawal'}
                    </button>
                  </div>
                  <h2>Recent withdrawal requests</h2>
                  <p>Latest 10 at most. Complete history and pagination are not provided.</p>
                  {!wallet.recent_withdrawals.length && <p>No recent withdrawal requests.</p>}
                  {wallet.recent_withdrawals.map((item) => (
                    <article key={item.id}>
                      <span className="wallet-withdrawal-icon">
                        <RemainingIcon name="withdrawalsActive" />
                      </span>
                      <div className="wallet-transaction-copy">
                        <strong>{methodLabel(payoutField(item, 'method'))}</strong>
                        <small>
                          {maskAccount(payoutField(item, 'account'))} ·{' '}
                          {item.created_at
                            ? new Date(item.created_at).toLocaleString()
                            : 'Date unavailable'}
                        </small>
                        {item.status === 'rejected' && item.note && (
                          <small>Review note: {item.note}</small>
                        )}
                      </div>
                      <div className="wallet-transaction-status">
                        <strong>{money(item.amount, wallet.currency)}</strong>
                        <span className={item.status === 'paid' ? 'completed' : `withdrawal-${item.status}`}>
                          {item.status[0].toUpperCase() + item.status.slice(1)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="wallet-summary">
                  <header>
                    <h2>{tab === 'earnings' ? 'Net earnings summary' : 'Wallet overview'}</h2>
                  </header>
                  <p>
                    Monthly earnings, growth charts, session rates and patient-level transactions
                    are not provided by the wallet API.
                  </p>
                  <p>
                    Earned amounts are net after {Math.round(wallet.commission_rate * 100)}%
                    commission. Pending earnings are not withdrawable. Reserved amounts are already
                    excluded from available balance.
                  </p>
                  <p>Session counts are separately defined; they are not an all-sessions total.</p>
                </div>
              )}
              <div className="wallet-advisory">
                <RemainingIcon name="withdrawalInfo" />
                <p>
                  Withdrawals are requests for manual finance review, not automatic transfers.
                  Server minimum: {money(wallet.min_withdrawal, wallet.currency)}. No payout
                  timetable is provided.
                </p>
              </div>
              {restricted && (
                <p className="remaining-notice">
                  Requests are unavailable while funds are below the minimum or a request is
                  pending. The server makes the final eligibility and balance checks.
                </p>
              )}
            </section>
          </>
        )}
        {flow.notice && (
          <p className="remaining-notice" role="status">
            {flow.notice}
          </p>
        )}
        {flow.uncertain && !flow.open && (
          <p className="remaining-error" role="alert">
            A previous request has an unknown outcome. Do not create a new request.{' '}
            <button onClick={() => flow.setOpen(true)}>Resolve withdrawal request</button>
          </p>
        )}
        {flow.open && (
          <Modal
            title="Withdrawal Request"
            className="remaining-modal withdrawal-modal"
            closeIcon={<RemainingIcon name="close" />}
            onClose={() => {
              if (!flow.lock.current) flow.setOpen(false)
            }}
          >
            <form className="withdrawal-form" noValidate onSubmit={flow.review}>
              <p className="withdrawal-balance">
                {wallet
                  ? `Available Balance: ${money(wallet.available, wallet.currency)}`
                  : 'Refresh wallet to see current balance.'}
              </p>
              <p>
                This submits a request for manual finance review. No automatic transfer, guaranteed
                payout time, Shamcash or Al-Haram connector is provided.
              </p>
              {!flow.intent ? (
                <>
                  <label className="withdrawal-method">
                    <select
                      aria-label="Select payment method"
                      value={flow.method}
                      disabled={flow.busy}
                      onChange={(event) => flow.setMethod(event.target.value as PayoutMethod | '')}
                    >
                      <option value="">Select payment method</option>
                      {Object.entries(payoutMethods).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    aria-label="Withdrawal amount"
                    inputMode="decimal"
                    placeholder="Enter amount (up to two decimal places)"
                    value={flow.amount}
                    disabled={flow.busy}
                    onChange={(event) => flow.setAmount(event.target.value)}
                  />
                  <input
                    aria-label="Payout account"
                    placeholder="Account / payout destination"
                    maxLength={255}
                    autoComplete="off"
                    value={flow.account}
                    disabled={flow.busy}
                    onChange={(event) => flow.setAccount(event.target.value)}
                  />
                  <input
                    aria-label="Account holder name (optional)"
                    placeholder="Account holder name (optional)"
                    maxLength={255}
                    autoComplete="off"
                    value={flow.holder}
                    disabled={flow.busy}
                    onChange={(event) => flow.setHolder(event.target.value)}
                  />
                  <p>
                    Provide only the payout destination, never a password or verification code.
                    Minimum:{' '}
                    {wallet
                      ? money(Math.max(1, wallet.min_withdrawal), wallet.currency)
                      : 'unavailable'}
                    . Maximum request: 100,000 in the server currency, subject to available balance.
                    These are advisory checks; the server decides eligibility.
                  </p>
                  <button
                    className="remaining-primary"
                    type="submit"
                    disabled={flow.busy || restricted || flow.waiting > 0}
                  >
                    Review request
                  </button>
                </>
              ) : (
                <>
                  <h3>Confirm manual-review request</h3>
                  <p>
                    {money(flow.intent.body.amount, flow.intent.currency)} ·{' '}
                    {payoutMethods[flow.intent.body.payout_details.method]} ·{' '}
                    {maskAccount(flow.intent.body.payout_details.account)}
                  </p>
                  <p>
                    Approval and payment are separate stages. Submission does not mean money has
                    been transferred.
                  </p>
                  {flow.uncertain && (
                    <p>
                      Outcome unknown. Keep this page open. Reconcile recent requests before
                      retrying; only the unchanged request with its original key can be retried. If
                      unresolved or older than 24 hours, contact finance support before any new
                      request.
                    </p>
                  )}
                  {flow.uncertain && (
                    <button
                      type="button"
                      disabled={flow.busy || flow.waiting > 0}
                      onClick={() => void flow.reconcile()}
                    >
                      Reconcile recent requests
                    </button>
                  )}
                  <button
                    className="remaining-primary"
                    type="button"
                    disabled={
                      flow.busy ||
                      restricted ||
                      flow.waiting > 0 ||
                      wallet?.currency !== flow.intent.currency ||
                      (flow.uncertain && (!flow.reconciled || flow.expired))
                    }
                    onClick={() => void flow.send()}
                  >
                    {flow.busy
                      ? 'Checking request…'
                      : flow.uncertain
                        ? 'Retry unchanged request'
                        : 'Confirm request for review'}
                  </button>
                  {!flow.uncertain && (
                    <button
                      type="button"
                      disabled={flow.busy || flow.waiting > 0}
                      onClick={flow.edit}
                    >
                      Edit request
                    </button>
                  )}
                </>
              )}
              {flow.error && (
                <p className="remaining-error" role="alert">
                  {flow.error}
                </p>
              )}
              {flow.waiting && (
                <p role="status">Please wait {flow.waiting} seconds before retrying.</p>
              )}
            </form>
          </Modal>
        )}
      </div>
    </Workspace>
  )
}

function useWithdrawalFlow(api: ApiClient, wallet: WalletSummary | null, reload: () => void) {
  const memory = withdrawalMemory(api)
  const [open, setOpen] = useState(!!memory.intent)
  const [method, setMethod] = useState<PayoutMethod | ''>('')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')
  const [holder, setHolder] = useState('')
  const [intent, setIntent] = useState<Intent | null>(memory.intent)
  const intentRef = useRef<Intent | null>(memory.intent)
  const [uncertain, setUncertain] = useState(!!memory.intent)
  const uncertainRef = useRef(!!memory.intent)
  const [reconciled, setReconciled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retryAt, setRetryAt] = useState(memory.retryAt)
  const [clock, setClock] = useState(Date.now())
  const lock = useRef(false)
  const active = useRef(false)
  const request = useRef<AbortController | null>(null)
  const actor = api.getUser()?.id
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      request.current?.abort()
      intentRef.current = null
    }
  }, [api])
  useEffect(() => {
    if (!retryAt && !intent) return
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [retryAt, intent])
  useEffect(() => {
    if (!busy && !uncertain) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy, uncertain])
  const waiting = Math.max(0, Math.ceil((retryAt - clock) / 1000))
  const expired = !!intent && Date.now() - intent.created >= 24 * 60 * 60 * 1000
  function current(controller: AbortController) {
    return active.current && !controller.signal.aborted && api.getUser()?.id === actor
  }
  function begin(): AbortController | null {
    if (lock.current || Date.now() < retryAt) return null
    lock.current = true
    setBusy(true)
    const controller = new AbortController()
    request.current = controller
    return controller
  }
  function end(controller: AbortController) {
    if (current(controller)) {
      lock.current = false
      setBusy(false)
      request.current = null
    }
  }
  function finish(item: Withdrawal) {
    memory.intent = null
    memory.retryAt = 0
    setNotice(
      item.status === 'pending'
        ? 'Withdrawal request pending review. No money transfer is confirmed. Check recent requests for its current status.'
        : 'Withdrawal request recorded. Refreshing its current review status; this does not confirm an automatic money transfer.',
    )
    setIntent(null)
    intentRef.current = null
    setUncertain(false)
    uncertainRef.current = false
    setReconciled(false)
    setMethod('')
    setAmount('')
    setAccount('')
    setHolder('')
    setError('')
    setOpen(false)
    reload()
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || intentRef.current || Date.now() < retryAt) return
    setError('')
    if (!wallet || isRestricted(wallet)) {
      setError(
        'Refresh your wallet. A pending request or insufficient funds may prevent a new request.',
      )
      return
    }
    const text = amount.trim()
    const value = Number(text)
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(text) ||
      !Number.isFinite(value) ||
      value < Math.max(1, wallet.min_withdrawal) ||
      value > 100000 ||
      value > wallet.available
    ) {
      setError(
        `Enter an amount with at most two decimal places, at least ${money(Math.max(1, wallet.min_withdrawal), wallet.currency)} and no more than the available balance or 100,000.`,
      )
      return
    }
    if (
      !method ||
      !Object.hasOwn(payoutMethods, method) ||
      !account.trim() ||
      account.trim().length > 255 ||
      holder.trim().length > 255
    ) {
      setError(
        'Select a supported method and provide a payout account. Account and optional holder name must be at most 255 characters.',
      )
      return
    }
    // Freeze the exact numeric representation and nested key ordering for every replay.
    const body: WithdrawalBody = Object.freeze({
      amount: value,
      payout_details: Object.freeze({
        method,
        account: account.trim(),
        ...(holder.trim() ? { holder_name: holder.trim() } : {}),
      }),
    })
    const next: Intent = {
      body,
      key: crypto.randomUUID(),
      beforeIds: wallet.recent_withdrawals.map((item) => item.id),
      created: Date.now(),
      currency: wallet.currency,
    }
    intentRef.current = next
    setIntent(next)
    setNotice('')
    setReconciled(false)
  }
  function canLeave() {
    if (lock.current || uncertainRef.current) {
      setError(
        'Keep this page open until the previous withdrawal outcome is reconciled. Do not create another request.',
      )
      setOpen(true)
      return false
    }
    return true
  }
  function edit() {
    if (lock.current || uncertainRef.current || Date.now() < retryAt) return
    intentRef.current = null
    setIntent(null)
    setError('')
  }
  async function reconcileWithin(controller: AbortController, original: Intent) {
    const fresh = walletValue(await api.get<unknown>(walletPath, controller.signal))
    if (!current(controller)) return
    // The API does not expose idempotency keys in history. A negative latest-ten result
    // cannot prove non-commit: keep the immutable intent locked, never mint a new key.
    const match = fresh.recent_withdrawals.find(
      (item) =>
        item.therapist_id === actor &&
        !original.beforeIds.includes(item.id) &&
        item.amount === original.body.amount &&
        payoutField(item, 'method') === original.body.payout_details.method &&
        payoutField(item, 'account') === original.body.payout_details.account &&
        (payoutField(item, 'holder_name') ?? '') ===
          (original.body.payout_details.holder_name ?? ''),
    )
    if (match) {
      finish(match)
      return
    }
    setReconciled(true)
    setError(
      fresh.currency !== original.currency
        ? 'Wallet currency has changed. Do not retry; finance support must reconcile the previous request.'
        : 'The previous outcome is still unknown. A recent-history refresh does not prove it failed. Retry only the unchanged request with its original key; do not start a new request. Contact finance support if unresolved.',
    )
    reload()
  }
  async function reconcile() {
    const original = intentRef.current
    if (!original) return
    const controller = begin()
    if (!controller) return
    setReconciled(false)
    try {
      await reconcileWithin(controller, original)
    } catch (failure) {
      if (current(controller)) {
        if (failure instanceof ApiError && failure.retryAfter)
          setRetryAt(Date.now() + failure.retryAfter * 1000)
        setError(
          `${apiErrorMessage(failure)} The previous outcome remains unknown. Do not create another request.`,
        )
      }
    } finally {
      end(controller)
    }
  }
  async function send() {
    const original = intentRef.current
    if (
      !original ||
      isRestricted(wallet) ||
      wallet?.currency !== original.currency ||
      (uncertainRef.current &&
        (!reconciled || Date.now() - original.created >= 24 * 60 * 60 * 1000))
    )
      return
    const controller = begin()
    if (!controller) return
    // Survive in-app/history unmounts without persisting sensitive payout details to disk.
    memory.intent = original
    setError('')
    try {
      const response = record(
        await api.mutate<unknown>(`${walletPath}/withdraw`, original.body, {
          idempotencyKey: original.key,
          signal: controller.signal,
        }),
      )
      if (!current(controller)) return
      const item = withdrawalValue(response.withdrawal)
      if (item.therapist_id !== actor || item.amount !== original.body.amount)
        throw new ApiError(502)
      finish(item)
    } catch (failure) {
      if (!current(controller)) return
      const status = failure instanceof ApiError ? failure.status : 0
      if (failure instanceof ApiError && failure.retryAfter) {
        memory.retryAt = Date.now() + failure.retryAfter * 1000
        setRetryAt(memory.retryAt)
      }
      setError(apiErrorMessage(failure))
      // 409 includes in-flight / expiry as well as an existing pending request;
      // without server exception text these cannot safely be distinguished.
      if (uncertainRef.current || status === 0 || status === 409 || status >= 500) {
        uncertainRef.current = true
        setUncertain(true)
        setReconciled(false)
        if (failure instanceof ApiError && failure.retryAfter > 0) {
          setError(
            `${apiErrorMessage(failure)} Wait before reconciling. The previous outcome is unknown; do not create another request.`,
          )
          return
        }
        try {
          await reconcileWithin(controller, original)
        } catch (refreshFailure) {
          if (current(controller)) {
            if (refreshFailure instanceof ApiError && refreshFailure.retryAfter) {
              memory.retryAt = Date.now() + refreshFailure.retryAfter * 1000
              setRetryAt(memory.retryAt)
            }
            setError(
              `${apiErrorMessage(failure)} Unable to reconcile recent requests. Keep this page open and do not create another request.`,
            )
          }
        }
      } else if (status === 422 || status === 403 || status === 413) {
        // A definitive pre-commit rejection allows corrected intent with a new key.
        // Never clear an earlier unknown outcome based solely on a later rejection.
        intentRef.current = null
        memory.intent = null
        setIntent(null)
        reload()
      }
    } finally {
      end(controller)
    }
  }
  return {
    open,
    setOpen,
    method,
    setMethod,
    amount,
    setAmount,
    account,
    setAccount,
    holder,
    setHolder,
    intent,
    uncertain,
    reconciled,
    busy,
    error,
    notice,
    waiting,
    expired,
    lock,
    canLeave,
    review,
    edit,
    send,
    reconcile,
  }
}
