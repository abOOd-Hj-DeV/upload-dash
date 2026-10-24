import { useState } from 'react'
import { ApiClient } from './api'
import { asset } from './assets'
import { Modal } from './ui'
import { Workspace } from './Workspace'
import './visual-homework-wizard.css'

type HomeworkWizardProps = { navigate: (path: string) => void; api?: ApiClient }

type ContentType = 'exercise' | 'video' | 'audio' | 'article' | 'worksheet' | 'goal' | 'check'

const contentTypes: readonly { id: ContentType; label: string; icon: string }[] = [
  { id: 'exercise', label: 'Interactive Exercise', icon: 'r5-create-wizard-exercise.svg' },
  { id: 'video', label: 'Video', icon: 'r5-create-wizard-video.svg' },
  { id: 'audio', label: 'Audio', icon: 'r5-create-wizard-audio.svg' },
  { id: 'article', label: 'Article / Lesson', icon: 'r5-create-wizard-article.svg' },
  { id: 'worksheet', label: 'Worksheet', icon: 'r5-create-wizard-worksheet.svg' },
  { id: 'goal', label: 'Goal', icon: 'r5-create-wizard-goal.svg' },
  { id: 'check', label: 'Quick Check', icon: 'r5-create-wizard-check.svg' },
]

type ExtraField = { label: string; kind: 'upload' | 'input'; hint: string }

// Field sets mirror the per-type upload rows in the "Additional Fields" Figma frames.
// Types without a supplied frame reuse the same upload-pair/input-pair composition.
const extraFields: Record<ContentType, ExtraField[]> = {
  exercise: [
    { label: 'Exercise File (Trial)', kind: 'upload', hint: 'Click here to exercise file' },
    { label: 'Exercise thumbnail', kind: 'upload', hint: 'Click here to Upload image' },
  ],
  video: [
    { label: 'Video File (Trial)', kind: 'upload', hint: 'Click here to video file' },
    { label: 'Video thumbnail', kind: 'upload', hint: 'Click here to Upload image' },
  ],
  audio: [
    { label: 'Audio File (Trial)', kind: 'upload', hint: 'Click here to video file' },
    { label: 'Audio thumbnail', kind: 'upload', hint: 'Click here to Upload image' },
  ],
  article: [
    { label: 'Cover image', kind: 'upload', hint: 'Click here to Upload image' },
    { label: 'Reading time (minutes)', kind: 'input', hint: 'e.g. 8' },
  ],
  worksheet: [
    { label: 'Worksheet File', kind: 'upload', hint: 'Click here to worksheet file' },
    { label: 'Worksheet thumbnail', kind: 'upload', hint: 'Click here to Upload image' },
  ],
  goal: [
    { label: 'Goal target', kind: 'input', hint: 'e.g. 5 sessions' },
    { label: 'Duration (weeks)', kind: 'input', hint: 'e.g. 4' },
  ],
  check: [
    { label: 'Number of questions', kind: 'input', hint: 'e.g. 3' },
    { label: 'Estimated time (minutes)', kind: 'input', hint: 'e.g. 2' },
  ],
}

const demoFill = {
  title: 'Daily Small Activity',
  description:
    'Pick one small activity — no longer than 10 minutes — and do it without waiting until you feel like it. Then record what you did and how you felt before and after.',
}

const validTypes = new Set(contentTypes.map((item) => item.id))

export function HomeworkWizard({ navigate, api }: HomeworkWizardProps) {
  return api ? (
    <WizardForm navigate={navigate} live />
  ) : (
    <DemoHomeworkWizard navigate={navigate} />
  )
}

// Development design fixture only: the live route renders WizardForm with live=true
// and never mounts these ?state= presentation presets.
function DemoHomeworkWizard({ navigate }: { navigate: (path: string) => void }) {
  if (!(import.meta.env.VITE_DEMO_MODE === 'true')) return null
  const params = new URLSearchParams(window.location.search)
  const state = params.get('state')
  const requestedType = params.get('type')
  const type = validTypes.has(requestedType as ContentType)
    ? (requestedType as ContentType)
    : state === 'filled'
      ? 'audio'
      : 'article'
  return (
    <WizardForm
      navigate={navigate}
      initialType={type}
      initialTitle={state === 'filled' ? demoFill.title : ''}
      initialDescription={state === 'filled' ? demoFill.description : ''}
      showValidation={state === 'validation'}
      draftBanner={state === 'draft'}
    />
  )
}

