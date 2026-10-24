import { useEffect, useState, type FormEvent } from 'react'
import { ApiClient, apiId, safeExternalUrl } from './api'
import { Workspace } from './Workspace'
import { Modal } from './ui'
import {
  CareAvatar,
  CareStatus,
  MutationStatus,
  ResourceStatus,
  careDate,
  careInstant,
  careMeetingUrl,
  useCareMutation,
  useCareOnline,
  useCareResource,
  type CareClient,
  type CareContent,
  type CareSession,
} from './api-sessions-and-clinical-support'

type Props = { api: ApiClient; navigate: (path: string) => void }
type SessionRead = {
  session: CareSession
  status_log: {
    id: string
    from_status: string | null
    to_status: string
    created_at: string
    actor: { name: string } | null
  }[]
}
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
  notes: { id: string; session_id: string | null; body: string; created_at: string | null }[]
  session_reports: { session_id: string; session_date: string | null; summary: string }[]
}
type CareModule = {
  id: string
  title: string
  is_hideable: boolean
  is_hidden: boolean
  locked: boolean
  lock_reason: string | null
  status: 'pending' | 'completed'
  homework_prompt: string | null
  homework: Record<string, string | null> | (string | null)[] | null
  homework_submitted_at: string | null
  completed_at: string | null
}
type ModulesRead = {
  patient_id: string
  has_active_subscription: boolean
  programs: { id: string; name: string; modules: CareModule[] }[]
}
type Recommendation = {
  note: string | null
  revision: number
  package: { id: string; name: string } | null
  program: { id: string; name: string } | null
}
function validId(value: string | null) {
  if (!value) return null
  try {
    return apiId(value)
  } catch {
    return null
  }
}

