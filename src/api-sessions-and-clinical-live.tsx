import { useEffect, useState } from 'react'
import { ApiClient, apiId } from './api'
import { useApiUser } from './api-hooks'
import { Workspace } from './Workspace'
import { LiveCareRecord } from './api-sessions-and-clinical-record'
import {
  CareAvatar,
  CareStatus,
  ResourceStatus,
  careCategory,
  careDate,
  careInstant,
  careMeetingUrl,
  useCareOnline,
  useCareResource,
  type CareClient,
  type CareSession,
} from './api-sessions-and-clinical-support'

type Props = { api: ApiClient; navigate: (path: string) => void }
type DashboardData = {
  therapist: { id: string; full_name: string; rating: number; approval_status: string | null }
  clients_count: number
  clients_limit: number
  can_accept_clients: boolean
  stats: { pending: number; confirmed: number; completed: number; today: number }
  timezone: string
}

export function LiveCarePage({
  api,
  navigate,
  page,
}: Props & { page: 'dashboard' | 'sessions' | 'detail' }) {
  const user = useApiUser(api)
  // This boundary immediately unmounts datasets and drafts when credentials or actor change.
  if (!user || user.role !== 'therapist' || !user.is_active || !user.phone_verified_at)
    return <p role="alert">Sign in with an active, verified therapist account to view this page.</p>
  return page === 'detail' ? (
    <LiveCareRecord
      key={`${api.getSessionKey()}:${window.location.search}`}
      api={api}
      navigate={navigate}
    />
  ) : (
    <LiveCareOverview
      key={`${api.getSessionKey()}:${page}`}
      api={api}
      navigate={navigate}
      dashboard={page === 'dashboard'}
    />
  )
}