function WizardForm({
  navigate,
  live = false,
  initialType = 'article',
  initialTitle = '',
  initialDescription = '',
  showValidation = false,
  draftBanner = false,
}: {
  navigate: (path: string) => void
  live?: boolean
  initialType?: ContentType
  initialTitle?: string
  initialDescription?: string
  showValidation?: boolean
  draftBanner?: boolean
}) {
  const [type, setType] = useState<ContentType>(initialType)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(showValidation)
  const [notice, setNotice] = useState('')
  const titleError = touched && !title.trim() ? 'A title is required to publish.' : ''

  function selectType(next: ContentType) {
    setType(next)
    setFields({})
  }

  function reset() {
    setType(initialType)
    setTitle(initialTitle)
    setDescription(initialDescription)
    setFields({})
    setTouched(false)
  }

  function pickFile(label: string) {
    if (live) {
      setNotice('Uploading content files is not available in the therapist API.')
      return
    }
    setFields((current) => ({ ...current, [label]: `${label.toLowerCase().replace(/\s+/g, '-')}-demo.pdf` }))
  }

  function publish() {
    if (!title.trim()) {
      setTouched(true)
      return
    }
    if (live) {
      setNotice('Publishing content is not available in the therapist API.')
      return
    }
    navigate('/homework?state=published')
  }

  return (
    <Workspace
      title="Additional Content"
      active="Additional Content"
      navigate={navigate}
    >
      <div className="homework-wizard">
        <div className="hw-layout">
          <section className="hw-preview-panel" aria-labelledby="hw-preview-heading">
            <header className="hw-panel-head">
              <h2 id="hw-preview-heading">Patient Preview</h2>
              <span className="hw-live-badge">Live Preview</span>
            </header>
            <PatientPhone type={type} title={title} description={description} />
          </section>
          <section className="hw-form-panel" aria-labelledby="hw-form-heading">
            <h2 id="hw-form-heading">Add new content</h2>
            <p className="hw-form-subtitle">
              Create new therapeutic content, place it in the patient’s library and preview how it
              will appear to the patient in the app.
            </p>
            {draftBanner && (
              <p className="hw-draft-banner" role="status">
                Draft saved — this copy is stored locally for review; nothing was sent to a patient.
              </p>
            )}
            <fieldset className="hw-type-picker">
              <legend>Content Type</legend>
              <div className="hw-type-grid">
                {contentTypes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`hw-type-card ${type === item.id ? 'is-selected' : ''}`}
                    aria-pressed={type === item.id}
                    onClick={() => selectType(item.id)}
                  >
                    <img src={asset(item.icon)} alt="" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="hw-field">
              <label htmlFor="hw-title">Title</label>
              <input
                id="hw-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? 'hw-title-error' : undefined}
                autoComplete="off"
              />
              {titleError && (
                <p className="hw-field-error" id="hw-title-error" role="alert">
                  {titleError}
                </p>
              )}
            </div>
            <div className="hw-field">
              <label htmlFor="hw-description">Instructions / Description</label>
              <textarea
                id="hw-description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <fieldset className="hw-extra-fields">
              <legend>Additional Fields by Content Type</legend>
              <div className="hw-extra-grid">
                {extraFields[type].map((field) => (
                  <div className="hw-field" key={field.label}>
                    <label id={`hw-extra-${field.label.replace(/\W+/g, '-')}`}>{field.label}</label>
                    {field.kind === 'upload' ? (
                      <button
                        type="button"
                        className="hw-upload"
                        aria-labelledby={`hw-extra-${field.label.replace(/\W+/g, '-')}`}
                        onClick={() => pickFile(field.label)}
                      >
                        <img src={asset('r5-create-wizard-upload.svg')} alt="" aria-hidden="true" />
                        <span>{fields[field.label] ?? field.hint}</span>
                      </button>
                    ) : (
                      <input
                        aria-labelledby={`hw-extra-${field.label.replace(/\W+/g, '-')}`}
                        value={fields[field.label] ?? ''}
                        placeholder={field.hint}
                        onChange={(event) =>
                          setFields((current) => ({ ...current, [field.label]: event.target.value }))
                        }
                        autoComplete="off"
                      />
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="hw-actions">
              <button type="button" className="hw-reset" onClick={reset}>
                Reset
              </button>
              <button type="button" className="hw-publish" onClick={publish}>
                Publish
              </button>
            </div>
          </section>
        </div>
      </div>
      {notice && (
        <Modal title="Feature unavailable" className="part2-modal" onClose={() => setNotice('')}>
          <p>{notice}</p>
        </Modal>
      )}
    </Workspace>
  )
}

function PatientPhone({
  type,
  title,
  description,
}: {
  type: ContentType
  title: string
  description: string
}) {
  const heading = title.trim() || 'New content'
  return (
    <div className="hw-phone" aria-hidden="false">
      <div className="hw-phone-screen">
        <div className="hw-phone-hero">
          <span className="hw-phone-notch" aria-hidden="true" />
          <div className="hw-phone-status" aria-hidden="true">
            <span className="hw-phone-time">9:41</span>
            <svg width="52" height="12" viewBox="0 0 52 12" fill="none">
              <path d="M1 11V8.5M5 11V7M9 11V5M13 11V3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M20 4.6a8 8 0 0 1 10 0M22 6.8a5.2 5.2 0 0 1 6 0M25 9a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <rect x="36" y="2.5" width="13" height="7" rx="2" stroke="#fff" />
              <rect x="38" y="4.5" width="7" height="3" rx="0.8" fill="#fff" />
              <path d="M50 4.5v3" stroke="#fff" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="hw-phone-title">{heading}</h3>
        </div>
        <div className="hw-phone-body">
          <PhoneContent type={type} />
          <p className="hw-phone-caption">
            {description.trim() || 'Preview updates as you fill in the form.'}
          </p>
        </div>
        <span className="hw-phone-homebar" aria-hidden="true" />
      </div>
    </div>
  )
}

function PhoneContent({ type }: { type: ContentType }) {
  if (type === 'video' || type === 'audio')
    return (
      <div className={`hw-media-card ${type === 'audio' ? 'is-audio' : ''}`}>
        <span className="hw-media-play" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5 3.4v11.2c0 .5.55.8.98.54l8.4-5.6a.63.63 0 0 0 0-1.07l-8.4-5.6A.63.63 0 0 0 5 3.4Z" fill="#1d919e" />
          </svg>
        </span>
        <span className="hw-media-duration">{type === 'video' ? '12:00' : '8:24'}</span>
      </div>
    )
  if (type === 'article')
    return (
      <div className="hw-article-card">
        <span className="hw-article-cover" />
        <span className="hw-article-line" />
        <span className="hw-article-line short" />
        <span className="hw-article-meta">8 min read</span>
      </div>
    )
  if (type === 'exercise')
    return (
      <div className="hw-widget-card">
        <img src={asset('r5-create-wizard-exercise.svg')} alt="" aria-hidden="true" />
        <span>Interactive exercise</span>
        <button type="button" tabIndex={-1}>Start</button>
      </div>
    )
  if (type === 'worksheet')
    return (
      <div className="hw-widget-card">
        <img src={asset('r5-create-wizard-worksheet.svg')} alt="" aria-hidden="true" />
        <span>Worksheet · PDF</span>
        <button type="button" tabIndex={-1}>Open</button>
      </div>
    )
  if (type === 'goal')
    return (
      <div className="hw-widget-card">
        <img src={asset('r5-create-wizard-goal.svg')} alt="" aria-hidden="true" />
        <span>Weekly goal</span>
        <span className="hw-goal-bar"><i /></span>
        <small>0 of 5 done</small>
      </div>
    )
  return (
    <div className="hw-widget-card">
      <span className="hw-check-question">How do you feel today?</span>
      <span className="hw-check-option">Calm</span>
      <span className="hw-check-option">Anxious</span>
      <span className="hw-check-option">Tired</span>
    </div>
  )
}
