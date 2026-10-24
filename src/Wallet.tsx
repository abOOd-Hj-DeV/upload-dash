import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Workspace } from './Workspace'
import { Modal } from './ui'
import { asset } from './assets'
import { remainingAssets } from './remaining-assets'
import { RemainingIcon } from './RemainingUI'
import { ApiClient } from './api'
import { ApiWalletAndWithdrawalsLive } from './api-wallet-and-withdrawals-live'
import { closurePortraitAssets } from './closure-portrait-assets'
import './visual-wallet-closure.css'

const withdrawArrow = 'r4-wallet-arrow-right.svg'
type Tab = 'overview' | 'earnings' | 'withdrawals'
type Method = '' | 'shamcash' | 'haram'
const monthly = [
  { month: 'May', short: 'May', value: 8400, height: 204, phoneHeight: 98 },
  { month: 'April', short: 'Apr', value: 9200, height: 221, phoneHeight: 110 },
  { month: 'March', short: 'Mar', value: 8500, height: 215, phoneHeight: 100 },
  { month: 'February', short: 'Feb', value: 7800, height: 191, phoneHeight: 90 },
  { month: 'January', short: 'Jan', value: 6200, height: 165, phoneHeight: 70 },
]
const earnings = [
  {
    name: 'Sarah Ali',
    date: '2024-05-20',
    amount: 300,
    status: 'Completed',
  },
  {
    name: 'Ahmed Mohammed',
    date: '2024-05-20',
    amount: 200,
    status: 'Completed',
  },
  {
    name: 'Sarah Khalid',
    date: '2024-05-17',
    amount: 100,
    status: 'Processing',
  },
  {
    name: 'Omar Youssef',
    date: '2024-05-16',
    amount: 200,
    status: 'Completed',
  },
  {
    name: 'Omar Youssef',
    date: '2024-05-16',
    amount: 400,
    status: 'Completed',
  },
].map((item) => {
  const portrait = closurePortraitAssets.wallet.earnings.find(
    ({ target }) =>
      target.name === item.name && target.date === item.date && target.amount === item.amount,
  )
  return {
    ...item,
    portrait: portrait?.image ?? remainingAssets.walletAvatar,
    artwork: portrait?.artwork ?? 'photo',
  }
})
// Reference-only fixtures: never used by ApiWalletAndWithdrawalsLive.
const responsiveWithdrawals = [
  { date: '2024-05-20', amount: 300, status: 'Completed' },
  { date: '2024-05-20', amount: 200, status: 'Completed' },
  { date: '2024-05-17', amount: 100, status: 'Processing' },
  { date: '2024-05-16', amount: 200, status: 'Completed' },
  { date: '2024-05-16', amount: 400, status: 'Completed' },
].map((item) => {
  const portrait = closurePortraitAssets.wallet.responsiveWithdrawals.find(
    ({ target }) => target.date === item.date && target.amount === item.amount,
  )
  return {
    ...item,
    portrait: portrait?.image ?? remainingAssets.walletAvatar,
    artwork: portrait?.artwork ?? 'photo',
  }
})
const withdrawals = Array.from({ length: 6 }, (_, index) => ({
  id: `demo-withdrawal-${index + 1}`,
  responsive: responsiveWithdrawals[index],
}))
const metrics = [
  { icon: 'withdrawn', title: 'Withdrawn', mobile: 'Withdrawn', value: '$30.0k' },
  { icon: 'available', title: 'Available Now', mobile: 'Available', value: '$12.5k' },
  { icon: 'pending', title: 'Pending', mobile: 'Pending', value: '$3.2k' },
  { icon: 'rate', title: 'Session Rate', mobile: 'Rate', value: '1000 SP' },
  {
    icon: 'sessions',
    title: 'Sessions',
    mobile: 'Sessions',
    value: '42 Sessions',
    phoneValue: '42 Sess.',
  },
  { icon: 'transactions', title: 'Transactions', mobile: 'Transactions', value: '8 Trans' },
] as const