export function LiveCareRecord({ api, navigate }: Props) {
  const params = new URLSearchParams(window.location.search)
  const rawSessionId = params.get('id')
  const sessionId = validId(rawSessionId)
  // A session always determines its own patient. Never trust a separate name/client query.
  const directClientId = rawSessionId ? null : validId(params.get('client'))
  const validRoute = !!sessionId || !!directClientId
  const sessions = useCareResource<SessionRead>(api, sessionId ? `/sessions/${sessionId}` : null)
  const clients = useCareResource<CareClient[]>(
    api,
    validRoute ? '/therapists/clients?per_page=100' : null,
    'pages',
  )
  const session = sessions.data?.session
  const owned = !session || session.therapist_id === api.getUser()?.id
  const patientId = sessionId ? validId(session?.patient_id ?? null) : directClientId
  const client = clients.data?.find((item) => item.id === patientId)
  const timezone = api.getUser()?.timezone || 'UTC'
  const [tab, setTab] = useState(rawSessionId ? 'before' : 'record')
  const ready =
    !!clients.data &&
    !clients.loading &&
    !clients.error &&
    (!sessionId || (!!session && !sessions.loading && !sessions.error)) &&
    owned
  return (
    <Workspace
      title={sessionId ? 'Sessions / Session record' : 'Patients / Clinical record'}
      active={sessionId ? 'Sessions' : 'Clients'}
      api={api}
      navigate={navigate}
    >
      {!validRoute && (
        <p role="alert">
          Select a real session or client from your owned records. A valid UUID is required.
        </p>
      )}
      <ResourceStatus resource={sessions} label="session" />
      <ResourceStatus resource={clients} label="clients" />
      {!owned && <p role="alert">This session is not owned by the signed-in therapist.</p>}
      {validRoute && owned && patientId && (
        <div
          className={`session-detail care-session-detail ${tab === 'record' ? 'show-record' : ''}`}
        >
          <div className="detail-tabs segmented-control" role="tablist" aria-label="Session view">
            {['before', 'record'].map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? 'selected' : ''}
                onClick={() => setTab(value)}
              >
                {value === 'before' ? 'Before session' : 'Session record'}
              </button>
            ))}
          </div>
          <header className="detail-header">
            <div className="detail-client">
              <CareAvatar name={client?.full_name || 'Client'} detail />
              <div>
                <h2>{client?.full_name || 'Client identity unavailable'}</h2>
                <p>
                  {session ? careDate(session, timezone) : 'Clinical record · No session selected'}
                </p>
                {session && (
                  <>
                    <CareStatus status={session.status} />
                    <p>
                      {session.medium} · Payment: {session.payment_status} · Price: {session.price}{' '}
                      (currency not supplied by API)
                    </p>
                  </>
                )}
              </div>
            </div>
            <button className="soft-button" onClick={() => navigate('/sessions')}>
              Back to sessions
            </button>
          </header>
          {session && (
            <SessionEditor
              api={api}
              session={session}
              ready={ready}
              currentClient={client?.status === 'active'}
              refresh={() => {
                sessions.reload()
                clients.reload()
              }}
            />
          )}
          {client?.status === 'active' ? (
            <ClinicalEditor
              key={patientId}
              api={api}
              patientId={patientId}
              client={client}
              session={session}
              ready={ready}
              tab={tab}
              navigate={navigate}
              refreshClients={clients.reload}
            />
          ) : (
            ready && (
              <section className="detail-card care-clinical-unavailable">
                <h3>Clinical record unavailable</h3>
                <p>
                  {client?.status === 'past'
                    ? 'This is a former client. Current assessments and homework are not loaded; historical session records remain available. New clinical writes require a current assignment.'
                    : 'No current assigned client was found. Current clinical data and writes are unavailable.'}
                </p>
              </section>
            )
          )}
          {sessions.data?.status_log.length ? (
            <section className="detail-card clinical-pathway care-session-history">
              <h3>Session status history</h3>
              {sessions.data.status_log.map((entry) => (
                <div key={entry.id}>
                  <span>
                    <strong>
                      {entry.from_status ? `${entry.from_status} → ` : ''}
                      {entry.to_status}
                    </strong>
                    <small>
                      {entry.created_at} {entry.actor?.name ? `· ${entry.actor.name}` : ''}
                    </small>
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </Workspace>
  )
}

type Decision =
  | 'cancel'
  | 'approve-cancel'
  | 'forfeit-cancel'
  | 'approve-reschedule'
  | 'reject-reschedule'
  | 'complete'
  | 'report'
  | null
function SessionEditor({
  api,
  session,
  ready,
  currentClient,
  refresh,
}: {
  api: ApiClient
  session: CareSession
  ready: boolean
  currentClient: boolean
  refresh: () => void
}) {
  const mutation = useCareMutation(api, refresh)
  const online = useCareOnline()
  const [decision, setDecision] = useState<Decision>(null)
  const [link, setLink] = useState(session.link || '')
  const [report, setReport] = useState(session.summary || '')
  const [now, setNow] = useState(Date.now())
  const canEdit = ready && !mutation.disabled
  const open = session.status === 'pending' || session.status === 'confirmed'
  const canComplete =
    session.status === 'confirmed' &&
    !!session.attendance_confirmed_at &&
    (careInstant(session) ?? Infinity) <= now
  const meeting = careMeetingUrl(session)
  const timezone = api.getUser()?.timezone || 'UTC'
  const reschedule = session.reschedule
  const decisionCopy: Record<NonNullable<Decision>, string> = {
    cancel: 'Cancel this session immediately? The record is retained. This cannot be undone here.',
    'approve-cancel':
      'Approve the patient cancellation? This cancels the session and releases applicable quota.',
    'forfeit-cancel':
      'Reject the cancellation with forfeiture? This ALSO CANCELS the session and consumes applicable trial/package quota. It does not keep the appointment.',
    'approve-reschedule':
      'Approve the requested reschedule? The server rechecks availability and resets attendance for the new schedule.',
    'reject-reschedule': 'Reject the requested reschedule? The original appointment is kept.',
    complete:
      'Complete this session? The report is patient-visible. Completion requires server-confirmed attendance for the current schedule.',
    report:
      session.status === 'confirmed'
        ? 'Submit this patient-visible report and COMPLETE the session? This is not a draft save.'
        : 'Replace the patient-visible report with a new audited revision?',
  }
  async function decide() {
    if (!decision || !canEdit) return
    const path = `/sessions/${apiId(session.id)}`
    const action = decision
    let endpoint: string
    let body: unknown
    if (action === 'cancel') endpoint = '/cancel'
    else if (action === 'approve-cancel' || action === 'forfeit-cancel') {
      endpoint = '/cancel/decide'
      body = { approve: action === 'approve-cancel' }
    } else if (action === 'approve-reschedule' || action === 'reject-reschedule') {
      endpoint = '/reschedule/decide'
      body = { action: action === 'approve-reschedule' ? 'approve' : 'reject' }
    } else {
      endpoint = action === 'complete' ? '/complete' : '/report'
      body = { summary: report.trim() || null }
    }
    await mutation.run(path + endpoint, body, {
      onSuccess: () => setDecision(null),
      success: 'Session updated on the server.',
    })
  }
  async function saveLink(event: FormEvent) {
    event.preventDefault()
    if (!canEdit || !safeExternalUrl(link)) return
    await mutation.run(
      `/sessions/${apiId(session.id)}/link`,
      { link: link.trim() },
      { success: 'Meeting link saved on the server.' },
    )
  }
  return (
    <section className="detail-card outcome-card care-session-actions">
      <h3>Session actions</h3>
      <div className="detail-actions">
        {session.status === 'pending' && (
          <button
            className="teal-button"
            disabled={!canEdit || session.payment_status === 'pending'}
            onClick={() =>
              void mutation.run(`/sessions/${apiId(session.id)}/confirm`, undefined, {
                success: 'Session confirmed on the server.',
              })
            }
          >
            Confirm session
          </button>
        )}
        {open && (
          <button className="soft-button" disabled={!canEdit} onClick={() => setDecision('cancel')}>
            Cancel session
          </button>
        )}
        {meeting && online && ready ? (
          <a
            className="teal-button"
            href={meeting}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Join meeting
          </a>
        ) : (
          <button className="teal-button" disabled>
            Join meeting unavailable
          </button>
        )}
        <button
          className="soft-button"
          disabled
          title="Therapists can decide existing patient requests, not propose new dates."
        >
          Propose reschedule unavailable
        </button>
      </div>
      {session.payment_status === 'pending' && session.status === 'pending' && (
        <p>Confirmation requires server-approved payment or a free session.</p>
      )}
      {open && (
        <form className="part2-form" onSubmit={(event) => void saveLink(event)}>
          <label>
            Meeting URL
            <input
              type="url"
              maxLength={500}
              value={link}
              onChange={(event) => setLink(event.target.value)}
              required
            />
          </label>
          <p className="section-caption">
            HTTPS only; use a {session.medium} meeting URL allowed by the server. Saving a link does
            not create or start a meeting.
          </p>
          <button
            className="teal-button"
            disabled={!canEdit || !safeExternalUrl(link)}
            type="submit"
          >
            Save meeting link
          </button>
        </form>
      )}
      {session.cancellation?.pending && (
        <div className="clinical-flag">
          <h4>Patient cancellation request</h4>
          <p>
            Both decisions cancel this appointment. Rejection forfeits applicable trial/package
            quota.
          </p>
          <button
            className="soft-button"
            disabled={!canEdit}
            onClick={() => setDecision('approve-cancel')}
          >
            Approve cancellation
          </button>
          <button
            className="soft-button"
            disabled={!canEdit}
            onClick={() => setDecision('forfeit-cancel')}
          >
            Cancel with forfeiture
          </button>
        </div>
      )}
      {reschedule && open && (
        <div className="clinical-flag">
          <h4>Patient reschedule request</h4>
          <p>
            {careDate(
              {
                starts_at: null,
                session_date: reschedule.date,
                session_time: reschedule.time,
                local: reschedule.local,
              },
              timezone,
            )}
          </p>
          <button
            className="soft-button"
            disabled={!canEdit}
            onClick={() => setDecision('approve-reschedule')}
          >
            Approve reschedule
          </button>
          <button
            className="soft-button"
            disabled={!canEdit}
            onClick={() => setDecision('reject-reschedule')}
          >
            Reject reschedule
          </button>
        </div>
      )}
      {(session.status === 'confirmed' || session.status === 'completed') && (
        <div className="part2-form">
          <label>
            Patient-visible session report
            <textarea
              maxLength={5000}
              value={report}
              onChange={(event) => setReport(event.target.value)}
            />
          </label>
          <p>
            This is shared with the patient, not a private therapist note. Submitting a report for a
            confirmed session completes it; there is no report draft endpoint.
          </p>
          {session.summary && (
            <div className="previous-note">
              <span>
                <strong>Saved report · Revision {session.report_revision ?? 0}</strong>
                <p>{session.summary}</p>
              </span>
            </div>
          )}
          {session.status === 'confirmed' && (
            <>
              <p>
                {session.attendance_confirmed_at
                  ? 'Attendance confirmed by the server.'
                  : 'Awaiting patient/staff attendance confirmation. Therapists cannot mark attendance.'}
              </p>
              <button
                className="soft-button"
                onClick={() => {
                  setNow(Date.now())
                  refresh()
                }}
                disabled={mutation.busy}
              >
                Refresh session eligibility
              </button>
              <button
                className="teal-button"
                disabled={!canEdit || !canComplete}
                onClick={() => setDecision('complete')}
              >
                Complete session
              </button>
            </>
          )}
          <button
            className="teal-button"
            disabled={
              !canEdit ||
              report.trim().length < 10 ||
              (session.status === 'confirmed' && !canComplete)
            }
            onClick={() => setDecision('report')}
          >
            {session.status === 'completed'
              ? 'Update patient-visible report'
              : 'Submit report and complete'}
          </button>
        </div>
      )}
      <MutationStatus mutation={mutation} refreshed={ready} />
      {session.status === 'completed' && currentClient && (
        <RecommendationEditor key={session.id} api={api} sessionId={session.id} ready={ready} />
      )}
      {decision && (
        <Modal
          title="Confirm session change"
          className="part2-modal"
          onClose={() => {
            if (!mutation.busy) setDecision(null)
          }}
        >
          <p>{decisionCopy[decision]}</p>
          {(decision === 'report' || decision === 'complete') && (
            <p>{report.trim() || 'No report text will be included.'}</p>
          )}
          <MutationStatus mutation={mutation} refreshed={ready} />
          <footer className="form-footer">
            <button
              className="soft-button"
              disabled={mutation.busy}
              onClick={() => setDecision(null)}
            >
              Keep editing
            </button>
            <button className="teal-button" disabled={!canEdit} onClick={() => void decide()}>
              Confirm change
            </button>
          </footer>
        </Modal>
      )}
    </section>
  )
}

function RecommendationEditor({
  api,
  sessionId,
  ready,
}: {
  api: ApiClient
  sessionId: string
  ready: boolean
}) {
  const resource = useCareResource<{ recommendation: Recommendation | null }>(
    api,
    `/sessions/${apiId(sessionId)}/recommendation`,
  )
  const mutation = useCareMutation(api, resource.reload)
  const [editing, setEditing] = useState(false)
  const [requestEdit, setRequestEdit] = useState(false)
  const [note, setNote] = useState('')
  const [preserve, setPreserve] = useState(true)
  const current = resource.data?.recommendation
  const loaded = !!resource.data && !resource.loading && !resource.error
  useEffect(() => {
    if (requestEdit && loaded) {
      setNote(current?.note || '')
      setPreserve(true)
      setEditing(true)
      setRequestEdit(false)
    }
  }, [requestEdit, loaded, current])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!ready || !loaded || mutation.disabled || !note.trim()) return
    await mutation.run(
      `/sessions/${apiId(sessionId)}/recommendation`,
      {
        note: note.trim(),
        package_id: preserve ? (current?.package?.id ?? null) : null,
        program_id: preserve ? (current?.program?.id ?? null) : null,
      },
      {
        method: 'PUT',
        success: 'Patient-visible recommendation saved.',
        onSuccess: () => setEditing(false),
      },
    )
  }
  return (
    <div className="outcome-card">
      <h3>Completed-session recommendation</h3>
      <p>
        Patient-visible continuity note (not a supervisor alert). Saving replaces the
        recommendation. Existing package/program selections are preserved unless explicitly cleared;
        selecting new packages/programs is not offered here.
      </p>
      <ResourceStatus resource={resource} label="recommendation" />
      {loaded && (
        <>
          {current ? (
            <div className="previous-note">
              <span>
                <strong>Revision {current.revision}</strong>
                <p>{current.note || 'No note.'}</p>
                {current.package && <p>Package: {current.package.name}</p>}
                {current.program && <p>Program: {current.program.name}</p>}
              </span>
            </div>
          ) : (
            <p>No recommendation saved.</p>
          )}
          <button
            className="soft-button"
            disabled={!ready || mutation.disabled || requestEdit}
            onClick={() => {
              // Refetch before editing to avoid starting from an old replacement document.
              resource.reload()
              setRequestEdit(true)
            }}
          >
            Edit recommendation
          </button>
        </>
      )}
      {editing && (
        <form className="part2-form" onSubmit={(event) => void save(event)}>
          <label>
            Continuity note
            <textarea
              required
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={preserve}
              onChange={(event) => setPreserve(event.target.checked)}
            />
            Preserve existing package and program
          </label>
          {!preserve && <p>Saving will remove the existing package and program selections.</p>}
          <button
            className="teal-button"
            disabled={!ready || !loaded || mutation.disabled || !note.trim()}
          >
            Save recommendation
          </button>
        </form>
      )}
      <MutationStatus mutation={mutation} refreshed={loaded} />
    </div>
  )
}

function ClinicalEditor({
  api,
  patientId,
  client,
  session,
  ready,
  tab,
  navigate,
  refreshClients,
}: {
  api: ApiClient
  patientId: string
  client: CareClient
  session?: CareSession
  ready: boolean
  tab: string
  navigate: (path: string) => void
  refreshClients: () => void
}) {
  const base = `/therapists/clients/${apiId(patientId)}`
  const record = useCareResource<ClientRead>(api, base)
  const notes = useCareResource<NotesRead>(api, `${base}/notes`)
  const modules = useCareResource<ModulesRead>(api, `${base}/modules`)
  const assigned = useCareResource<CareContent[]>(
    api,
    `/therapists/content?patient_id=${apiId(patientId)}&per_page=100`,
    'content',
  )
  const [note, setNote] = useState('')
  const [homework, setHomework] = useState(false)
  const refresh = () => {
    record.reload()
    notes.reload()
    modules.reload()
    assigned.reload()
    refreshClients()
  }
  const mutation = useCareMutation(api, refresh)
  const identityMatches = !record.data || record.data.client.id === patientId
  const clinicalReady =
    ready && identityMatches && !!record.data && !record.loading && !record.error
  const canWrite = clinicalReady && !mutation.disabled
  const notesReady = !!notes.data && !notes.loading && !notes.error
  const modulesReady =
    !!modules.data && !modules.loading && !modules.error && modules.data.patient_id === patientId
  const assignedReady = !!assigned.data && !assigned.loading && !assigned.error
  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (!canWrite || !notesReady || note.trim().length < 3) return
    // An optional session is always the canonical session for this same patient.
    const body = session
      ? { body: note.trim(), session_id: apiId(session.id) }
      : { body: note.trim() }
    await mutation.run(`${base}/notes`, body, {
      onSuccess: () => setNote(''),
      success: 'Private therapist note added on the server.',
    })
  }
  return (
    <div className="detail-grid">
      <aside className="detail-overview">
        <section className="detail-card overview-card">
          <h3>Client Overview</h3>
          <ResourceStatus resource={record} label="clinical record" />
          {!identityMatches && <p role="alert">The clinical record does not match this patient.</p>}
          {record.data && identityMatches && (
            <>
              <dl>
                <div>
                  <dt>Age</dt>
                  <dd>{record.data.client.age}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{record.data.client.language}</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>{record.data.client.gender}</dd>
                </div>
                <div>
                  <dt>Completed sessions</dt>
                  <dd>{client.completed_sessions_count}</dd>
                </div>
                <div>
                  <dt>Assessment score</dt>
                  <dd>{record.data.clinical.assessment_score}</dd>
                </div>
                <div>
                  <dt>Safety flag</dt>
                  <dd>
                    {record.data.clinical.safety_flag ? 'Flagged' : 'Not flagged'} (read-only)
                  </dd>
                </div>
                <div>
                  <dt>Compliance</dt>
                  <dd>{record.data.clinical.compliance_level || 'Unavailable'}</dd>
                </div>
              </dl>
              {record.data.clinical.latest_assessment && (
                <p>
                  Latest assessment: {record.data.clinical.latest_assessment.type} · Score{' '}
                  {record.data.clinical.latest_assessment.score} ·{' '}
                  {record.data.clinical.latest_assessment.completed_at || 'Date unavailable'}
                </p>
              )}
            </>
          )}
        </section>
        <section className="detail-card checklist-card">
          <h3>Unavailable workflows</h3>
          <p>
            AI suggested focus, supervisor alerts, review tracking, and automatic next-session
            updates are not provided by this API.
          </p>
          <button className="soft-button" disabled>
            Notify clinical supervisor unavailable
          </button>
        </section>
      </aside>
      <div className="detail-content">
        <section className="detail-card notes-card">
          <h3>{tab === 'before' ? 'Previous Notes' : 'New Note'}</h3>
          <p className="section-caption">
            Private therapist notes are separate from patient-visible session reports. Notes cannot
            be edited or deleted through this API.
          </p>
          <ResourceStatus resource={notes} label="notes" />
          {tab === 'record' && (
            <form className="part2-form" onSubmit={(event) => void addNote(event)}>
              <label>
                New Note
                <textarea
                  aria-label="New Note"
                  value={note}
                  minLength={3}
                  maxLength={5000}
                  required
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <button
                className="teal-button"
                disabled={!canWrite || !notesReady || note.trim().length < 3}
              >
                Add Note
              </button>
            </form>
          )}
          {notes.data?.notes.map((item) => (
            <div key={item.id} className="previous-note">
              <span>
                <small>
                  {item.created_at || 'Date unavailable'}
                  {item.session_id ? ' · Session note' : ' · Client note'}
                </small>
                <p>{item.body}</p>
              </span>
            </div>
          ))}
          {notesReady && !notes.data?.notes.length && <p>No previous notes.</p>}
          {!!notes.data?.session_reports.length && (
            <>
              <h4>Patient-visible session reports</h4>
              {notes.data.session_reports.map((item) => (
                <div key={item.session_id} className="previous-note">
                  <span>
                    <small>{item.session_date || 'Date unavailable'}</small>
                    <p>{item.summary}</p>
                  </span>
                </div>
              ))}
            </>
          )}
        </section>
        <section className="detail-card homework-card">
          <h3>Homework and Exercises</h3>
          <p className="section-caption">
            Program completion and homework submission are patient-only. Therapist visibility
            controls do not assign or complete modules.
          </p>
          <ResourceStatus resource={modules} label="modules" />
          {modules.data?.patient_id === patientId &&
            modules.data.programs.map((program) => (
              <div key={program.id}>
                <h4>{program.name}</h4>
                {program.modules.map((module) => (
                  <article className="assigned-homework" key={module.id}>
                    <strong>{module.title}</strong>
                    <label className="homework-check care-module-status">
                      <input
                        type="checkbox"
                        checked={module.status === 'completed'}
                        disabled
                        readOnly
                      />
                      <span aria-hidden="true">{module.status === 'completed' ? '✓' : ''}</span>
                      <strong>{module.status}</strong>
                    </label>
                    <small>
                      {module.is_hidden
                        ? 'Hidden'
                        : module.locked
                          ? `Locked: ${module.lock_reason || 'Unavailable'}`
                          : 'Available'}
                    </small>
                    {module.homework_prompt && <p>{module.homework_prompt}</p>}
                    {module.homework && (
                      <div>
                        <strong>Submitted homework</strong>
                        {Object.entries(module.homework).map(([key, value]) => (
                          <p key={key}>
                            {key}: {value || 'No response'}
                          </p>
                        ))}
                        <small>
                          {module.homework_submitted_at || 'Submission date unavailable'}
                        </small>
                      </div>
                    )}
                    <button
                      className="soft-button"
                      disabled={
                        !canWrite ||
                        !modulesReady ||
                        (!module.is_hidden &&
                          (!module.is_hideable || module.status === 'completed'))
                      }
                      onClick={() =>
                        void mutation.run(`${base}/modules/${apiId(module.id)}/hide`, undefined, {
                          method: module.is_hidden ? 'DELETE' : 'POST',
                          success: module.is_hidden
                            ? 'Module visibility restored.'
                            : 'Module hidden on the server.',
                        })
                      }
                    >
                      {module.is_hidden ? 'Unhide module' : 'Hide module'}
                    </button>
                  </article>
                ))}
              </div>
            ))}
          {modulesReady && !modules.data?.programs.length && <p>No program modules available.</p>}
        </section>
        <section className="detail-card homework-card">
          <h3>Assigned reusable content</h3>
          <p>
            Content is assigned to this client across sessions. Due dates, uploads, custom-content
            grading, Audio and Interactive types are not supported.
          </p>
          <ResourceStatus resource={assigned} label="assigned content" />
          {assigned.data?.map((item) => (
            <article className="assigned-homework" key={item.id}>
              <ContentText item={item} />
              <button
                className="soft-button"
                disabled={!canWrite || !assignedReady}
                onClick={() =>
                  void mutation.run(
                    `/therapists/content/${apiId(item.id)}/assign/${apiId(patientId)}`,
                    undefined,
                    {
                      method: 'DELETE',
                      success: 'Client assignment removed; the library item was not deleted.',
                    },
                  )
                }
              >
                Remove assignment
              </button>
            </article>
          ))}
          {assignedReady && !assigned.data?.length && <p>No assigned content.</p>}
          <button
            className="teal-button"
            disabled={!canWrite || !assignedReady}
            onClick={() => setHomework(true)}
          >
            Add New Homework
          </button>
        </section>
        {record.data && identityMatches && (
          <section className="detail-card clinical-pathway">
            <h3>Recent session history</h3>
            <p>
              These counts cover only the latest {record.data.stats.total_sessions} sessions
              (maximum 20), not lifetime totals.
            </p>
            {record.data.sessions.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/sessions/upcoming?id=${apiId(item.id)}`)}
              >
                <span>
                  <strong>{careDate(item, api.getUser()?.timezone || 'UTC')}</strong>
                  <small>
                    {item.status} · {item.medium}
                  </small>
                </span>
              </button>
            ))}
          </section>
        )}
        <MutationStatus
          mutation={mutation}
          refreshed={clinicalReady && notesReady && modulesReady && assignedReady}
        />
      </div>
      {homework && (
        <ContentDialog
          api={api}
          patientId={patientId}
          name={client.full_name}
          ready={clinicalReady}
          refresh={assigned.reload}
          refreshClients={refreshClients}
          onClose={() => setHomework(false)}
        />
      )}
    </div>
  )
}

function ContentText({ item }: { item: CareContent }) {
  const url = safeExternalUrl(item.url)
  return (
    <>
      <strong>{item.title}</strong>
      <small>{item.content_type}</small>
      {item.body && <p>{item.body}</p>}
      {url ? (
        <a
          className="soft-button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Open content link
        </a>
      ) : (
        item.url && <p>Unsafe or unsupported external link is unavailable.</p>
      )}
    </>
  )
}

function ContentDialog({
  api,
  patientId,
  name,
  ready,
  refresh,
  refreshClients,
  onClose,
}: {
  api: ApiClient
  patientId: string
  name: string
  ready: boolean
  refresh: () => void
  refreshClients: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'library' | 'create'>('library')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<CareContent['content_type']>('text')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const library = useCareResource<CareContent[]>(api, '/therapists/content?per_page=100', 'content')
  const mutation = useCareMutation(api, () => {
    library.reload()
    refresh()
    refreshClients()
  })
  const loaded = !!library.data && !library.loading && !library.error
  const canWrite = ready && loaded && !mutation.disabled
  async function create(event: FormEvent) {
    event.preventDefault()
    if (!canWrite || !title.trim() || (type === 'text' ? !body.trim() : !safeExternalUrl(url)))
      return
    await mutation.run(
      '/therapists/content',
      {
        title: title.trim(),
        content_type: type,
        body: type === 'text' ? body.trim() : null,
        url: type === 'text' ? null : url.trim(),
        patient_ids: [apiId(patientId)],
      },
      {
        idempotent: true,
        success: 'Content created and assigned on the server.',
        onSuccess: () => {
          setTitle('')
          setBody('')
          setUrl('')
          setTab('library')
        },
      },
    )
  }
  const filtered =
    library.data?.filter(
      (item) =>
        (filter === 'All' || item.content_type === filter) &&
        item.title.toLowerCase().includes(query.trim().toLowerCase()),
    ) ?? []
  return (
    <Modal
      title={`Assign homework to ${name}`}
      className={`part2-modal homework-modal ${tab === 'create' ? 'is-create' : 'is-library'}`}
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
    >
      <p>
        Client-wide reusable text, video, or HTTPS link content. No file uploads or session-specific
        homework fields.
      </p>
      <div className="segmented-control" role="tablist" aria-label="Homework source">
        {(['library', 'create'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? 'selected' : ''}
            onClick={() => setTab(value)}
          >
            {value === 'library' ? 'From the library' : 'Create New'}
          </button>
        ))}
      </div>
      <ResourceStatus resource={library} label="content library" />
      {tab === 'create' ? (
        <form className="part2-form" onSubmit={(event) => void create(event)}>
          <label>
            Homework title
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            Content type
            <select
              value={type}
              onChange={(event) => setType(event.target.value as CareContent['content_type'])}
            >
              <option value="text">Text / Article</option>
              <option value="video">Video</option>
              <option value="link">External link</option>
              <option disabled>Audio unavailable</option>
              <option disabled>Interactive unavailable</option>
            </select>
          </label>
          {type === 'text' ? (
            <label>
              Content body
              <textarea
                required
                maxLength={20000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
          ) : (
            <label>
              HTTPS content URL
              <input
                required
                type="url"
                maxLength={2000}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
          )}
          <button
            className="teal-button"
            disabled={
              !canWrite || !title.trim() || (type === 'text' ? !body.trim() : !safeExternalUrl(url))
            }
          >
            Create and assign content
          </button>
        </form>
      ) : (
        <>
          <input
            className="library-search"
            aria-label="Search homework library"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
          />
          <div className="library-filters" role="group" aria-label="Content type filters">
            {['All', 'text', 'video', 'link'].map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? 'selected' : ''}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="library-results">
            {filtered.map((item) => {
              const added = item.assigned_patients?.some((patient) => patient.id === patientId)
              return (
                <article key={item.id}>
                  <div>
                    <ContentText item={item} />
                  </div>
                  <button
                    className={added ? 'added' : ''}
                    disabled={!canWrite || added}
                    aria-label={`${added ? 'Added' : 'Add'} ${item.title}`}
                    onClick={() =>
                      void mutation.run(
                        `/therapists/content/${apiId(item.id)}/assign`,
                        { patient_ids: [apiId(patientId)] },
                        {
                          idempotent: true,
                          success: 'Existing library content assigned on the server.',
                        },
                      )
                    }
                  >
                    {added ? 'Added' : '+ Add'}
                  </button>
                </article>
              )
            })}
            {loaded && !filtered.length && (
              <p className="empty-result">No library content found.</p>
            )}
          </div>
        </>
      )}
      <MutationStatus mutation={mutation} refreshed={loaded} />
      <footer className="form-footer">
        <button className="soft-button" disabled={mutation.busy} onClick={onClose}>
          Close
        </button>
      </footer>
    </Modal>
  )
}
