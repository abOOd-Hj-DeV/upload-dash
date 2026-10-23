import { useState } from 'react'
import { asset } from './assets'
import { ApiClient } from './api'
import { DesignIcon, Workspace } from './Workspace'
import { DeleteTemplateDialog } from './DeleteTemplateDialog'
import { Modal } from './ui'

type HomeworkLibraryProps = { navigate: (path: string) => void; api?: ApiClient }
type LibraryVariant = 'empty' | 'list' | 'published' | 'preview' | 'no-patients'
type Tab = 'content' | 'patients'

function isDemoMode() {
  return import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
}

const variants: LibraryVariant[] = ['empty', 'list', 'published', 'preview', 'no-patients']

type FixtureRow = {
  title: string
  type: string
  duration: string
  patients: number
  status: string[]
  fresh?: boolean
}

// Development design fixtures only; the live view stays on the honest empty
// library and never fabricates clinical operations.
const fixtureRows: readonly FixtureRow[] = [
  {
    title: 'Daily Small Activity',
    type: 'Article / Lesson',
    duration: '10 min read',
    patients: 0,
    status: ['Published v2', '4 long-text fields', 'Not inserted yet'],
    fresh: true,
  },
  {
    title: 'Daily Breathing Exercise',
    type: 'Video',
    duration: '12 min',
    patients: 14,
    status: ['Published v1', 'Assigned'],
  },
  {
    title: 'Sleep Journal',
    type: 'Interactive Exercise',
    duration: '5 min',
    patients: 8,
    status: ['Published v1', 'Assigned'],
  },
  {
    title: 'Worry Time Practice',
    type: 'Goal',
    duration: '15 min',
    patients: 3,
    status: ['Draft', 'Not inserted yet'],
  },
]

const fixturePatients = [
  { name: 'Saad Ali', completion: '92%', status: 'On track' },
  { name: 'Jamal Thompson', completion: '71%', status: 'Review due' },
  { name: 'Yaser Ramirez', completion: '100%', status: 'On track' },
  { name: 'Maya Patel', completion: '64%', status: 'On track' },
  { name: 'Noah Bennett', completion: '38%', status: 'Review due' },
] as const

const clinicalNeeds = ['All needs', 'Anxiety', 'Depression', 'Sleep', 'Stress', 'Mood']
const contentTypes = [
  'All types',
  'Interactive Exercise',
  'Video',
  'Audio',
  'Article / Lesson',
  'Goal',
  'Quick Check',
]

const instructions =
  'Choose one small activity — no longer than 10 minutes — and do it without waiting for motivation. Then record what you did and how you felt before and after.'

