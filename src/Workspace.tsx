import { useEffect, useRef, useState, type ReactNode } from 'react'
import { asset } from './assets'
import { menu, notifications as demoNotifications } from './data'
import { Logo, Modal } from './ui'
import { ApiClient } from './api'
import { LiveNotifications } from './api-chat-and-notifications-live-notifications'
import { DemoNetworkToggle } from './DemoNetworkToggle'
import './visual-workspace-closure.css'

type WorkspaceProps = {
  title: ReactNode
  active:
    | 'Dashboard'
    | 'Clients'
    | 'Messages'
    | 'Sessions'
    | 'Profile'
    | 'Wallet'
    | 'Additional Content'
  navigate: (path: string) => void
  children: ReactNode
  offline?: boolean
  onSearch?: (value: string) => void
  mobileTitle?: string
  api?: ApiClient
}

const navigationIcons = [
  'part2-07-imgDashboardIcon.svg',
  'part2-03-imgSquareUserCheck.svg',
  'part2-07-imgCalendarAlt.svg',
  'part2-03-imgMessageCircleLinesAlt.svg',
  'part2-03-imgStars.svg',
  'part2-03-imgWallet.svg',
]
const mobileIcons = [
  'part2-06-imgHome.svg',
  'part2-06-imgFrame2147234901.svg',
  'part2-06-imgFrame2147234900.svg',
  'part2-06-imgFrame2147234899.svg',
  'part2-06-imgStars.svg',
  'part2-06-imgWalletAlt.svg',
  'r4-chats-user-alt.svg',
]

export function DesignIcon({ name }: { name: string }) {
  return <img className="design-icon" src={asset(name)} alt="" aria-hidden="true" />
}