function LiveCareOverview({ api, navigate, dashboard }: Props & { dashboard: boolean }) {
  const overview = useCareResource<DashboardData>(
    api,
    dashboard ? '/therapists/me/dashboard' : null,
  )
  const sessions = useCareResource<CareSession[]>(
    api,
    '/therapists/me/sessions?per_page=50',
    'pages',
  )
  const clients = useCareResource<CareClient[]>(api, '/therapists/clients?per_page=100', 'pages')
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(Date.now())
  const online = useCareOnline()
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const timezone = overview.data?.timezone || api.getUser()?.timezone || 'UTC'
  const clientById = new Map(clients.data?.map((client) => [client.id, client]))
  const items = sessions.data ?? []
  const nameFor = (session: CareSession) =>
    clientById.get(session.patient_id)?.full_name || 'Client identity unavailable'
  const complete =
    !!sessions.data &&
    !!clients.data &&
    !sessions.loading &&
    !clients.loading &&
    !sessions.error &&
    !clients.error
  const upcoming = items
    .filter(
      (session) =>
        ['pending', 'confirmed'].includes(session.status) && (careInstant(session) ?? 0) >= now,
    )
    .sort((a, b) => (careInstant(a) ?? 0) - (careInstant(b) ?? 0))
  const filtered = (dashboard ? upcoming.slice(0, 10) : items).filter(
    (session) =>
      (dashboard || tab === 'All' || careCategory(session, timezone, now) === tab) &&
      nameFor(session).toLowerCase().includes(query.trim().toLowerCase()),
  )
  const next = upcoming[0]
  const nextLink = next ? careMeetingUrl(next) : null
  const open = (session: CareSession) => {
    try {
      navigate(`/sessions/upcoming?id=${apiId(session.id)}`)
    } catch {
      /* Malformed server IDs never become routes. */
    }
  }
  const listHeader = (
    <header>
      <h2>
        {dashboard ? 'Upcoming Sessions' : tab === 'All' ? 'All Sessions' : `${tab} Sessions`}
      </h2>
      {dashboard && (
        <button className="see-all" onClick={() => navigate('/sessions')}>
          See all
        </button>
      )}
    </header>
  )
  return (
    <Workspace
      title={dashboard ? 'Dashboard' : 'Sessions'}
      active={dashboard ? 'Dashboard' : 'Sessions'}
      api={api}
      navigate={navigate}
      onSearch={setQuery}
    >
      {dashboard && (
        <>
          <ResourceStatus resource={overview} label="dashboard" />
          {overview.data && (
            <>
              <div className="hero-section">
                <section className="dashboard-hero textured" aria-label="Today’s overview">
                  <div className="hero-copy">
                    <div className="greeting">
                      <p>Welcome back</p>
                      <h2>{overview.data.therapist.full_name}</h2>
                      <p>
                        You have {overview.data.stats.today} pending or confirmed sessions today.
                      </p>
                    </div>
                    <div className="hero-rating">
                      <span>Rating: {overview.data.therapist.rating}</span>
                      <span>{timezone}</span>
                    </div>
                  </div>
                  <div className="next-session">
                    <p className="eyebrow">YOUR NEXT SESSION</p>
                    {complete && next ? (
                      <>
                        <div className="next-patient">
                          <CareAvatar name={nameFor(next)} hero />
                          <div>
                            <h3>{nameFor(next)}</h3>
                            <p>
                              {careDate(next, timezone)} · {next.medium}
                            </p>
                          </div>
                        </div>
                        <button className="teal-button" onClick={() => open(next)}>
                          View session
                        </button>
                        {nextLink && online && (
                          <a
                            className="teal-button"
                            href={nextLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                          >
                            Join meeting
                          </a>
                        )}
                      </>
                    ) : (
                      <p>
                        {complete
                          ? 'No upcoming sessions.'
                          : 'Upcoming sessions are not yet available.'}
                      </p>
                    )}
                  </div>
                </section>
              </div>
              <section className="metrics" aria-label="Practice statistics">
                {[
                  ['Active clients', overview.data.clients_count],
                  ['Pending sessions', overview.data.stats.pending],
                  ['Confirmed sessions', overview.data.stats.confirmed],
                  ['Completed sessions', overview.data.stats.completed],
                ].map(([label, value]) => (
                  <article className="metric" key={label}>
                    <div className="metric-data">
                      <h2>{label}</h2>
                      <strong>{value}</strong>
                    </div>
                  </article>
                ))}
              </section>
              <p className="section-caption">
                Client capacity: {overview.data.clients_count} / {overview.data.clients_limit}.{' '}
                {overview.data.can_accept_clients
                  ? 'Can accept clients.'
                  : 'Cannot currently accept clients.'}
              </p>
            </>
          )}
        </>
      )}
      <ResourceStatus resource={sessions} label="sessions" />
      <ResourceStatus resource={clients} label="client identities" />
      {!dashboard && (
        <div className="sessions-toolbar">
          <div className="session-tabs" role="tablist" aria-label="Session filters">
            {['All', 'Previous', 'Upcoming', 'Today'].map((label) => (
              <button
                key={label}
                role="tab"
                aria-selected={label === tab}
                className={label === tab ? 'selected' : ''}
                onClick={() => setTab(label)}
              >
                {label}
                {complete && (
                  <span>
                    {' '}
                    (
                    {
                      items.filter(
                        (session) =>
                          label === 'All' || careCategory(session, timezone, now) === label,
                      ).length
                    }
                    )
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            className="teal-button"
            disabled
            title="Only patients can book sessions through this API."
          >
            Schedule New
          </button>
        </div>
      )}
      {!dashboard && (
        <p className="section-caption">
          Therapists cannot book sessions or propose new reschedule times. Patients request these
          changes. Filters and search cover all loaded pages in {timezone}.
        </p>
      )}
      {complete && (
        <section
          className={dashboard ? 'sessions-section' : 'all-sessions'}
          aria-label={dashboard ? 'Upcoming Sessions' : 'All Sessions'}
        >
          {!dashboard && listHeader}
          <div className={dashboard ? 'sessions-card' : 'sessions-list-scroll'}>
            {dashboard && listHeader}
            <table className="all-sessions-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <button className="patient-cell" onClick={() => open(session)}>
                        <CareAvatar name={nameFor(session)} />
                        <span>
                          <span className="patient-name">{nameFor(session)}</span>
                          <small>
                            {session.is_initial ? 'Initial session' : 'Session'} · {session.medium}{' '}
                            · Payment: {session.payment_status}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td className="session-date">{careDate(session, timezone)}</td>
                    <td>
                      <button
                        aria-label={`Open session for ${nameFor(session)}`}
                        onClick={() => open(session)}
                      >
                        <CareStatus status={session.status} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <p className="empty-result">No sessions found.</p>}
          </div>
        </section>
      )}
    </Workspace>
  )
}
