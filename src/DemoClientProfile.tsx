import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { asset } from './assets'
import { DesignIcon, Workspace } from './Workspace'
import './visual-client-profile-preview.css'

type Tab = 'Overview' | 'Sessions' | 'Notes' | 'Custom Content'
type SessionStatus = 'Upcoming' | 'Completed' | 'Missed'
type SessionFilter = 'All (6)' | SessionStatus

// Development design fixtures ONLY. These are transcribed from cached Figma
// nodes 1:9668, 1:10353, 1:11284 and their responsive counterparts, never API data.
const tabs: Tab[] = ['Overview', 'Sessions', 'Notes', 'Custom Content']
const filters: SessionFilter[] = ['All (6)', 'Upcoming', 'Completed', 'Missed']
const stats = [
  ['8', 'Total Sessions'],
  ['7', 'Completed Sessions'],
  ['85%', 'Adherence Rate'],
  ['21', 'Days in Program'],
]
const indicators = [
  { value: '4/10', previous: '7/10 previously', label: 'Anxiety level', width: 347.35 },
  { value: '7/10', previous: '5/10 previously', label: 'Sleep quality', width: 607.875 },
  { value: '8/10', previous: '6/10 previously', label: 'Daily performance', width: 694.713 },
]
const sessions: { id: string; title: string; date: string; description: string; status: SessionStatus }[] = [
  { id: 'follow-up', title: 'Follow-up Session', date: 'May 22, 2024 · 10:00 AM · 60 minutes', description: 'Next regular check-in', status: 'Upcoming' },
  { id: 'monthly', title: 'Progress Review', date: 'Jun 5, 2024 · 2:00 PM · 30 minutes', description: 'Scheduled monthly review', status: 'Upcoming' },
  { id: 'review', title: 'Progress Review', date: 'May 15, 2024 · 4:00 PM · 30 minutes', description: 'Assessed improvements and adjusted plan', status: 'Completed' },
  { id: 'one-on-one', title: 'One-on-One Session', date: 'May 15, 2024 · 10:00 AM · 60 minutes', description: 'Marked progress in managing anxiety', status: 'Completed' },
  { id: 'exercises', title: 'Follow-up', date: 'May 1, 2024 · 45 minutes', description: 'Continued commitment to exercises', status: 'Completed' },
  { id: 'missed', title: 'Individual Session', date: 'Apr 27, 2024 · 60 minutes', description: 'Patient did not attend — not rescheduled at the time', status: 'Missed' },
  { id: 'initial', title: 'Initial Consultation', date: 'Apr 20, 2024 · 60 minutes', description: 'Discussed goals and challenges', status: 'Completed' },
]
const existingNotes = [
  {
    title: 'Comprehensive Summary of Therapy Session',
    date: 'Session Date and Time: May 15, 2024, at 4:00 PM',
    body: "During this session, we thoroughly reviewed the patient's progress since the last meeting, assessing improvements and identifying areas that require further attention. We discussed the effectiveness of the current treatment plan in detail, considering the patient's feedback and observed responses. Based on this comprehensive evaluation, we made necessary adjustments to the treatment strategy to better align with the patient's evolving needs and goals, ensuring a more tailored and effective therapeutic approach moving forward.",
  },
  { title: 'Therapy: One-on-One Session', date: 'Date: May 15, 2024, 10 AM', body: 'Noticed clear progress in managing anxiety.' },
  { title: 'Individual Therapy', date: 'Session on May 15, 2024, at 10 AM', body: 'Patient improved anxiety coping skills.' },
  {
    title: 'Individual Therapy Session',
    date: 'Date: May 15, 2024, 10:00 AM',
    body: 'Reviewed anxiety symptoms and coping strategies in detail. Patient showed strong progress in identifying triggers and using new techniques confidently. Focused on relaxation and cognitive exercises, with plans to reinforce these skills and tackle new challenges for ongoing improvement.',
  },
]

function PreviewIcon({ name }: { name: string }) {
  return <DesignIcon name={`preview-client-profile-${name}.svg`} />
}

export function DemoClientProfile({ navigate }: { navigate: (path: string) => void }) {
  return import.meta.env.VITE_DEMO_MODE === 'true'
    ? <ClientProfileFixture navigate={navigate} />
    : null
}