export function Workspace({
  title,
  active,
  navigate,
  children,
  offline = false,
  onSearch,
  mobileTitle,
  api,
}: WorkspaceProps) {
  const user = api?.getUser()
  const notifications = api ? [] : demoNotifications
  const params = new URLSearchParams(window.location.search)
  const initial = params.get('state')
  const [collapsed, setCollapsed] = useState(initial === 'collapsed')
  const [expanded, setExpanded] = useState(initial === 'expanded')
  const [online, setOnline] = useState(navigator.onLine)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [dismissed, setDismissed] = useState<number[]>([])
  const isOffline = offline || initial === 'offline' || !online
  const isHelpPage = active === 'Profile' && /^\/profile\/help\/?$/.test(window.location.pathname)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const popupViewport =
      typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1100px)').matches : window.innerWidth <= 1100
    if (!expanded || !popupViewport) return
    const sidebar = sidebarRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () =>
      Array.from(sidebar?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (element) => element.getClientRects().length > 0 || !element.closest('.compact-reminder'),
      )
    if (!sidebar?.contains(document.activeElement)) sidebar?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !sidebar?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      document.body.style.overflow = previousOverflow
      if (opener && opener.isConnected && !sidebar?.contains(opener)) opener.focus()
      else document.querySelector<HTMLElement>('.secondary-mobile-menu')?.focus()
    }
  }, [expanded])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false)
        setNotificationOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('keydown', escape)
    }
  }, [])

  function openPage(label: string) {
    setExpanded(false)
    const route =
      label === 'Dashboard'
        ? '/dashboard'
        : label === 'Messages'
          ? '/chats'
          : label === 'Sessions'
            ? '/sessions'
            : label === 'Wallet'
              ? '/wallet'
              : label === 'Additional Content'
                ? '/homework'
              : label === 'Profile'
                ? '/profile'
                : (label === 'Patients' || label === 'Clients') && (api || (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'))
                  ? '/clients'
                  : null
    if (route) navigate(route)
    else
      setNotice(
        api
          ? `${label}: this feature is not available in the therapist API.`
          : `${label}: this screen is not included in the supplied designs. No backend is connected.`,
      )
  }

  const activeLabel = active === 'Clients' ? 'Patients' : active

  return (
    <div
      className={`workspace secondary-workspace visual-auth-shell ${!api ? 'demo-workspace' : ''} ${active === 'Profile' || active === 'Wallet' ? 'remaining-workspace' : ''} ${active === 'Messages' ? 'chat-workspace' : ''} ${isHelpPage ? 'profile-help-workspace' : ''} ${active === 'Wallet' ? 'wallet-workspace' : ''} ${collapsed ? 'is-collapsed' : ''} ${expanded ? 'is-expanded' : ''} ${isOffline ? 'secondary-offline' : ''}`}
    >
      {expanded && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setExpanded(false)}
        />
      )}
      <aside ref={sidebarRef} tabIndex={expanded ? -1 : undefined} className="sidebar" aria-label="Main navigation">
        <div>
          <header className="sidebar-header">
            <Logo wordmark />
            <button
              className="icon-button collapse-button"
              aria-label={
                expanded ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              onClick={() => {
                if (window.innerWidth <= 1100) setExpanded(!expanded)
                else if (expanded) setExpanded(false)
                else setCollapsed(!collapsed)
              }}
            >
              <DesignIcon name={expanded ? 'r4-nav-popup-minimize.svg' : 'part2-03-imgCaretDoubleHorizontal.svg'} />
              {active === 'Wallet' && (
                <svg className="wallet-drawer-collapse" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 17L8 12M3 12H8V17M17 3L12 8M12 3V8H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </header>
          <nav className="navigation">
            <p className="nav-label">MAIN MENU</p>
            {menu.map((item, index) => (
              <button
                key={item.label}
                className={`nav-item ${item.label === activeLabel ? 'active' : ''}`}
                aria-label={item.label}
                aria-current={item.label === activeLabel ? 'page' : undefined}
                onClick={() => openPage(item.label)}
                title={item.label}
              >
                <DesignIcon
                  name={
                    active === 'Messages' && index === 0
                      ? 'part2-03-imgDashboardIcon.svg'
                      : navigationIcons[index]
                  }
                />
                <span className="nav-text">{item.label}</span>
                {!api && item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="client-reminder textured">
            <div>
              <p>This week</p>
              <p>
                {api
                  ? 'Review your assigned clients and upcoming sessions.'
                  : 'You have one client without assigned content for over a week.'}
              </p>
              <button onClick={() => navigate('/clients')}>
                Client review
              </button>
            </div>
          </div>
          <button
            className="compact-reminder icon-button"
            aria-label="Client review"
            onClick={() => navigate('/clients')}
          >
            <DesignIcon name="part2-10-imgMaterialSymbolsLightEmergencyHome.svg" />
          </button>
          <button
            className={`profile-card textured ${active === 'Profile' ? 'active' : ''}`}
            aria-label="Open profile"
            aria-current={active === 'Profile' ? 'page' : undefined}
            onClick={() => navigate('/profile')}
          >
            {api ? (
              <span className="api-avatar" aria-hidden="true">
                {user?.name?.slice(0, 1) || '?'}
              </span>
            ) : (
              <img src={asset('dashboard-imgContainer.png')} alt="Dr. Issa Alhadad" />
            )}
            <span className="profile-copy">
              <strong>{api ? user?.name : 'Dr. Issa Alhadad'}</strong>
              <small>{api ? 'Therapist' : 'Certified Psychotherapist'}</small>
            </span>
            <DesignIcon name="part2-03-imgIcon.svg" />
          </button>
        </div>
      </aside>
      <main className="secondary-main">
        <header className="secondary-topbar">
          <div className="secondary-heading">
            <button
              className="icon-button secondary-mobile-menu"
              aria-label="Open navigation"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <DesignIcon name="part2-11-imgMenu.svg" />
            </button>
            <h1 className={mobileTitle ? 'desktop-page-title' : undefined}>{title}</h1>
            {mobileTitle && <h1 className="mobile-page-title">{mobileTitle}</h1>}
          </div>
          <div className="secondary-actions">
            <label className={`secondary-search ${searchOpen ? 'open' : ''}`}>
              <DesignIcon name="part2-03-imgSearch.svg" />
              <input
                aria-label={onSearch ? 'Search patients' : 'Search unavailable'}
                title={onSearch ? undefined : 'Search is not available on this page.'}
                disabled={!onSearch}
                placeholder="Search..."
                onChange={(event) => onSearch?.(event.target.value)}
              />
            </label>
            <button
              className="icon-button secondary-mobile-search"
              aria-label="Open search"
              aria-expanded={searchOpen}
              disabled={!onSearch}
              title={onSearch ? undefined : 'Search is not available on this page.'}
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <DesignIcon name="part2-03-imgSearch.svg" />
            </button>
            <button
              className="icon-button"
              aria-label="Notifications"
              aria-expanded={notificationOpen}
              onClick={() => setNotificationOpen(!notificationOpen)}
            >
              <DesignIcon name="part2-03-imgNotification.svg" />
            </button>
          </div>
        </header>
        {isOffline && (
          <div className="secondary-offline-banner" role="status">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <g fill="currentColor" opacity=".3">
                <path d="M3.35013 4.41079C2.50036 4.86508 1.71172 5.41858 0.999822 6.05575C0.691177 6.33199 0.664911 6.80614 0.941156 7.11479C1.2174 7.42343 1.69155 7.4497 2.00019 7.17345C2.73628 6.51464 3.56555 5.95825 4.46587 5.52653L3.35013 4.41079Z" />
                <path d="M6.183 7.24366C5.16312 7.61418 4.23696 8.18 3.45026 8.8956C3.14385 9.17432 3.1214 9.64867 3.40012 9.95508C3.67884 10.2615 4.15318 10.2839 4.45959 10.0052C5.27695 9.26173 6.27657 8.71649 7.38389 8.44455L6.183 7.24366Z" />
                <path d="M9.4629 10.5236C9.3107 10.508 9.15627 10.5 9.00001 10.5C7.83482 10.5 6.77155 10.9438 5.9728 11.6704C5.66639 11.9491 5.64394 12.4235 5.92266 12.7299C6.20138 13.0363 6.67572 13.0587 6.98213 12.78C7.51555 12.2948 8.22248 12 9.00001 12C9.77754 12 10.4845 12.2948 11.0179 12.78C11.2493 12.9905 11.5765 13.0292 11.8429 12.9036L9.4629 10.5236Z" />
                <path d="M6.43533 3.27481L7.73579 4.57527C8.15022 4.52557 8.57211 4.5 9.00001 4.5C11.6897 4.5 14.1417 5.51037 15.9998 7.17345C16.3085 7.4497 16.7826 7.42343 17.0589 7.11479C17.3351 6.80614 17.3088 6.33199 17.0002 6.05575C14.8777 4.15604 12.0729 3 9.00001 3C8.11987 3 7.26173 3.09483 6.43533 3.27481Z" />
                <path d="M12.2341 9.07355L9.96659 6.80607C11.7215 7.01103 13.3091 7.76706 14.5498 8.8956C14.8562 9.17432 14.8786 9.64867 14.5999 9.95508C14.3212 10.2615 13.8468 10.2839 13.5404 10.0052C13.1448 9.64539 12.7066 9.332 12.2341 9.07355Z" />
                <path d="M8.25001 15C8.25001 14.5858 8.58579 14.25 9.00001 14.25H9.00751C9.42172 14.25 9.75751 14.5858 9.75751 15C9.75751 15.4142 9.42172 15.75 9.00751 15.75H9.00001C8.58579 15.75 8.25001 15.4142 8.25001 15Z" />
              </g>
              <path fill="currentColor" d="M1.71967 1.71967C2.01256 1.42678 2.48744 1.42678 2.78033 1.71967L16.2803 15.2197C16.5732 15.5126 16.5732 15.9874 16.2803 16.2803C15.9874 16.5732 15.5126 16.5732 15.2197 16.2803L1.71967 2.78033C1.42678 2.48744 1.42678 2.01256 1.71967 1.71967Z" />
            </svg>
            <span>You're offline. Some data may not be up to date.</span>
          </div>
        )}
        {children}
      </main>
      {(active === 'Messages' || isHelpPage) && (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {[...menu.map((item) => item.label), 'Profile'].map((label, index) => (
            <button
              key={label}
              className={label === activeLabel ? 'active' : ''}
              aria-label={label}
              aria-current={label === activeLabel ? 'page' : undefined}
              onClick={() => openPage(label)}
            >
              <DesignIcon name={mobileIcons[index]} />
            </button>
          ))}
        </nav>
      )}
      {notificationOpen && (
        <div
          className="notifications-panel secondary-notifications"
          role="region"
          aria-label="Notifications"
        >
          <header>
            <h2>Notifications</h2>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => setNotificationOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="notifications-list">
            {api && <LiveNotifications api={api} navigate={navigate} />}
            {notifications
              .filter((item) => !dismissed.includes(item.id))
              .map((item) => (
                <article key={item.id} className="notification-item">
                  <div className="notification-avatar">
                    <img src={asset(item.image)} alt="" />
                  </div>
                  <div className="notification-body">
                    <strong>{item.title}</strong> {item.detail}
                    <p>{item.description}</p>
                    <time>{item.time}</time>
                    {item.action && (
                      <button
                        className="soft-button"
                        onClick={() =>
                          item.action === 'Accept'
                            ? setDismissed([...dismissed, item.id])
                            : setNotice('Demo only: no notification service is connected.')
                        }
                      >
                        {item.action}
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      )}
      {notice && (
        <Modal
          title={api ? 'Feature unavailable' : 'Frontend demo'}
          className="part2-modal"
          onClose={() => setNotice('')}
        >
          <p>{notice}</p>
        </Modal>
      )}
      <DemoNetworkToggle />
    </div>
  )
}
