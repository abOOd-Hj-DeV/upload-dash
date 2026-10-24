import { useEffect, useState } from 'react'
import { asset } from './assets'
import { Modal } from './ui'
import { DesignIcon, Workspace } from './Workspace'
import { ScheduleDialog } from './Sessions'
import { ApiClient } from './api'
import { LiveCarePage } from './api-sessions-and-clinical-live'
import { DeleteTemplateDialog } from './DeleteTemplateDialog'

type Assignment = { title: string; type: string; instructions?: string; link?: string }

export function SessionDetails({
  navigate,
  api,
}: {
  navigate: (path: string) => void
  api?: ApiClient
}) {
  return api ? (
    <LiveCarePage page="detail" api={api} navigate={navigate} />
  ) : (
    <DemoSessionDetails navigate={navigate} />
  )
}

function DemoSessionDetails({ navigate }: { navigate: (path: string) => void }) {
  const params = new URLSearchParams(window.location.search)
  const initial = params.get('state')
  const patient = params.get('patient')
  const client = patient || 'Ahmed Mohamed'
  const [tab, setTab] = useState(
    initial === 'record' || initial === 'create' || initial === 'library' ? 'record' : 'before',
  )
  const [actions, setActions] = useState(initial === 'actions')
  const [modal, setModal] = useState<
    'schedule' | 'delete' | 'meeting' | 'notes' | 'profile' | 'delete-template' | null
  >(initial === 'delete-template' ? 'delete-template' : null)
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [outcome, setOutcome] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [clinicalFlag, setClinicalFlag] = useState(false)
  const [reviewed, setReviewed] = useState([true, true, false])
  const [completed, setCompleted] = useState([true, true])
  const [feedback, setFeedback] = useState('')
  const [savedOutcome, setSavedOutcome] = useState('')
  const [date, setDate] = useState('Sep 25 · 10:00 AM · 45 min · Follow-up')

  // The assign-homework modal is superseded by the /homework library routes;
  // the old fixture states now open the new library pages instead.
  useEffect(() => {
    if (initial === 'library') navigate('/homework')
    else if (initial === 'create') navigate('/homework/create')
  }, [initial, navigate])

  return (
    <Workspace title="Sessions / Upcoming Session" active="Sessions" navigate={navigate}>
      <div className={`session-detail demo-session-detail ${tab === 'record' ? 'show-record' : ''}`}>
        <div className="detail-tabs segmented-control" role="tablist" aria-label="Session view">
          <button
            role="tab"
            aria-selected={tab === 'before'}
            className={tab === 'before' ? 'selected' : ''}
            onClick={() => setTab('before')}
          >
            Before session
          </button>
          <button
            role="tab"
            aria-selected={tab === 'record'}
            className={tab === 'record' ? 'selected' : ''}
            onClick={() => setTab('record')}
          >
            Session record
          </button>
        </div>
        <header className="detail-header">
          <div className="detail-client">
            <span className="detail-avatar">
              <img src={asset('part2-07-imgContainer6.png')} alt="" />
              <DesignIcon name="part2-08-imgIcon1.svg" />
            </span>
            <div>
              <h2>{patient || 'Mark lory'}</h2>
              <p>{date}</p>
            </div>
          </div>
          <div className="detail-actions">
            <div className="session-action-container">
              <button
                className="icon-button"
                aria-label="Session actions"
                aria-expanded={actions}
                onClick={() => setActions(!actions)}
              >
                <DesignIcon name="r4-clinical-more.svg" />
              </button>
              {actions && (
                <div className="session-actions-menu">
                  <button
                    onClick={() => {
                      setActions(false)
                      setModal('schedule')
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => {
                      setActions(false)
                      setModal('delete')
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <button className="teal-button" onClick={() => setModal('meeting')}>
              Start Session
            </button>
          </div>
        </header>
        <div className="detail-grid">
          <aside className="detail-overview">
            <section className="detail-card overview-card">
              <h3>Client Overview</h3>
              <dl>
                <div>
                  <dt>Age</dt>
                  <dd>29</dd>
                </div>
                <div>
                  <dt>Primary Concern</dt>
                  <dd>Anxiety</dd>
                </div>
                <div>
                  <dt>Sessions</dt>
                  <dd>Two Completed Sessions</dd>
                </div>
              </dl>
              <button className="teal-button" onClick={() => setModal('profile')}>
                View Full Profile
              </button>
            </section>
            <section className="detail-card checklist-card">
              <h3>Before You Begin</h3>
              {[
                'Clinical Summary Reviewed',
                'Assigned Homework Reviewed',
                "The client's latest response has not been reviewed yet",
              ].map((label, index) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={reviewed[index]}
                    onChange={(event) =>
                      setReviewed(
                        reviewed.map((value, i) => (i === index ? event.target.checked : value)),
                      )
                    }
                  />
                  <span
                    className={reviewed[index] ? 'reviewed' : 'not-reviewed'}
                    aria-hidden="true"
                  >
                    {reviewed[index] ? '✓' : '!'}
                  </span>
                  <span>{label}</span>
                </label>
              ))}
            </section>
          </aside>
          <div className="detail-content">
            {tab === 'before' ? (
              <>
                <section className="detail-card clinical-summary">
                  <h3>Quick Clinical Summary</h3>
                  <div>
                    <strong>Assigned Homework</strong>
                    <p>Daily Activity Log - Fully Completed</p>
                    <span className="clinical-badge completed">Completed</span>
                  </div>
                  <div>
                    <strong>Client Response</strong>
                    <p>{client} reported difficulty applying the breathing exercise at work</p>
                    <span className="clinical-badge needs-review">Needs Review</span>
                  </div>
                  <button className="soft-button" onClick={() => setModal('notes')}>
                    View Previous Notes
                  </button>
                </section>
                <section className="detail-card suggested-focus">
                  <h3>Suggested Focus for This Session</h3>
                  <ul>
                    <li>
                      <strong>Sleep-Related Anxiety</strong>
                      <p>
                        The client noted difficulty sleeping twice this week in the activity log —
                        deserves dedicated time today instead of being overlooked.
                      </p>
                    </li>
                    <li>
                      <strong>Difficulty Applying Homework at Work</strong>
                      <p>
                        The assigned exercise was not applied as expected at work — warrants
                        discussion about practical obstacles rather than just re-explaining the
                        exercise.
                      </p>
                    </li>
                  </ul>
                  {savedOutcome && (
                    <div className="saved-continuity">
                      <strong>Next Step / Continuity Note</strong>
                      <p>{savedOutcome}</p>
                    </div>
                  )}
                </section>
                <section className="detail-card clinical-pathway">
                  <h3>Clinical Pathway</h3>
                  <div>
                    <i />
                    <span>
                      <strong>Initial Setup</strong>
                      <small>Basic Information Collected</small>
                    </span>
                  </div>
                  <button onClick={() => setModal('notes')}>
                    <i />
                    <span>
                      <strong>Two Previous Sessions</strong>
                      <small>Available for Note Review</small>
                    </span>
                    <span>‹</span>
                  </button>
                  <div>
                    <i />
                    <span>
                      <strong>Next Session</strong>
                      <small>Today · 10:00 AM</small>
                    </span>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="detail-card notes-card">
                  <h3>New Note</h3>
                  <textarea
                    aria-label="New Note"
                    placeholder="Type your note here..."
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <button
                    className="teal-button"
                    onClick={() => {
                      if (note.trim()) {
                        setNotes([...notes, note.trim()])
                        setNote('')
                        setFeedback(
                          'Demo note added locally. No clinical record was saved to a server.',
                        )
                      }
                    }}
                  >
                    <DesignIcon name="preview-client-profile-plus.svg" /> Add Note
                  </button>
                  <p className="section-caption">Previous Notes</p>
                  <button className="previous-note" onClick={() => setModal('notes')}>
                    <span>
                      <span className="previous-note-heading">
                        <strong>Therapy: One-on-One Session</strong>
                        <small>Date: May 15, 2024, 10 AM</small>
                      </span>
                      <p>Noticed clear progress in managing anxiety.</p>
                    </span>
                    <DesignIcon name="preview-client-profile-chevron.svg" />
                  </button>
                  {notes.map((text, index) => (
                    <div className="previous-note" key={index}>
                      <p>{text}</p>
                    </div>
                  ))}
                </section>
                <section className="detail-card homework-card">
                  <h3>Homework and Exercises</h3>
                  <p className="section-caption">Review previous session's homework</p>
                  {['Cognitive Restructuring', 'Avoid news and social media'].map(
                    (title, index) => (
                      <label key={title} className="homework-check">
                        <input
                          type="checkbox"
                          checked={completed[index]}
                          onChange={(event) =>
                            setCompleted(
                              completed.map((value, i) =>
                                i === index ? event.target.checked : value,
                              ),
                            )
                          }
                        />
                        <span aria-hidden="true">{completed[index] ? '✓' : ''}</span>
                        <span>
                          <strong>{title}</strong>
                          <small>Ongoing Exercise</small>
                        </span>
                      </label>
                    ),
                  )}
                  <p className="section-caption new-assignment-title">
                    New assignment after this session
                  </p>
                  {assignments.length ? (
                    assignments.map((item) => (
                      <div className="assigned-homework" key={item.title}>
                        <strong>{item.title}</strong>
                        <small>{item.type}</small>
                        <button
                          aria-label={`Remove ${item.title}`}
                          onClick={() =>
                            setAssignments(
                              assignments.filter((current) => current.title !== item.title),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="no-assignments">No new assignments yet</p>
                  )}
                  <div className="homework-add">
                    <button onClick={() => navigate('/homework/create')}>+ Add New Homework</button>
                  </div>
                </section>
                <section className="detail-card outcome-card">
                  <h3>Session Outcome</h3>
                  <label>
                    Next Step / Continuity Note
                    <textarea
                      placeholder="What should be built upon in the next session?"
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value)}
                    />
                  </label>
                  <label className="outcome-checkbox">
                    <input
                      type="checkbox"
                      checked={followUp}
                      onChange={(event) => setFollowUp(event.target.checked)}
                    />
                    Need for additional follow-up
                  </label>
                  <div className="clinical-flag">
                    <label>
                      <input
                        type="checkbox"
                        checked={clinicalFlag}
                        onChange={(event) => setClinicalFlag(event.target.checked)}
                      />
                      <span className="clinical-flag-label">
                        <svg
                          className="clinical-flag-icon"
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M2 1v10" stroke="currentColor" />
                          <path d="m2 1 9 2.5L2 7Z" fill="currentColor" />
                        </svg>
                        Clinical Follow-up Flag
                      </span>
                    </label>
                    <p>
                      When activated, the clinical supervisor is alerted to review this case — used
                      only when additional supervision is needed.
                    </p>
                  </div>
                  <p className="continuity-info">
                    What you write in “Next Step” will automatically appear in the preparation for
                    the next session.
                  </p>
                </section>
                <footer className="record-footer">
                  <button className="soft-button" onClick={() => setTab('before')}>
                    Back to Summary
                  </button>
                  <button
                    className="teal-button"
                    onClick={() => {
                      setSavedOutcome(outcome.trim())
                      setFeedback(
                        `Demo session record updated locally${clinicalFlag ? '; clinical flag selected, but no supervisor was notified' : ''}. No backend is connected.`,
                      )
                    }}
                  >
                    Save and Update Next Session
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
        {feedback && (
          <p className="demo-feedback" role="status">
            {feedback}
          </p>
        )}
      </div>
      {modal === 'delete-template' && (
        <DeleteTemplateDialog
          templateName="Daily Breathing Exercise"
          assignedCount={14}
          onClose={() => setModal(null)}
          onDelete={() => {
            setModal(null)
            setFeedback('Demo only: no template was deleted. No backend is connected.')
          }}
        />
      )}
      {modal === 'schedule' && (
        <ScheduleDialog
          onClose={() => setModal(null)}
          onSchedule={(item) => {
            setDate(`${item.date} · ${item.time} · ${item.duration} · Follow-up`)
            setModal(null)
            setFeedback('Demo session rescheduled locally. No calendar was updated.')
          }}
        />
      )}
      {modal === 'delete' && (
        <Modal title="Delete this session?" className="part2-modal" onClose={() => setModal(null)}>
          <p>This only closes the demo session. No patient record will be deleted.</p>
          <footer className="form-footer">
            <button className="soft-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="teal-button" onClick={() => navigate('/sessions')}>
              Delete session
            </button>
          </footer>
        </Modal>
      )}
      {modal === 'meeting' && (
        <Modal title="Start Session" className="part2-modal" onClose={() => setModal(null)}>
          <p>Demo only: no live meeting service is connected.</p>
          <button className="teal-button" onClick={() => setModal(null)}>
            Back to session
          </button>
        </Modal>
      )}
      {modal === 'notes' && (
        <Modal title="Previous Notes" className="part2-modal" onClose={() => setModal(null)}>
          <strong>Therapy: One-on-One Session</strong>
          <p>Date: May 15, 2024, 10 AM</p>
          <p>Noticed clear progress in managing anxiety.</p>
          {notes.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </Modal>
      )}
      {modal === 'profile' && (
        <Modal
          title={patient || 'Mark lory'}
          className="part2-modal"
          onClose={() => setModal(null)}
        >
          <p>Age: 29 · Primary concern: Anxiety</p>
          <p>Two Completed Sessions</p>
          <p>
            Demo overview only. A full patient-profile design and patient API were not supplied.
          </p>
        </Modal>
      )}
    </Workspace>
  )
}
