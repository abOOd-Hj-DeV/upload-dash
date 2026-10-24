import { useState, type FormEvent } from 'react'
import { apiId, type ApiClient } from './api'
import { useApiUser } from './api-hooks'
import { DesignIcon, Workspace } from './Workspace'
import {
  CareAvatar,
  MutationStatus,
  ResourceStatus,
  careDate,
  careInstant,
  useCareMutation,
  useCareResource,
  type CareClient,
  type CareContent,
  type CareSession,
} from './api-sessions-and-clinical-support'
import './visual-client-profile.css'

type ClientRead = {
  client: { id: string; full_name: string; age: number; gender: string; language: string }
  clinical: {
    assessment_score: number
    safety_flag: boolean
    compliance_level: string | null
    latest_assessment: { type: string; score: number; completed_at: string | null } | null
  }
  sessions: CareSession[]
  stats: { total_sessions: number; completed: number; cancelled: number }
}
type NotesRead = {
  notes: { id: string; body: string; created_at: string | null }[]
  session_reports: { session_id: string; session_date: string | null; summary: string }[]
}
type Tab = 'overview' | 'sessions' | 'notes' | 'content'
type Props = { api: ApiClient; navigate: (path: string) => void }

export function ClientProfile({ api, navigate }: Props) {
  const user = useApiUser(api)
  let patientId: string | null = null
  try {
    patientId = apiId(new URLSearchParams(window.location.search).get('id') || '')
  } catch {
    // Never use an untrusted route value in an API path.
  }
  if (!user || user.role !== 'therapist' || !user.is_active || !user.phone_verified_at)
    return <p role="alert">Sign in with an active therapist account to view clients.</p>
  if (!patientId)
    return (
      <Workspace title="Manage Clients / Profiles" active="Clients" api={api} navigate={navigate}>
        <p role="alert" className="client-profile-invalid">Select a client from your client list.</p>
      </Workspace>
    )
  return (
    <ClientProfileContent
      key={`${api.getSessionKey()}:${patientId}`}
      api={api}
      navigate={navigate}
      patientId={patientId}
    />
  )
}