export function Wallet({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  return api ? (
    <ApiWalletAndWithdrawalsLive api={api} navigate={navigate} />
  ) : (
    <DemoWallet navigate={navigate} />
  )
}

function DemoWallet({ navigate }: { navigate: (path: string) => void }) {
  const state = new URLSearchParams(window.location.search).get('state')
  const [tab, setTab] = useState<Tab>(
    state === 'earnings'
      ? 'earnings'
      : state === 'withdrawals' || ['withdraw', 'shamcash', 'haram'].includes(state ?? '')
        ? 'withdrawals'
        : 'overview',
  )
  const [requestOpen, setRequestOpen] = useState(
    ['withdraw', 'shamcash', 'haram'].includes(state ?? ''),
  )
  const [notice, setNotice] = useState('')
  return (
    <Workspace title="Dashboard" mobileTitle="Wallet" active="Wallet" navigate={navigate}>
      <div className={`wallet-layout wallet-demo wallet-${tab}`}>
        <p className="wallet-phone-heading">Therapist Overview</p>
        <div className="wallet-metrics">
          <article className="wallet-total textured">
            <div>
              <header>
                <span className="wallet-desktop-hero-heading">Overview</span>
                <h2 className="wallet-desktop-hero-heading">Total in all time</h2>
                <h2 className="wallet-tablet-hero-heading">All time Overview</h2>
              </header>
              <div className="wallet-total-numbers">
                <div>
                  <span>Total in all time</span>
                  <strong>$41.5k</strong>
                </div>
                <div>
                  <span>Monthly earnings</span>
                  <strong>8,400 SP</strong>
                </div>
                <div>
                  <span>Net available</span>
                  <strong>$9.3k</strong>
                </div>
              </div>
            </div>
          </article>
          <article className="wallet-phone-total">
            <button onClick={() => setTab('withdrawals')} aria-label="View withdrawals">
              <span>Net Available Balance</span>
              <strong className="remaining-badge">$9.3k</strong>
            </button>
            <p>
              <span>Total in all time</span>
              <span>$41.5k</span>
            </p>
            <button onClick={() => setTab('earnings')} aria-label="View earnings">
              <span>Monthly earnings</span>
              <span>8,400 SP</span>
            </button>
          </article>
          <div className="wallet-stat-grid">
            {metrics.map((metric) => (
              <article key={metric.icon}>
                <p>
                  <RemainingIcon name={metric.icon} />
                  <span className="desktop-metric-label">{metric.title}</span>
                  <span className="phone-metric-label">{metric.mobile}</span>
                </p>
                <strong className={'phoneValue' in metric ? 'desktop-metric-value' : undefined}>
                  {metric.value}
                </strong>
                {'phoneValue' in metric && (
                  <strong className="phone-metric-value">{metric.phoneValue}</strong>
                )}
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
            {tab === 'withdrawals' && (
              <button
                className="remaining-primary wallet-withdraw-button"
                onClick={() => setRequestOpen(true)}
              >
                Withdraw
                <img className="wallet-withdraw-arrow" src={asset(withdrawArrow)} alt="" />
              </button>
            )}
          </nav>
          {tab === 'overview' ? (
            <div className="wallet-chart">
              <header>
                <button onClick={() => setTab('earnings')}>Monthly Earnings</button>
                <span className="wallet-growth">
                  ↑ <span className="desktop-growth">35% since January</span>
                  <span className="phone-growth">35%</span>
                </span>
              </header>
              <div
                className="wallet-bars"
                role="img"
                aria-label="Monthly earnings: January 6,200; February 7,800; March 8,500; April 9,200; May 8,400"
              >
                <div className="desktop-wallet-bars">
                  {monthly.map((item) => (
                    <div className="wallet-bar-column" key={item.month}>
                      <strong>{item.value.toLocaleString('en-US')}</strong>
                      <div className="wallet-bar textured" style={{ height: item.height }} />
                      <small>{item.month}</small>
                    </div>
                  ))}
                </div>
                <div className="tablet-wallet-bars">
                  {[...monthly].reverse().map((item, index) => (
                    <div className="wallet-bar-column" key={item.month}>
                      <strong>{item.value}</strong>
                      <div
                        className="wallet-bar textured"
                        style={{ height: [124, 156, 170, 184, 168][index] }}
                      />
                      <small>{item.short}</small>
                    </div>
                  ))}
                </div>
                <div className="phone-wallet-bars">
                  {[...monthly].reverse().map((item) => (
                    <div className="wallet-bar-column" key={item.month}>
                      <strong>{(item.value / 1000).toFixed(1)}k</strong>
                      <div className="wallet-bar textured" style={{ height: item.phoneHeight }} />
                      <small>{item.short}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="wallet-transactions">
              <div className="wallet-mobile-list-heading">
                <button onClick={() => setTab('overview')}>← Overview</button>
                <h2>{tab === 'earnings' ? 'Earnings' : 'Withdrawals'}</h2>
                {tab === 'withdrawals' && (
                  <button
                    className="remaining-primary wallet-phone-withdraw"
                    onClick={() => setRequestOpen(true)}
                  >
                    Withdraw
                    <img className="wallet-withdraw-arrow" src={asset(withdrawArrow)} alt="" />
                  </button>
                )}
              </div>
              {tab === 'earnings'
                ? earnings.map((item, index) => (
                    <article key={`demo-earning-${index}`}>
                      <img
                        className="wallet-transaction-avatar"
                        data-artwork={item.artwork}
                        src={asset(item.portrait)}
                        alt=""
                      />
                      <div className="wallet-transaction-copy">
                        <strong>{item.name}</strong>
                        <small>Private Session · {item.date}</small>
                      </div>
                      <div className="wallet-transaction-status">
                        <strong className="wallet-income">+{item.amount} SP</strong>
                        <span className={item.status === 'Completed' ? 'completed' : 'processing'}>
                          {item.status}
                        </span>
                      </div>
                    </article>
                  ))
                : withdrawals.map((item) => (
                    <article
                      key={item.id}
                      className={
                        item.responsive
                          ? 'wallet-withdrawal-row'
                          : 'wallet-withdrawal-row wallet-desktop-only'
                      }
                    >
                      <picture className="wallet-transaction-portrait">
                        <source
                          media="(max-width: 1100px)"
                          srcSet={asset(item.responsive?.portrait ?? remainingAssets.walletAvatar)}
                        />
                        <img
                          className="wallet-transaction-avatar"
                          data-responsive-artwork={item.responsive?.artwork}
                          src={asset(remainingAssets.walletAvatar)}
                          alt=""
                        />
                      </picture>
                      <div className="wallet-transaction-copy">
                        <strong>
                          <span className="wallet-desktop-detail">Sarah Ali</span>
                          <span className="wallet-responsive-detail">ATM Withdrawal</span>
                        </strong>
                        <small>
                          <span className="wallet-desktop-detail">
                            SA** **** **** 1234 · 2024-05-01
                          </span>
                          <span className="wallet-responsive-detail">
                            ATM · {item.responsive?.date}
                          </span>
                        </small>
                      </div>
                      <div className="wallet-transaction-status">
                        <strong className="wallet-income">
                          <span className="wallet-desktop-detail">-7,500 ريال</span>
                          <span className="wallet-responsive-detail">
                            -{item.responsive?.amount} SP
                          </span>
                        </strong>
                        <span className="completed wallet-desktop-detail">Completed</span>
                        <span
                          className={`wallet-responsive-detail ${item.responsive?.status === 'Processing' ? 'processing' : 'completed'}`}
                        >
                          {item.responsive?.status}
                        </span>
                      </div>
                    </article>
                  ))}
            </div>
          )}
          <div className="wallet-advisory">
            {tab === 'overview' ? (
              <RemainingIcon name="withdrawalInfo" />
            ) : (
              <span className="remaining-icon" aria-hidden="true">
                <img src={asset(remainingAssets.withdrawalInfo)} alt="" />
              </span>
            )}
            <p className="desktop-wallet-advisory">
              Withdrawals are processed within 3-5 business days, with a minimum withdrawal amount
              of 500 Riyals — same terms apply as stated above the withdraw button.
            </p>
            <p className="phone-wallet-advisory">
              {tab === 'overview'
                ? 'Withdrawals are processed in 3-5 business days. Min 500 Riyals.'
                : 'Withdrawals are processed within 3-5 business days, with a minimum withdrawal amount of 500 Riyals — same terms apply as stated above the withdraw button.'}
            </p>
          </div>
        </section>
        {notice && (
          <p className="remaining-notice" role="status">
            {notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
              ×
            </button>
          </p>
        )}
        {requestOpen && (
          <Modal
            title="Withdrawal Request"
            className="remaining-modal withdrawal-modal wallet-demo-modal"
            closeIcon={<RemainingIcon name="close" />}
            onClose={() => setRequestOpen(false)}
          >
            <WithdrawalForm
              initial={state === 'shamcash' || state === 'haram' ? state : ''}
              onPreview={(amount, method) => {
                setRequestOpen(false)
                setNotice(
                  `Demo preview only: ${amount.toLocaleString('en-US')} SP via ${method === 'shamcash' ? 'Shamcash' : 'Al-Haram'}. No withdrawal request was sent and no money was moved.`,
                )
              }}
            />
          </Modal>
        )}
      </div>
    </Workspace>
  )
}

const paymentMethods = [
  { value: 'haram', label: 'Al-Haram transfer', selectedLabel: 'Al-Haram Transfer' },
  { value: 'shamcash', label: 'Shamcash Transfer', selectedLabel: 'Shamcash Transfer' },
] as const

function PaymentMethodMenu({
  method,
  onChange,
}: {
  method: Method
  onChange: (method: Method) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  function choose(value: Method) {
    onChange(value)
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div
      ref={root}
      className={`wallet-method-menu ${open ? 'is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
      }}
    >
      {/* Retain native select/form compatibility without a second focus or accessibility target. */}
      <select
        className="wallet-native-method"
        aria-label="Select payment method"
        aria-hidden="true"
        tabIndex={-1}
        name="method"
        value={method}
        onChange={(event) => choose(event.target.value as Method)}
      >
        <option value="">Select payment method</option>
        {paymentMethods.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        ref={trigger}
        role="combobox"
        aria-label="Payment method"
        aria-describedby={`${id}-value`}
        aria-required="true"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${paymentMethods[active].value}` : undefined}
        className="wallet-method-trigger"
        onClick={() => {
          setActive(
            Math.max(
              0,
              paymentMethods.findIndex((option) => option.value === method),
            ),
          )
          setOpen(!open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setActive(
              open
                ? (active + (event.key === 'ArrowDown' ? 1 : -1) + 2) % 2
                : event.key === 'ArrowUp'
                  ? 1
                  : Math.max(
                      0,
                      paymentMethods.findIndex((option) => option.value === method),
                    ),
            )
            setOpen(true)
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            setActive(event.key === 'Home' ? 0 : 1)
            setOpen(true)
          } else if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault()
            choose(paymentMethods[active].value)
          } else if (event.key === 'Tab') setOpen(false)
          else if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[as]$/i.test(event.key)) {
            event.preventDefault()
            setActive(event.key.toLowerCase() === 'a' ? 0 : 1)
            setOpen(true)
          }
        }}
      >
        {method ? (
          <span className={`payment-logo ${method}`}>
            <img src={asset(remainingAssets[method])} alt="" />
          </span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M2 7h16M5 12h3" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
        <span id={`${id}-value`}>
          {paymentMethods.find((option) => option.value === method)?.selectedLabel ??
            'Select payment method'}
        </span>
        <svg
          className="wallet-method-chevron"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      {open && (
        <div id={`${id}-options`} role="listbox" aria-label="Payment methods">
          {paymentMethods.map((option, index) => (
            <div
              id={`${id}-${option.value}`}
              key={option.value}
              role="option"
              aria-selected={method === option.value}
              className={active === index ? 'active' : ''}
              onPointerDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(option.value)}
            >
              <span className={`payment-logo ${option.value}`}>
                <img src={asset(remainingAssets[option.value])} alt="" />
              </span>
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WithdrawalForm({
  initial,
  onPreview,
}: {
  initial: Method
  onPreview: (amount: number, method: Exclude<Method, ''>) => void
}) {
  const [method, setMethod] = useState<Method>(initial)
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget),
      amount = Number(data.get('amount'))
    if (!method || !Number.isFinite(amount) || amount < 500 || amount > 12500) {
      setError('Select a payment method and enter an amount between 500 and 12,500 SP.')
      return
    }
    const fields = method === 'shamcash' ? ['code'] : ['name', 'phone', 'location']
    if (fields.some((name) => !String(data.get(name) ?? '').trim())) {
      setError('Complete the payment details.')
      return
    }
    onPreview(amount, method)
  }
  return (
    <form className="withdrawal-form" onSubmit={submit}>
      <p className="withdrawal-balance">Available Balance: 12,500 SP</p>
      <PaymentMethodMenu
        method={method}
        onChange={(value) => {
          setMethod(value)
          setError('')
        }}
      />
      {method === 'haram' && (
        <div className="withdrawal-inputs" key="haram">
          <input name="name" aria-label="Full name" placeholder="Enter Your Full Name" required />
          <input
            type="tel"
            name="phone"
            aria-label="Phone number"
            placeholder="Enter Phone Number"
            required
          />
          <input name="location" aria-label="Location" placeholder="Enter Your Location" required />
        </div>
      )}
      <input
        name="amount"
        type="number"
        aria-label="Withdrawal amount"
        placeholder="Enter the ammount"
        min="500"
        max="12500"
        step="0.01"
        required
      />
      {method === 'shamcash' && (
        <input
          key="code"
          name="code"
          aria-label="Shamcash Code"
          placeholder="Enter Shamcash Code"
          required
        />
      )}
      {error && (
        <p className="remaining-error" role="alert">
          {error}
        </p>
      )}
      <button className="remaining-primary" type="submit">
        Next
      </button>
    </form>
  )
}
