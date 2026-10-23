import { useEffect, useRef, useState } from 'react'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@fontsource/tajawal/700.css'
import '@fontsource/dm-sans/700-italic.css'
import './visual-dashboard-clients.css'
import { menu, metrics, notifications, sessions, type Session } from './data'
import { Icon, Logo, Modal } from './ui'
import { asset } from './assets'
import { ApiClient } from './api'
import { LiveCarePage } from './api-sessions-and-clinical-live'
import { DemoNetworkToggle } from './DemoNetworkToggle'

type DashboardProps = { navigate: (path: string) => void; api?: ApiClient }
type Overlay = 'meeting' | 'notifications' | 'unavailable' | 'profile' | 'patient' | null

export function Dashboard({ navigate, api }: DashboardProps) {
  return api ? (
    <LiveCarePage page="dashboard" api={api} navigate={navigate} />
  ) : (
    <DemoDashboard navigate={navigate} />
  )
}

function DemoDashboard({ navigate }: DashboardProps) {
  const params = new URLSearchParams(window.location.search)
  const initial = params.get('state')
  const [collapsed, setCollapsed] = useState(initial === 'collapsed')
  const [expanded, setExpanded] = useState(initial === 'expanded')
  const [overlay, setOverlay] = useState<Overlay>(
    initial === 'meeting' || initial === 'notifications' ? initial : null,
  )
  const [searchOpen, setSearchOpen] = useState(initial === 'search')
  const [query, setQuery] = useState(initial === 'search' ? 'Fa' : '')
  // Only the explicit design-preview URL uses the two rows in Figma 1:1629.
  // Editing the query restores search across all demo patients.
  const [searchPreview, setSearchPreview] = useState(initial === 'search')
  const [online, setOnline] = useState(navigator.onLine)
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState('')
  const [dismissed, setDismissed] = useState<number[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const searchArea = useRef<HTMLDivElement>(null)
  const notificationArea = useRef<HTMLDivElement>(null)
  const notificationButton = useRef<HTMLButtonElement>(null)
  const offline = !online || initial === 'offline'

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!searchArea.current?.contains(event.target as Node)) setSearchOpen(false)
      if (
        !notificationArea.current?.contains(event.target as Node) &&
        !notificationButton.current?.contains(event.target as Node)
      )
        setOverlay((current) => (current === 'notifications' ? null : current))
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setExpanded(false)
        setOverlay((current) => (current === 'notifications' ? null : current))
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  function unavailable(label: string) {
    if (label === 'Patients') {
      navigate('/clients')
      return
    }
    setSelected(label)
    setOverlay('unavailable')
    setExpanded(false)
  }
  const searchPatients = [
    { name: 'Fatima', image: 'dashboard-imgContainer3.png' },
    { name: 'Fadi', image: 'dashboard-imgContainer4.png', crop: 'khaled' },
  ]
  const results = (searchPreview ? searchPatients : [...sessions, ...searchPatients]).filter(
    (patient) => patient.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div
      className={`workspace visual-demo-dashboard ${collapsed ? 'is-collapsed' : ''} ${expanded ? 'is-expanded' : ''} ${offline ? 'is-offline' : ''}`}
    >
      {expanded && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setExpanded(false)}
        />
      )}
      <aside className="sidebar" aria-label="Main navigation">
        <div>
          <header className="sidebar-header">
            <Logo wordmark />
            <button
              className="icon-button collapse-button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={() => {
                setCollapsed(!collapsed)
                setExpanded(false)
              }}
            >
              <Icon name="dashboard-imgCaretDoubleHorizontal.svg" />
              <Icon name="r4-dashboard-arrows-in.svg" className="dashboard-drawer-collapse" />
            </button>
          </header>
          <nav className="navigation">
            <p className="nav-label">MAIN MENU</p>
            {menu.map((item) => (
              <button
                key={item.label}
                className={`nav-item ${item.label === 'Dashboard' ? 'active' : ''}`}
                title={item.label}
                aria-label={item.label}
                aria-current={item.label === 'Dashboard' ? 'page' : undefined}
                onClick={() =>
                  item.label === 'Dashboard'
                    ? setExpanded(false)
                    : item.label === 'Messages'
                      ? navigate('/chats')
                      : item.label === 'Sessions'
                        ? navigate('/sessions')
                        : item.label === 'Wallet'
                          ? navigate('/wallet')
                          : item.label === 'Additional Content'
                            ? navigate('/homework')
                            : unavailable(item.label)
                }
              >
                {item.label === 'Dashboard' ? (
                  <span className="icon dashboard-active-icon" aria-hidden="true" />
                ) : (
                  <Icon name={item.icon} />
                )}
                <span className="nav-text">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="client-reminder textured">
            <div>
              <p>This week</p>
              <p>You have one client without assigned content for over a week.</p>
              <button onClick={() => navigate('/sessions/upcoming')}>Client review</button>
            </div>
          </div>
          <button
            className="compact-reminder icon-button"
            aria-label="Client review"
            onClick={() => navigate('/sessions/upcoming')}
          >
            <Icon name="part2-10-imgMaterialSymbolsLightEmergencyHome.svg" />
            <i />
          </button>
          <button
            className="profile-card textured"
            aria-label="Open profile"
            onClick={() => navigate('/profile')}
          >
            <img src={asset('dashboard-imgContainer.png')} alt="Dr. Issa Alhadad" />
            <span className="profile-copy">
              <strong>Dr. Issa Alhadad</strong>
              <small>Certified Psychotherapist</small>
            </span>
            <Icon name="dashboard-imgIcon.svg" />
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded(!expanded)
                setCollapsed(false)
              }}
            >
              <Icon name="part2-11-imgMenu.svg" />
            </button>
            <h1>Dashboard</h1>
          </div>
          <div className="topbar-actions">
            <div className={`search-area ${searchOpen ? 'search-open' : ''}`} ref={searchArea}>
              <button
                className="icon-button mobile-search"
                aria-label="Open search"
                onClick={() => {
                  setSearchOpen(!searchOpen)
                  setOverlay(null)
                  requestAnimationFrame(() => searchRef.current?.focus())
                }}
              >
                <Icon name="dashboard-imgSearch.svg" />
              </button>
              <label className="search-field">
                <Icon name="dashboard-imgSearch.svg" />
                <input
                  ref={searchRef}
                  aria-label="Search patients"
                  placeholder="Search..."
                  value={query}
                  onFocus={() => {
                    setSearchOpen(true)
                    setOverlay(null)
                  }}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSearchPreview(false)
                  }}
                  autoComplete="off"
                />
              </label>
              {searchOpen && query.trim() && (
                <div className="search-results" aria-label="Search results">
                  {results.length ? (
                    results.map((patient) => (
                      <button
                        key={patient.name}
                        className={searchPreview && patient.name === 'Fadi' ? 'design-preview-hover' : undefined}
                        onClick={() => {
                          setSelected(patient.name)
                          setOverlay('patient')
                          setSearchOpen(false)
                        }}
                      >
                        <Avatar patient={patient} />
                        <span>{patient.name}</span>
                      </button>
                    ))
                  ) : (
                    <p>No patients found</p>
                  )}
                </div>
              )}
            </div>
            <button
              ref={notificationButton}
              className="icon-button notification-button"
              aria-label="Notifications"
              aria-expanded={overlay === 'notifications'}
              aria-controls="notifications-panel"
              onClick={() => {
                setOverlay(overlay === 'notifications' ? null : 'notifications')
                setSearchOpen(false)
              }}
            >
              <Icon name="dashboard-imgNotification.svg" />
            </button>
          </div>
        </header>
        {offline && (
          <div className="offline-banner" role="status">
            <WifiSlashIcon />You’re offline. Some data may not be up to date.
          </div>
        )}
        <div className="hero-section">
          <section className="dashboard-hero textured" aria-label="Today’s overview">
            <div className="hero-copy">
              <div className="greeting">
                <p>Good morning!</p>
                <h2>Dr. khaled Alshamy</h2>
                <p>you have 3 sessions for today!</p>
              </div>
              <div className="hero-rating">
                <span>
                  Rating: <b className="dashboard-rating-stars" aria-label="5 stars">
                    {Array.from({ length: 5 }, (_, index) => (
                      <svg key={index} aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M5.7625 1.1475C5.78441 1.10323 5.81826 1.06597 5.86023 1.03991C5.90219 1.01386 5.9506 1.00005 6 1.00005C6.0494 1.00005 6.09781 1.01386 6.13977 1.03991C6.18174 1.06597 6.21559 1.10323 6.2375 1.1475L7.3925 3.487C7.46859 3.64098 7.58091 3.7742 7.71981 3.87523C7.85872 3.97625 8.02006 4.04206 8.19 4.067L10.773 4.445C10.8219 4.45209 10.8679 4.47274 10.9057 4.5046C10.9436 4.53646 10.9717 4.57827 10.987 4.6253C11.0023 4.67233 11.0041 4.7227 10.9923 4.77072C10.9805 4.81873 10.9554 4.86248 10.92 4.897L9.052 6.716C8.92881 6.83605 8.83664 6.98424 8.78342 7.14781C8.7302 7.31139 8.71753 7.48544 8.7465 7.655L9.1875 10.225C9.19614 10.2739 9.19086 10.3243 9.17225 10.3703C9.15364 10.4164 9.12247 10.4563 9.08227 10.4855C9.04208 10.5147 8.99449 10.532 8.94493 10.5354C8.89538 10.5389 8.84585 10.5283 8.802 10.505L6.493 9.291C6.34086 9.21111 6.17159 9.16938 5.99975 9.16938C5.82791 9.16938 5.65864 9.21111 5.5065 9.291L3.198 10.505C3.15417 10.5282 3.1047 10.5386 3.05523 10.5351C3.00575 10.5316 2.95826 10.5143 2.91815 10.4851C2.87804 10.4559 2.84692 10.4161 2.82833 10.3701C2.80974 10.3241 2.80443 10.2739 2.813 10.225L3.2535 7.6555C3.2826 7.48587 3.26999 7.3117 3.21677 7.14802C3.16355 6.98435 3.0713 6.83608 2.948 6.716L1.08 4.8975C1.0443 4.86302 1.019 4.8192 1.00698 4.77104C0.994966 4.72288 0.996719 4.67231 1.01204 4.6251C1.02736 4.57788 1.05563 4.53592 1.09364 4.50399C1.13164 4.47206 1.17785 4.45145 1.227 4.4445L3.8095 4.067C3.97963 4.04225 4.14119 3.97653 4.28029 3.87549C4.41939 3.77446 4.53185 3.64114 4.608 3.487L5.7625 1.1475Z" fill="#ffdf20" stroke="#ffdf20" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ))}
                  </b>
                </span>
                <span>Attendance Rate: 95%</span>
              </div>
            </div>
            <div className="next-session">
              <p className="eyebrow">YOUR NEXT SESSION</p>
              <div className="next-patient">
                <div className="initials">AM</div>
                <div>
                  <h3>Ahmed Mohamed</h3>
                  <p>One-on-one session · Today 10:00 AM</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setStatus('')
                  setOverlay('meeting')
                }}
                disabled={offline}
              >
                <Icon name="dashboard-imgIcon2.svg" />
                Start session
              </button>
            </div>
            <img className="hero-illustration" src={asset('dashboard-imgImage1988.png')} alt="" />
          </section>
        </div>
        <section className="metrics" aria-label="Practice statistics">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span className={`featured-icon ${metric.glass ? 'has-glass' : ''}`}>
                <span>
                  <Icon name={metric.icon} />
                </span>
              </span>
              <div className="metric-data">
                <h2>
                  {metric.label}
                  {metric.label === 'Active users' && <span className="metric-current"> now</span>}
                </h2>
                <div>
                  <strong>{metric.value}</strong>
                  <span className={`metric-change ${metric.negative ? 'negative' : ''}`}>
                    <Icon
                      name={
                        metric.negative
                          ? 'dashboard-imgTrendUpIcon1.svg'
                          : 'dashboard-imgTrendUpIcon.svg'
                      }
                    />
                    {metric.change}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
        <section className="sessions-section" aria-labelledby="sessions-heading">
          <div className="sessions-card">
            <header>
              <h2 id="sessions-heading">Upcoming Sessions</h2>
              <button className="see-all" onClick={() => navigate('/sessions')}>
                See all
                <Icon name="dashboard-imgIcon5.svg" />
              </button>
            </header>
            <table>
              <thead>
                <tr>
                  <th scope="col">Patient Name</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((patient) => (
                  <tr key={patient.name}>
                    <td>
                      <button
                        className="patient-cell"
                        onClick={() => {
                          setSelected(patient.name)
                          setOverlay('patient')
                        }}
                      >
                        <Avatar patient={patient} />
                        <span>
                          <span className="patient-name">{patient.name}</span>
                          <small>Private Session</small>
                        </span>
                      </button>
                    </td>
                    <td className="session-date">
                      {patient.date}, {patient.time}
                    </td>
                    <td>
                      <span className={`session-status ${patient.status}`}>
                        {patient.status === 'ready'
                          ? 'Is ready'
                          : patient.status === 'canceled'
                            ? 'Canceled'
                            : 'Not sure'}
                        <Icon
                          name={
                            patient.status === 'ready'
                              ? 'dashboard-imgStatusIcon.svg'
                              : patient.status === 'canceled'
                                ? 'dashboard-imgIcon6.svg'
                                : 'dashboard-imgLoaderIcon.svg'
                          }
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {overlay === 'notifications' && (
        <div
          ref={notificationArea}
          className="notifications-panel"
          id="notifications-panel"
          role="region"
          aria-label="Notifications"
        >
          <header>
            <h2>Notifications</h2>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => {
                setOverlay(null)
                notificationButton.current?.focus()
              }}
            >
              <DashboardCloseIcon />
            </button>
          </header>
          <div className="notifications-list">
            {notifications
              .filter((item) => !dismissed.includes(item.id))
              .map((item) => (
                <article
                  className={`notification-item demo-notification-${item.id}`}
                  key={item.id}
                >
                  <div className="notification-avatar">
                    {item.id === 3 ? (
                      <svg className="notification-system-avatar" viewBox="0 0 36 36" aria-hidden="true">
                        <circle cx="18" cy="18" r="18" fill="#303030" />
                        <path d="M27 33c-1-7-4-10-8-10l-1-3c2-1 3-4 3-7 0-4-2-6-5-6s-5 3-5 6c0 3 1 6 3 7l-1 3c-4 1-6 4-7 10" fill="#fff" />
                      </svg>
                    ) : <img src={asset(item.id === 6 ? 'notification-imgImage2.png' : item.image)} alt="" />}
                    <span>
                      <Icon name={item.icon} />
                    </span>
                  </div>
                  <div className="notification-body">
                    <div className="notification-title">
                      <p>
                        <strong>{item.title}</strong>{' '}
                        {item.detail.split(/("[^"]+")/).map((part, index) =>
                          part.startsWith('"') ? (
                            <strong key={index}><em>{part}</em></strong>
                          ) : <span key={index}>{part}</span>,
                        )}{' '}
                        <time>{item.time}</time>
                      </p>
                    </div>
                    <p>
                      {item.description.startsWith('@harper ') ? (
                        <><strong className="notification-mention">@harper</strong>{item.description.slice('@harper'.length)}</>
                      ) : item.description}
                    </p>
                    {item.action && (
                      <div className="notification-actions">
                        <button
                          onClick={() => {
                            if (item.action === 'Accept') setDismissed([...dismissed, item.id])
                            else unavailable(item.action!)
                            setStatus(item.action === 'Accept' ? 'Demo invitation accepted.' : '')
                          }}
                        >
                          {item.action}
                        </button>
                        {item.action === 'Accept' && (
                          <button onClick={() => setDismissed([...dismissed, item.id])}>
                            Decline
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {item.id <= 2 && <span className="demo-unread-dot" aria-label="Unread" />}
                </article>
              ))}
          </div>
          <footer>
            <span>Powered by</span> <Logo wordmark />
          </footer>
          {status && (
            <p role="status" className="notification-feedback">
              {status}
            </p>
          )}
        </div>
      )}
      {overlay === 'meeting' && (
        <Modal
          title="let’s join the Meeting!"
          className="dashboard-meeting-modal"
          closeIcon={<DashboardCloseIcon />}
          onClose={() => setOverlay(null)}
        >
          <label className="meeting-label">
            Meeting URL
            <div className="meeting-url">
              <textarea
                aria-label="Meeting URL"
                readOnly
                rows={1}
                value="https://meet.google.com/kxx-eyzx-dew?author=0"
              />
              <button
                className="icon-button"
                aria-label="Copy meeting URL"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      'https://meet.google.com/kxx-eyzx-dew?author=0',
                    )
                    setStatus('Demo URL copied.')
                  } catch {
                    setStatus('Copy is unavailable. Select the URL and copy it manually.')
                  }
                }}
              >
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <g transform="translate(6 4)">
                    <path d="M8 2.5H2C1.17157 2.5 0.5 3.17157 0.5 4V14C0.5 14.8284 1.17157 15.5 2 15.5H8C8.82843 15.5 9.5 14.8284 9.5 14V4C9.5 3.17157 8.82843 2.5 8 2.5Z" stroke="black" />
                    <path d="M2.5 2C2.5 1.60218 2.65804 1.22064 2.93934 0.93934C3.22064 0.658035 3.60218 0.5 4 0.5H10C10.3978 0.5 10.7794 0.658035 11.0607 0.93934C11.342 1.22064 11.5 1.60218 11.5 2V12C11.5 12.3978 11.342 12.7794 11.0607 13.0607C10.7794 13.342 10.3978 13.5 10 13.5" stroke="black" />
                  </g>
                </svg>
              </button>
            </div>
          </label>
          <button
            className="primary-button"
            onClick={() => setStatus('Demo only: no live meeting service is connected.')}
          >
            Join meeting
          </button>
          {status && (
            <p className="modal-status" role="status">
              {status}
            </p>
          )}
        </Modal>
      )}
      {overlay === 'unavailable' && (
        <Modal title={selected} onClose={() => setOverlay(null)}>
          <p>
            This page is not in the first Figma file. It will be added when the remaining designs
            are provided.
          </p>
        </Modal>
      )}
      {overlay === 'patient' && (
        <Modal title={selected} onClose={() => setOverlay(null)}>
          <p>Private Session · Demo patient record</p>
          <p>The full patient page is not included in the first design file.</p>
        </Modal>
      )}
      {overlay === 'profile' && (
        <Modal title="Dr. Issa Alhadad" onClose={() => setOverlay(null)}>
          <p>Certified Psychotherapist</p>
          <p>This is a frontend demo. No authenticated session is stored.</p>
          <button className="primary-button" onClick={() => navigate('/login')}>
            Back to login
          </button>
        </Modal>
      )}
      <DemoNetworkToggle />
    </div>
  )
}

function WifiSlashIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <g fill="#d97706">
        <g opacity=".3">
          <path d="M3.35013 4.41079C2.50036 4.86508 1.71172 5.41858 0.999822 6.05575C0.691177 6.33199 0.664911 6.80614 0.941156 7.11479C1.2174 7.42343 1.69155 7.4497 2.00019 7.17345C2.73628 6.51464 3.56555 5.95825 4.46587 5.52653L3.35013 4.41079Z" />
          <path d="M6.183 7.24366C5.16312 7.61418 4.23696 8.18 3.45026 8.8956C3.14385 9.17432 3.1214 9.64867 3.40012 9.95508C3.67884 10.2615 4.15318 10.2839 4.45959 10.0052C5.27695 9.26173 6.27657 8.71649 7.38389 8.44455L6.183 7.24366Z" />
          <path d="M9.4629 10.5236C9.3107 10.508 9.15627 10.5 9.00001 10.5C7.83482 10.5 6.77155 10.9438 5.9728 11.6704C5.66639 11.9491 5.64394 12.4235 5.92266 12.7299C6.20138 13.0363 6.67572 13.0587 6.98213 12.78C7.51555 12.2948 8.22248 12 9.00001 12C9.77754 12 10.4845 12.2948 11.0179 12.78C11.2493 12.9905 11.5765 13.0292 11.8429 12.9036L9.4629 10.5236Z" />
          <path d="M6.43533 3.27481L7.73579 4.57527C8.15022 4.52557 8.57211 4.5 9.00001 4.5C11.6897 4.5 14.1417 5.51037 15.9998 7.17345C16.3085 7.4497 16.7826 7.42343 17.0589 7.11479C17.3351 6.80614 17.3088 6.33199 17.0002 6.05575C14.8777 4.15604 12.0729 3 9.00001 3C8.11987 3 7.26173 3.09483 6.43533 3.27481Z" />
          <path d="M12.2341 9.07355L9.96659 6.80607C11.7215 7.01103 13.3091 7.76706 14.5498 8.8956C14.8562 9.17432 14.8786 9.64867 14.5999 9.95508C14.3212 10.2615 13.8468 10.2839 13.5404 10.0052C13.1448 9.64539 12.7066 9.332 12.2341 9.07355Z" />
          <path d="M8.25001 15C8.25001 14.5858 8.58579 14.25 9.00001 14.25H9.00751C9.42172 14.25 9.75751 14.5858 9.75751 15C9.75751 15.4142 9.42172 15.75 9.00751 15.75H9.00001C8.58579 15.75 8.25001 15.4142 8.25001 15Z" />
        </g>
        <path fillRule="evenodd" clipRule="evenodd" d="M1.71967 1.71967C2.01256 1.42678 2.48744 1.42678 2.78033 1.71967L16.2803 15.2197C16.5732 15.5126 16.5732 15.9874 16.2803 16.2803C15.9874 16.5732 15.5126 16.5732 15.2197 16.2803L1.71967 2.78033C1.42678 2.48744 1.42678 2.01256 1.71967 1.71967Z" />
      </g>
    </svg>
  )
}

function DashboardCloseIcon() {
  return (
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 20 20" fill="none">
      <path d="M6.28033 5.21967C5.98744 4.92678 5.51256 4.92678 5.21967 5.21967C4.92678 5.51256 4.92678 5.98744 5.21967 6.28033L8.93934 10L5.21967 13.7197C4.92678 14.0126 4.92678 14.4874 5.21967 14.7803C5.51256 15.0732 5.98744 15.0732 6.28033 14.7803L10 11.0607L13.7197 14.7803C14.0126 15.0732 14.4874 15.0732 14.7803 14.7803C15.0732 14.4874 15.0732 14.0126 14.7803 13.7197L11.0607 10L14.7803 6.28033C15.0732 5.98744 15.0732 5.51256 14.7803 5.21967C14.4874 4.92678 14.0126 4.92678 13.7197 5.21967L10 8.93934L6.28033 5.21967Z" fill="#2f2f2f" />
    </svg>
  )
}

export function Avatar({ patient }: { patient: Pick<Session, 'name' | 'image' | 'crop'> }) {
  return (
    <span className={`avatar ${patient.crop ?? ''}`}>
      <img src={asset(patient.image)} alt="" />
    </span>
  )
}