function ClientProfileContent({ api, navigate, patientId }: Props & { patientId: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [filter, setFilter] = useState('All')
  const [note, setNote] = useState('')
  const clients = useCareResource<CareClient[]>(api, '/therapists/clients?per_page=100', 'pages')
  const relationship = clients.data?.find((item) => item.id === patientId)
  const active = relationship?.status === 'active' && !clients.loading && !clients.error
  const base = `/therapists/clients/${patientId}`
  const profile = useCareResource<ClientRead>(api, active ? base : null)
  const notes = useCareResource<NotesRead>(api, active && tab === 'notes' ? `${base}/notes` : null)
  const content = useCareResource<CareContent[]>(
    api,
    active && tab === 'content' ? `/therapists/content?patient_id=${patientId}&per_page=100` : null,
    'content',
  )
  const mutation = useCareMutation(api, notes.reload)
  const sameClient = !profile.data || profile.data.client.id === patientId
  const ready = active && sameClient && !!profile.data && !profile.loading && !profile.error
  const notesReady = !!notes.data && !notes.loading && !notes.error
  const sessions = profile.data?.sessions ?? []
  const today = Date.now()
  const sessionRows = sessions.filter((item) => {
    if (filter === 'All') return true
    if (filter === 'Completed') return item.status === 'completed'
    if (filter === 'Cancelled') return item.status === 'cancelled'
    return ['pending', 'confirmed'].includes(item.status) && (careInstant(item) ?? 0) >= today
  })
  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (!ready || !notesReady || mutation.disabled || note.trim().length < 3 || note.trim().length > 5000) return
    await mutation.run(`${base}/notes`, { body: note.trim() }, {
      onSuccess: () => setNote(''),
      success: 'Private therapist note added on the server.',
    })
  }
  return (
    <Workspace
      title="Manage Clients / Profiles"
      mobileTitle="Manage Clients / Profile"
      active="Clients"
      api={api}
      navigate={navigate}
    >
      <div className="client-profile-layout">
        <aside className="client-profile-summary">
          <div className="client-profile-identity">
            <CareAvatar name={relationship?.full_name || 'Client'} detail />
            <div>
              <h2>{relationship?.full_name || 'Client'}</h2>
              {ready && <p>Age {profile.data?.client.age} · {profile.data?.client.gender}</p>}
            </div>
          </div>
          <button
            className="teal-button client-profile-contact"
            disabled={!active}
            onClick={() => navigate(`/chats?client=${patientId}`)}
          >
            Contact patient
          </button>
          <div className="client-profile-actions">
            <button className="soft-button" disabled title="Therapist booking is not supported by the API">
              Schedule
            </button>
            <button className="soft-button" disabled title="Calling is not available in the API">
              Call
            </button>
          </div>
          <h3>Contact Information</h3>
          <p className="client-profile-unavailable">Contact details are not supplied by the therapist API.</p>
          <h3>Subscription</h3>
          <p className="client-profile-unavailable">Subscription details are not supplied by the therapist API.</p>
        </aside>
        <div className="client-profile-content">
          <div className="client-profile-tabs" role="tablist" aria-label="Client profile sections">
            {([
              ['overview', 'Overview'],
              ['sessions', 'Sessions'],
              ['notes', 'Notes'],
              ['content', 'Custom Content'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? 'selected' : ''}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <ResourceStatus resource={clients} label="clients" />
          {!clients.loading && !clients.error && !relationship && (
            <p role="alert">This client is not in your current client list.</p>
          )}
          {relationship?.status === 'past' && (
            <p role="alert">Current clinical information is unavailable for a former client.</p>
          )}
          <ResourceStatus resource={profile} label="client profile" />
          {!sameClient && <p role="alert">The returned profile does not match this client.</p>}
          {ready && tab === 'overview' && profile.data && (
            <div className="client-profile-overview">
              <div className="client-profile-stats">
                <div><strong>{profile.data.stats.total_sessions}</strong><span>Total Sessions</span></div>
                <div><strong>{profile.data.stats.completed}</strong><span>Completed Sessions</span></div>
                <div><strong>{profile.data.stats.cancelled}</strong><span>Cancelled Sessions</span></div>
              </div>
              <div className="client-profile-clinical">
                <div><span>Assessment score</span><strong>{profile.data.clinical.assessment_score}</strong></div>
                <div><span>Compliance</span><strong>{profile.data.clinical.compliance_level || 'Unavailable'}</strong></div>
                <div><span>Safety flag</span><strong>{profile.data.clinical.safety_flag ? 'Flagged' : 'Not flagged'}</strong></div>
                {profile.data.clinical.latest_assessment && (
                  <div><span>Latest assessment · {profile.data.clinical.latest_assessment.type}</span><strong>{profile.data.clinical.latest_assessment.score}</strong></div>
                )}
                <p>Progress charts and clinical conclusions are not supplied by the API.</p>
              </div>
            </div>
          )}
          {ready && tab === 'sessions' && (
            <div className="client-profile-sessions">
              <div className="client-profile-session-controls">
                <div role="group" aria-label="Filter client sessions">
                  {['All', 'Upcoming', 'Completed', 'Cancelled'].map((value) => (
                    <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>
                  ))}
                </div>
                <button className="teal-button" disabled title="Therapist booking is not supported by the API">Schedule session</button>
              </div>
              {!sessionRows.length && <p className="client-profile-empty">No {filter.toLowerCase()} sessions available.</p>}
              {sessionRows.map((session) => (
                <button
                  key={session.id}
                  className={`client-profile-session client-profile-session-${session.status}`}
                  onClick={() => navigate(`/sessions/upcoming?id=${apiId(session.id)}`)}
                >
                  <span className="client-profile-session-mark" aria-hidden="true"><DesignIcon name="part2-07-imgCalendarAlt.svg" /></span>
                  <span className="client-profile-session-copy"><strong>{session.is_initial ? 'Initial consultation' : 'Therapy session'}</strong><small>{careDate(session, api.getUser()?.timezone || 'UTC')} · {session.medium}</small></span>
                  <span className="client-profile-session-status">{session.status}</span>
                </button>
              ))}
            </div>
          )}
          {active && tab === 'notes' && (
            <div className="client-profile-notes">
              <ResourceStatus resource={notes} label="private notes" />
              <form onSubmit={(event) => void addNote(event)} className="client-profile-note-form">
                <label htmlFor="client-note">New Note</label>
                <textarea
                  id="client-note"
                  placeholder="Type your note here..."
                  value={note}
                  maxLength={5000}
                  onChange={(event) => setNote(event.target.value)}
                />
                <button className="teal-button" disabled={!ready || !notesReady || mutation.disabled || note.trim().length < 3}>Add Note</button>
              </form>
              <MutationStatus mutation={mutation} refreshed={notesReady} />
              <h3>Previous Notes</h3>
              {notesReady && !notes.data?.notes.length && <p>No private notes yet.</p>}
              {notes.data?.notes.map((item) => (
                <article className="client-profile-note" key={item.id}>
                  <strong>Private therapist note</strong>
                  {item.created_at && <time dateTime={item.created_at}>{item.created_at.slice(0, 10)}</time>}
                  <p>{item.body}</p>
                </article>
              ))}
              {!!notes.data?.session_reports.length && <h3>Session reports (patient-visible)</h3>}
              {notes.data?.session_reports.map((item) => (
                <article className="client-profile-note" key={item.session_id}>
                  <strong>Session report</strong>
                  {item.session_date && <time dateTime={item.session_date}>{item.session_date}</time>}
                  <p>{item.summary}</p>
                </article>
              ))}
            </div>
          )}
          {active && tab === 'content' && (
            <div className="client-profile-content-list">
              <ResourceStatus resource={content} label="assigned content" />
              <h3>Custom Content</h3>
              {!content.loading && !content.error && !content.data?.length && <p>No assigned content yet.</p>}
              {content.data?.map((item) => <article key={item.id} className="client-profile-note"><strong>{item.title}</strong><p>{item.content_type}</p></article>)}
            </div>
          )}
        </div>
      </div>
    </Workspace>
  )
}