export function HomeworkLibrary({ navigate, api }: HomeworkLibraryProps) {
  const requested = new URLSearchParams(window.location.search).get('state')
  const normalized = requested === 'published-success' ? 'published' : requested
  const demo = isDemoMode()
  const deleteTemplate = demo && normalized === 'delete-template'
  const variant: LibraryVariant = deleteTemplate
    ? 'list'
    : demo && variants.includes(normalized as LibraryVariant)
      ? (normalized as LibraryVariant)
      : 'empty'
  const [notice, setNotice] = useState('')
  const [deleteDismissed, setDeleteDismissed] = useState(false)
  const [search, setSearch] = useState('')
  const [need, setNeed] = useState('All needs')
  const [type, setType] = useState('All types')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [tab, setTab] = useState<Tab>(variant === 'no-patients' ? 'patients' : 'content')
  const isDetails = variant === 'preview' || variant === 'no-patients'

  function unavailable(label: string) {
    setNotice(
      api
        ? `${label}: this feature is not available in the therapist API.`
        : `${label}: local design preview only — no homework service is connected.`,
    )
  }
  function openCreate() {
    if (api) unavailable('Create New Homework')
    else navigate('/homework/create')
  }

  const query = search.trim().toLocaleLowerCase()
  const rows = fixtureRows.filter(
    (row) =>
      (type === 'All types' || row.type === type) &&
      row.title.toLocaleLowerCase().includes(query),
  )
  const listVisible = variant === 'list' || variant === 'published'

  return (
    <Workspace
      title={
        <>
          <span className="r5-hw-crumb">Additional Content / </span>
          {isDetails ? 'Homework Details' : 'Homework Library'}
        </>
      }
      mobileTitle={isDetails ? 'Homework Details' : 'Sakina Library'}
      active="Additional Content"
      navigate={navigate}
      onSearch={isDetails || api ? undefined : setSearch}
      api={api}
    >
      <div className={`r5-homework r5-variant-${variant}`}>
        {!isDetails && (
          <header className="r5-hw-header">
            <h2>Homework Library</h2>
            <p>
              <span className="r5-hw-sub-long">
                Manage, organize, and assign clinical homework resources to your patients.
              </span>
              <span className="r5-hw-sub-short">Assign clinical exercises to patients.</span>
            </p>
            <div className="r5-hw-filters">
              <label className="r5-hw-select">
                <span className="sr-only">Filter by Clinical needs</span>
                <select aria-label="Filter by Clinical needs" value={need} onChange={(e) => setNeed(e.target.value)}>
                  {clinicalNeeds.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="r5-hw-select">
                <span className="sr-only">Filter by type</span>
                <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
                  {contentTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="r5-hw-search">
                <DesignIcon name="part2-03-imgSearch.svg" />
                <input
                  aria-label="Search homework templates"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
          </header>
        )}
        {variant === 'published' && !bannerDismissed && (
          <p className="r5-hw-banner" role="status">
            <CheckIcon />
            Homework published successfully.
            <button aria-label="Dismiss publish notice" onClick={() => setBannerDismissed(true)}>
              ×
            </button>
          </p>
        )}
        {listVisible ? (
          <section className="r5-hw-list" aria-label="Homework templates">
            {rows.map((row) => (
              <button
                key={row.title}
                type="button"
                className="r5-hw-row"
                onClick={() => (api ? unavailable(row.title) : navigate('/homework?state=preview'))}
              >
                <span className="r5-hw-row-main">
                  <span className="r5-hw-row-title">{row.title}</span>
                  <span className="r5-hw-chip r5-hw-chip-type">{row.type}</span>
                </span>
                <span className="r5-hw-row-meta">
                  <span className="r5-hw-row-detail">
                    <DesignIcon name="dashboard-imgClockThree.svg" />
                    {row.duration}
                  </span>
                  <span className="r5-hw-row-detail">
                    <DesignIcon name="dashboard-imgSquareUserCheck.svg" />
                    {row.patients === 0
                      ? 'No patients'
                      : `${row.patients} patient${row.patients === 1 ? '' : 's'}`}
                  </span>
                </span>
                <span className={`r5-hw-status ${row.fresh ? 'r5-hw-status-fresh' : ''}`}>
                  {row.status.map((part, i) => (
                    <span key={part}>
                      {i > 0 && <i aria-hidden="true" />}
                      {part}
                    </span>
                  ))}
                </span>
                <ChevronIcon />
              </button>
            ))}
            {!rows.length && (
              <p className="r5-hw-empty-result" role="status">
                No homework templates match this filter.
              </p>
            )}
          </section>
        ) : !isDetails ? (
          <section className="r5-hw-empty" aria-label="Empty homework library">
            <span className="r5-hw-empty-icon">
              <DesignIcon name="r5-library-states-sparkles.svg" />
            </span>
            <h3>No homework templates yet</h3>
            <p>
              Create your first homework template to start assigning clinical exercises and
              tracking your patient progress.
            </p>
            <button type="button" className="r5-hw-cta" onClick={openCreate}>
              <PlusIcon /> Create New Homework
            </button>
          </section>
        ) : null}
        {isDetails && (
          <DetailsView
            api={api}
            navigate={navigate}
            tab={tab}
            setTab={setTab}
            empty={variant === 'no-patients'}
            onUnavailable={unavailable}
          />
        )}
      </div>
      {notice && (
        <Modal
          title={api ? 'Feature unavailable' : 'Frontend demo'}
          className="part2-modal"
          onClose={() => setNotice('')}
        >
          <p>{notice}</p>
        </Modal>
      )}
      {deleteTemplate && !deleteDismissed && (
        <DeleteTemplateDialog
          templateName="Daily Breathing Exercise"
          assignedCount={14}
          onClose={() => setDeleteDismissed(true)}
          onDelete={() => {
            setDeleteDismissed(true)
            setNotice('Demo only: no template was deleted. No backend is connected.')
          }}
        />
      )}
    </Workspace>
  )
}

function DetailsView({
  api,
  navigate,
  tab,
  setTab,
  empty,
  onUnavailable,
}: {
  api?: ApiClient
  navigate: (path: string) => void
  tab: Tab
  setTab: (tab: Tab) => void
  empty: boolean
  onUnavailable: (label: string) => void
}) {
  const stats = empty
    ? [
        { label: 'Total Times Assigned', value: '0 times', chip: 'No activity' },
        { label: 'Average Completion Rate', value: '0.0%', chip: 'N/A' },
        { label: 'Patient Average Rating', value: '—', chip: 'No reviews yet' },
      ]
    : [
        { label: 'Total Times Assigned', value: '48 times', chip: '+12% this mo' },
        { label: 'Average Completion Rate', value: '92.4%', chip: '+4% vs avg' },
        { label: 'Patient Average Rating', value: '4.8 / 5', chip: 'Highly Effective' },
      ]
  const patientCount = empty ? 0 : 14
  return (
    <>
      <header className="r5-hd-header">
        <button
          type="button"
          className="icon-button r5-hd-back"
          aria-label="Back to Homework Library"
          onClick={() => navigate(isDemoMode() ? '/homework?state=list' : '/homework')}
        >
          <DesignIcon name="r5-library-states-arrow-left.svg" />
        </button>
        <div className="r5-hd-titles">
          <h2>Daily Breathing Exercise</h2>
          <p>Manage and review patient template preview.</p>
        </div>
        {!empty && (
          <button
            type="button"
            className="soft-button r5-hd-edit-top"
            onClick={() => (api ? onUnavailable('Edit Template') : navigate('/homework/create'))}
          >
            Edit Template
          </button>
        )}
      </header>
      <div className="r5-hd-stats">
        {stats.map((stat) => (
          <section key={stat.label} className="r5-hd-stat">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span className={`r5-hd-chip ${empty ? 'r5-hd-chip-muted' : ''}`}>{stat.chip}</span>
          </section>
        ))}
      </div>
      <div className="r5-hd-tabs" role="tablist" aria-label="Homework detail views">
        <button
          role="tab"
          aria-selected={tab === 'content'}
          aria-label="Content & Preview"
          className={tab === 'content' ? 'selected' : ''}
          onClick={() => setTab('content')}
        >
          <span className="r5-hd-tab-long" aria-hidden="true">
            Content &amp; Preview
          </span>
          <span className="r5-hd-tab-short" aria-hidden="true">
            Preview
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'patients'}
          aria-label={`Assigned Patients (${patientCount})`}
          className={tab === 'patients' ? 'selected' : ''}
          onClick={() => setTab('patients')}
        >
          <span className="r5-hd-tab-long" aria-hidden="true">
            Assigned Patients ({patientCount})
          </span>
          <span className="r5-hd-tab-short" aria-hidden="true">
            Patients ({patientCount})
          </span>
        </button>
      </div>
      {tab === 'content' ? (
        <div className="r5-hd-panels">
          <TemplateCard onUnavailable={onUnavailable} api={api} navigate={navigate} />
          <PatientPreview />
        </div>
      ) : empty ? (
        <section className="r5-hw-empty r5-hd-no-patients" aria-label="No patients assigned">
          <span className="r5-hw-empty-icon">
            <DesignIcon name="r5-library-states-users.svg" />
          </span>
          <h3>No patients assigned yet</h3>
          <p>
            Assign this template to one or more of your active clinical patients to begin
            collecting logs.
          </p>
          <button type="button" className="r5-hw-cta" onClick={() => onUnavailable('Assign Homework Now')}>
            Assign Homework Now
          </button>
        </section>
      ) : (
        <section className="r5-hd-patient-list" aria-label="Assigned patients">
          {fixturePatients.map((patient) => (
            <div key={patient.name} className="r5-hd-patient-row">
              <span className="r5-hd-patient-avatar" aria-hidden="true">
                {patient.name.slice(0, 1)}
              </span>
              <span className="r5-hd-patient-name">{patient.name}</span>
              <span className="r5-hd-patient-completion">{patient.completion} completed</span>
              <span className="r5-hd-chip">{patient.status}</span>
            </div>
          ))}
        </section>
      )}
    </>
  )
}

function TemplateCard({
  api,
  navigate,
  onUnavailable,
}: {
  api?: ApiClient
  navigate: (path: string) => void
  onUnavailable: (label: string) => void
}) {
  return (
    <section className="r5-hd-card" aria-label="Template Details">
      <header className="r5-hd-card-head">
        <h3>Template Details</h3>
        <span className="r5-hw-chip r5-hw-chip-type">Breathing Exercise</span>
      </header>
      <dl className="r5-hd-fields">
        <dt>Title</dt>
        <dd>Daily Small Activity</dd>
        <dt>Instructions / Description</dt>
        <dd>{instructions}</dd>
      </dl>
      <div className="r5-hd-uploads">
        <button type="button" onClick={() => onUnavailable('Upload video')}>
          <DesignIcon name="r5-library-states-upload.svg" />
          Click here to Upload new video file
        </button>
        <button type="button" onClick={() => onUnavailable('Upload thumbnail')}>
          <DesignIcon name="r5-library-states-upload.svg" />
          Click here to Upload new thumbnail
        </button>
      </div>
      <div className="r5-hd-card-foot">
        <button
          type="button"
          className="teal-button r5-hd-edit"
          onClick={() => (api ? onUnavailable('Edit template') : navigate('/homework/create'))}
        >
          Edit template
        </button>
      </div>
    </section>
  )
}

function PatientPreview() {
  return (
    <section className="r5-hd-card r5-hd-preview-card" aria-label="Patient Preview">
      <header className="r5-hd-card-head">
        <h3>Patient Preview</h3>
        <span className="r5-hd-chip">Live Preview</span>
      </header>
      <div className="r5-hd-phone">
        <div className="r5-hd-phone-status">
          <span>9:41</span>
          <span className="r5-hd-phone-notch" />
          <span className="r5-hd-phone-signal" aria-hidden="true" />
        </div>
        <div className="r5-hd-phone-appbar">
          <span className="r5-hd-phone-back" aria-hidden="true">
            ‹
          </span>
          <strong>Breathing Exercise 7,8,9</strong>
        </div>
        <div className="r5-hd-phone-body">
          <div className="r5-hd-phone-video">
            <img src={asset('r5-library-states-preview-thumb.svg')} alt="" />
            <span className="r5-hd-phone-time">4:10</span>
            <span className="r5-hd-phone-total">12:00</span>
          </div>
          <h4>Daily Small Activity</h4>
          <p>{instructions}</p>
          <span className="r5-hd-phone-done">Completed</span>
        </div>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="r5-hw-row-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="#98a2ae" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