function ClientProfileFixture({ navigate }: { navigate: (path: string) => void }) {
  const [tab, setTab] = useState<Tab>('Overview')
  const [filter, setFilter] = useState<SessionFilter>('All (6)')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [localNotes, setLocalNotes] = useState<string[]>([])
  const [expandedNotes, setExpandedNotes] = useState<number[]>([0])

  function unavailable(action: string) {
    setNotice(`Demo only: ${action} is not connected. No call, booking, or server change has been made.`)
  }

  function switchTab(next: Tab) {
    setTab(next)
    setNotice('')
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    switchTab(tabs[next])
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (body.length < 3 || body.length > 5000) {
      setError('Enter a note between 3 and 5,000 characters. Demo notes are local only.')
      return
    }
    setLocalNotes((notes) => [...notes, body])
    setDraft('')
    setError('')
    setNotice('Demo only: note added locally for this preview. It was not sent to a server and disappears when this page is closed.')
  }

  function sessionRow(session: (typeof sessions)[number]) {
    return (
      <article key={session.id} className={`dcp-session dcp-session-${session.status.toLowerCase()}`} aria-label={`${session.title}: ${session.status}`}>
        <span className="dcp-calendar"><PreviewIcon name={session.status === 'Missed' ? 'calendar-missed' : 'calendar'} /></span>
        <div className="dcp-session-copy">
          <div className={`dcp-row-heading${session.id === 'exercises' ? ' dcp-row-heading-inline' : ''}`}><h3>{session.title}</h3><span className="dcp-date">{session.date}</span></div>
          <p>{session.description}</p>
        </div>
        <div className="dcp-session-actions">
          {session.status !== 'Completed' && <span className="dcp-session-badge">{session.status}</span>}
          {session.status === 'Upcoming' ? (
            <button type="button" className="dcp-reschedule" aria-label={`Reschedule ${session.title}`} onClick={() => unavailable(`Reschedule ${session.title}`)}>Reschedule</button>
          ) : (
            <button type="button" className="dcp-chevron" aria-label={`View ${session.title} (${session.date})`} onClick={() => unavailable('Session details')}><PreviewIcon name="chevron" /></button>
          )}
        </div>
      </article>
    )
  }

  const upcoming = sessions.filter((session) => session.status === 'Upcoming')
  // The source places the missed row inside the Completed section, and shows
  // seven rows despite the literal All (6) label. Preserve that evidence.
  const historical = sessions.filter((session) => session.status !== 'Upcoming')

  return (
    <div className="demo-client-profile">
      <Workspace active="Clients" title="Manage Clients / Profiles" mobileTitle="Manage Clients / Profile" navigate={navigate}>
        {notice && <div className="dcp-notice" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
        <div className={`dcp-layout ${tab === 'Overview' ? 'dcp-layout-overview' : ''}`}>
          <aside className="dcp-card dcp-identity" aria-label="Design fixture client information">
            <div className="dcp-identity-top">
              <div className="dcp-person">
                <img className="dcp-avatar" src={asset('preview-client-profile-ahmed.png')} alt="Ahmed Mohamed — design fixture" />
                <div><h2>Ahmed Mohamed</h2><p>Age 28 · Male</p></div>
              </div>
              <div className="dcp-contact-actions">
                <button type="button" className="dcp-primary" title="Open demo chats, not a real patient conversation" onClick={() => navigate('/chats')}><PreviewIcon name="contact" />Contact patient</button>
                <div className="dcp-two-actions">
                  <button type="button" onClick={() => unavailable('Scheduling')}><PreviewIcon name="schedule" />Schedule</button>
                  <button type="button" onClick={() => unavailable('Calling')}><PreviewIcon name="call" />Call</button>
                </div>
              </div>
            </div>
            <div className="dcp-metadata">
              <section className="dcp-contact"><h3>Contact Information</h3><dl><div><dt>Mobile</dt><dd>+966 50 123 4567</dd></div><div><dt>Email</dt><dd>ahmed@example.com</dd></div></dl></section>
              <section className="dcp-subscription"><h3>Subscription</h3><dl><div><dt>Package</dt><dd>8-Week Package</dd></div><div><dt>Start</dt><dd>2024-01-15</dd></div><div><dt>Next Session</dt><dd>Today 10:00 AM</dd></div></dl></section>
            </div>
          </aside>
          <div className="dcp-content">
            <section className="dcp-card dcp-tab-card" aria-label="Client profile design reference">
              <div className="dcp-tabs" role="tablist" aria-label="Client profile sections">
                {tabs.map((item, index) => (
                  <button type="button" role="tab" key={item} id={`dcp-tab-${index}`} aria-controls={`dcp-panel-${index}`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => switchTab(item)} onKeyDown={(event) => tabKey(event, index)}>
                    <PreviewIcon name={item === 'Overview' ? (tab === item ? 'overview' : 'overview-inactive') : item === 'Sessions' ? (tab === item ? 'sessions-active' : 'sessions') : item === 'Notes' ? (tab === item ? 'notes-active' : 'notes') : 'stars'} />
                    {item}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`dcp-panel-${tabs.indexOf(tab)}`} aria-labelledby={`dcp-tab-${tabs.indexOf(tab)}`} tabIndex={0}>
                {tab === 'Overview' && <div className="dcp-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>}
                {tab === 'Sessions' && (
                  <div className="dcp-panel-body">
                    <div className="dcp-session-toolbar">
                      <div className="dcp-filters" role="group" aria-label="Filter sessions">
                        {filters.map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
                      </div>
                      <button type="button" className="dcp-primary dcp-schedule-session" onClick={() => unavailable('Schedule session')}><PreviewIcon name="plus" />Schedule session</button>
                    </div>
                    {(filter === 'All (6)' || filter === 'Upcoming') && <section className="dcp-session-group" aria-label="Upcoming sessions"><h2>Upcoming</h2><div>{upcoming.map(sessionRow)}</div></section>}
                    {filter !== 'Upcoming' && <section className="dcp-session-group" aria-label={filter === 'Missed' ? 'Missed sessions' : 'Completed sessions'}><h2>{filter === 'Missed' ? 'Missed' : 'Completed'}</h2><div>{historical.filter((session) => filter === 'All (6)' || session.status === filter).map(sessionRow)}</div></section>}
                  </div>
                )}
                {tab === 'Notes' && (
                  <div className="dcp-panel-body dcp-notes-body">
                    <form className="dcp-note-form" noValidate onSubmit={addNote}>
                      <label htmlFor="dcp-new-note">New Note</label>
                      <textarea id="dcp-new-note" placeholder="Type your note here..." value={draft} maxLength={5000} aria-describedby={`dcp-demo-disclaimer${error ? ' dcp-note-error' : ''}`} aria-invalid={Boolean(error)} onChange={(event) => { setDraft(event.target.value); setError('') }} />
                      {error && <p id="dcp-note-error" role="alert">{error}</p>}
                      <div className="dcp-note-submit"><button type="submit" className="dcp-primary"><PreviewIcon name="plus" />Add Note</button></div>
                    </form>
                    <section className="dcp-previous-notes" aria-label="Previous Notes"><h2>Previous Notes</h2>
                      <div className="dcp-note-list">
                        {localNotes.map((body, index) => <article className="dcp-note dcp-local-note" key={index}><h3>Local demo note</h3><p>{body}</p><small>Local only — not saved to a server</small></article>)}
                        {existingNotes.map((note, index) => {
                          const expanded = expandedNotes.includes(index)
                          return <article className={`dcp-note ${expanded ? 'dcp-note-expanded' : ''}`} key={note.title}>
                            <div className="dcp-note-copy"><div className="dcp-row-heading"><h3>{note.title}</h3><span className="dcp-date">{note.date}</span></div><p id={`dcp-note-body-${index}`}>{note.body}</p></div>
                            <button type="button" className="dcp-chevron" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${note.title}`} aria-expanded={expanded} aria-controls={`dcp-note-body-${index}`} onClick={() => setExpandedNotes((notes) => expanded ? notes.filter((id) => id !== index) : [...notes, index])}><PreviewIcon name="chevron" /></button>
                          </article>
                        })}
                      </div>
                    </section>
                  </div>
                )}
                {tab === 'Custom Content' && <div className="dcp-panel-body dcp-missing-reference"><h2>Custom Content reference unavailable</h2><p>The supplied frame 1:11772 contains Notes, not a Custom Content design. No content or assignments have been invented.</p></div>}
              </div>
            </section>
            {tab === 'Overview' && <section className="dcp-card dcp-indicators" aria-label="Clinical indicators — design fixtures only">
              {indicators.map((indicator) => <div className="dcp-indicator" key={indicator.label}><div><span><strong>{indicator.value}</strong><small>{indicator.previous}</small></span><span>{indicator.label}</span></div><div className="dcp-indicator-track" aria-hidden="true"><span style={{ width: indicator.width }} /></div></div>)}
              <div className="dcp-summary"><PreviewIcon name="summary" /><p>The client shows significant improvement across all key indicators. Consistent exercise contributes to positive results.</p></div>
            </section>}
          </div>
        </div>
        <p className="dcp-demo-disclaimer" id="dcp-demo-disclaimer">Development design reference only. All identity, contact, subscription and clinical information is a Figma fixture, not a real patient record. No backend is connected. New notes are local only and disappear when this page is closed.</p>
      </Workspace>
    </div>
  )
}
