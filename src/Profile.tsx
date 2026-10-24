import { useState, type FormEvent } from 'react'
import { Workspace } from './Workspace'
import type { ApiClient } from './api'
import { LiveProfile } from './api-profile-and-settings-live'
import { Modal } from './ui'
import { asset } from './assets'
import { remainingAssets } from './remaining-assets'
import { FaqSummary, FormActions, RemainingIcon, SettingRow, type RemainingIconName } from './RemainingUI'
import './visual-profile-closure.css'

type Page = 'profile' | 'settings' | 'help'
type Dialog =
  | ''
  | 'edit'
  | 'password'
  | 'preferences'
  | 'hours'
  | 'holidays'
  | 'logout'
  | 'faq'
  | 'contact'
type ProfileData = {
  name: string
  title: string
  specialization: string
  about: string
  phone: string
  email: string
  location: string
}
type Hours = { day: string; enabled: boolean; from: string; to: string }[]
type Holiday = { id: number; reason: string; from: string; to: string }
const initialProfile: ProfileData = {
  name: 'Ahmed Mohamed',
  title: 'Certified Psychotherapist',
  specialization: 'Anxiety and Depression Disorders',
  about:
    "I specialize in anxiety and depression, helping people build tools that hold up in daily life — grounded in eight years of individual and group therapy, and a master's in clinical psychology from King Saud University.",
  phone: '+966 50 123 4567',
  email: 'dr.khaled@example.com',
  location: 'Riyadh, Saudi Arabia',
}
const notificationLabels = [
  'New client messages',
  'Client progress updates',
  'Payment & withdrawal notifications',
  'Platform news and offers',
  'Session reminders',
]
const faqQuestions = [
  'How do I add a new client?',
  'How are my earnings calculated?',
  'What is the Additional Content?',
  'What is the expected processing time for withdrawals?',
  'How do I update my working hours?',
]
const faqAnswers = [
  "From the Clients page, click Add Client and enter the client's basic details, then save.",
  'Demo guidance: the Wallet shows sample session earnings, available balance and withdrawals. No live earnings service is connected.',
  'Demo guidance: additional content supports between-session exercises. The content library is available in the session homework area.',
  'Withdrawals are processed in 3–5 business days according to the supplied design. This demo cannot process withdrawals.',
  'Open Settings, choose Manage Working Hours, select your working days and enter their start and end times.',
]
const dialogTitles: Record<Exclude<Dialog, ''>, string> = {
  edit: 'Edit Profile',
  password: 'Change Password',
  preferences: 'Notification Settings',
  hours: 'Work Hours Management',
  holidays: 'Work Hours Management',
  logout: 'Log out',
  faq: 'Frequently Asked Questions',
  contact: 'Contact support',
}

export function Profile({
  page,
  navigate,
  api,
}: {
  page: Page
  navigate: (path: string) => void
  api?: ApiClient
}) {
  return api ? (
    <LiveProfile page={page} navigate={navigate} api={api} />
  ) : (
    <DemoProfile page={page} navigate={navigate} />
  )
}

function DemoProfile({ page, navigate }: { page: Page; navigate: (path: string) => void }) {
  const state = new URLSearchParams(window.location.search).get('state')
  const [dialog, setDialog] = useState<Dialog>(() =>
    state && Object.hasOwn(dialogTitles, state) ? (state as Dialog) : '',
  )
  const [profile, setProfile] = useState(initialProfile)
  const [notice, setNotice] = useState('')
  const [preferences, setPreferences] = useState([true, false, true, false, true])
  const [hours, setHours] = useState<Hours>(
    ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
      (day, index) => ({ day, enabled: index < 6, from: '', to: '' }),
    ),
  )
  const [holidays, setHolidays] = useState<Holiday[]>([
    { id: 1, reason: 'Annual Leave', from: '2024-06-10', to: '2024-06-15' },
  ])
  const close = () => setDialog('')
  function saved(message: string) {
    close()
    setNotice(`${message} locally for this demo. No backend is connected.`)
  }
  return (
    <Workspace title="Profile" active="Profile" navigate={navigate}>
      <div className={`profile-layout profile-${page}`}>
        <aside className="profile-summary" aria-label="Profile overview">
          <div className="profile-identity">
            <span className="profile-avatar">
              <img src={asset(remainingAssets.profileAvatar)} alt={profile.name} />
              <span className="profile-verified">
                <RemainingIcon name="verified" />
              </span>
            </span>
            <div>
              <h2>{profile.name}</h2>
              <p>Age 28 · Male</p>
            </div>
          </div>
          <button className="remaining-primary profile-edit" onClick={() => setDialog('edit')}>
            Edit Profile
          </button>
          <div className="profile-description">
            <h3>Description</h3>
            <p>
              {profile.title}, {profile.specialization}.
            </p>
          </div>
          <div className="profile-counts">
            <div>
              <strong>89</strong>
              <span>Clients</span>
            </div>
            <div>
              <strong>45</strong>
              <span>Sessions</span>
            </div>
          </div>
        </aside>
        <section className="profile-panel" aria-label="Profile details">
          <nav className="profile-tabs" aria-label="Profile sections">
            {(['profile', 'settings', 'help'] as const).map((tab, index) => (
              <button
                key={tab}
                aria-current={page === tab ? 'page' : undefined}
                aria-label={
                  tab === 'profile' ? 'Profile' : tab === 'settings' ? 'Settings' : 'Help'
                }
                className={page === tab ? 'selected' : ''}
                onClick={() => navigate(tab === 'profile' ? '/profile' : `/profile/${tab}`)}
              >
                <RemainingIcon name={`${tab}${page === tab ? 'Active' : 'Idle'}`} />
                {index === 0
                  ? 'Profile'
                  : index === 1
                    ? page === 'profile'
                      ? 'Upcoming'
                      : 'Settings'
                    : page === 'help'
                      ? 'Help'
                      : 'Completed'}
              </button>
            ))}
          </nav>
          {page === 'profile' && <ProfileInformation profile={profile} />}
          {page === 'settings' && (
            <div className="profile-settings-grid">
              <section className="profile-availability">
                <h3>Availability and Appointments</h3>
                <SettingRow
                  icon="clock"
                  title="Manage Working Hours"
                  badge={`${hours.filter((day) => day.enabled).length} days`}
                  onClick={() => setDialog('hours')}
                />
                <SettingRow
                  icon="briefcase"
                  title="Vacations and Breaks"
                  badge={holidays.length}
                  onClick={() => setDialog('holidays')}
                />
                <button className="remaining-danger" onClick={() => setDialog('logout')}>
                  Log Out
                </button>
              </section>
              <section className="profile-account">
                <h3>Account Settings</h3>
                <SettingRow icon="user" title="Edit Profile" onClick={() => setDialog('edit')} />
                <SettingRow
                  icon="lock"
                  title="Change Password"
                  onClick={() => setDialog('password')}
                />
                <SettingRow
                  icon="bell"
                  title="Notification Settings"
                  onClick={() => setDialog('preferences')}
                />
              </section>
            </div>
          )}
          {page === 'help' && (
            <div className="profile-help-grid">
              <section className="help-live">
                <div>
                  <h3>Need help so fast?</h3>
                  <p>
                    Our support team is available for live chat Sunday to Thursday, 9 AM to 5 PM.
                  </p>
                  <button
                    className="remaining-cancel"
                    onClick={() =>
                      setNotice('Demo only: live chat and phone support are not connected.')
                    }
                  >
                    <span className="help-desktop-call">Give Me A Call</span>
                    <span className="help-compact-chat">Start Live Chat</span>
                  </button>
                </div>
                <small>App version v1.0.0</small>
              </section>
              <section className="help-links">
                <h3>Support &amp; Help</h3>
                <SettingRow
                  icon="faq"
                  chevron="helpArrow"
                  title="FAQs"
                  detail="Quick answers to common questions"
                  onClick={() => setDialog('faq')}
                />
                <SettingRow
                  icon="mail"
                  chevron="helpArrow"
                  title="Email us"
                  detail="Response within 24 hours max"
                  onClick={() => setDialog('contact')}
                />
                <SettingRow
                  icon="phone"
                  title="Contact us"
                  detail="+966 11 000 5000 — Weekdays only"
                  badge="Available now"
                  onClick={() =>
                    setNotice(
                      'Demo only: the design contains a sample support phone number. No call was placed.',
                    )
                  }
                />
              </section>
            </div>
          )}
        </section>
      </div>
      {notice && (
        <p className="remaining-notice" role="status">
          {notice}
          <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
            ×
          </button>
        </p>
      )}
      {dialog && (
        <Modal
          title={dialogTitles[dialog]}
          className={`remaining-modal ${dialog}-modal`}
          closeIcon={<RemainingIcon name="close" />}
          onClose={close}
        >
          {dialog === 'edit' && (
            <EditProfile
              profile={profile}
              onClose={close}
              onSave={(value) => {
                setProfile(value)
                saved('Profile updated')
              }}
            />
          )}
          {dialog === 'password' && (
            <PasswordForm
              onClose={close}
              onSave={() => {
                close()
                setNotice(
                  'Demo only: validation passed, but your password has not been changed. No authentication service is connected.',
                )
              }}
            />
          )}
          {dialog === 'preferences' && (
            <PreferencesForm
              values={preferences}
              onClose={close}
              onSave={(value) => {
                setPreferences(value)
                saved('Notification preferences saved')
              }}
            />
          )}
          {dialog === 'hours' && (
            <HoursForm
              values={hours}
              onClose={close}
              onSave={(value) => {
                setHours(value)
                saved('Working hours saved')
              }}
            />
          )}
          {dialog === 'holidays' && (
            <HolidaysForm values={holidays} onChange={setHolidays} onClose={close} />
          )}
          {dialog === 'logout' && (
            <>
              <p>Are you sure you want to log out of your account?</p>
              <p className="remaining-muted">Demo only: no authenticated server session exists.</p>
              <footer className="remaining-form-actions">
                <button className="remaining-cancel" onClick={close}>
                  Cancel
                </button>
                <button className="remaining-danger" onClick={() => navigate('/login')}>
                  Log out
                </button>
              </footer>
            </>
          )}
          {dialog === 'faq' && (
            <div className="faq-list">
              {faqQuestions.map((question, index) => (
                <details key={question} open={index === 0}>
                  <FaqSummary>{question}</FaqSummary>
                  <p>{faqAnswers[index]}</p>
                </details>
              ))}
            </div>
          )}
          {dialog === 'contact' && (
            <ContactForm
              onClose={close}
              onSend={() => {
                close()
                setNotice(
                  'Demo only: your support message was not sent. No email or support API is connected.',
                )
              }}
            />
          )}
        </Modal>
      )}
    </Workspace>
  )
}

function ProfileInformation({ profile }: { profile: ProfileData }) {
  const professional: [RemainingIconName, string, string][] = [
    ['award', 'License Number', 'PSY-2024-1234'],
    ['calendar', 'Joining Date', '2023-01-15'],
    ['experience', 'Years of Experience', '8 years'],
  ]
  const contact: [RemainingIconName, string, string][] = [
    ['mail', 'Email', profile.email],
    ['phone', 'Mobile Number', profile.phone],
    ['location', 'Location', profile.location],
  ]
  return (
    <div className="profile-information">
      <section className="profile-about">
        <h3>About Me</h3>
        <p>{profile.about}</p>
      </section>
      <div className="profile-information-grid">
        {[
          ['Professional Information', professional],
          ['Contact Information', contact],
        ].map(([heading, rows]) => (
          <section key={heading as string}>
            <h3>{heading as string}</h3>
            <div className="profile-info-rows">
              {(rows as typeof professional).map(([icon, label, value]) => (
                <div className="profile-info-row" key={label}>
                  <RemainingIcon name={icon} />
                  <div>
                    <small>{label}</small>
                    <p>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="profile-credentials">
        <h3>Professional Information</h3>
        <div>
          {professional.map(([, label, value]) => (
            <article key={label}>
              <span className="credential-icon">
                <RemainingIcon name="award" />
              </span>
              <small>{label}</small>
              <p>{value}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function EditProfile({
  profile,
  onClose,
  onSave,
}: {
  profile: ProfileData
  onClose: () => void
  onSave: (value: ProfileData) => void
}) {
  const [draft, setDraft] = useState({
    ...profile,
    name: profile.name === initialProfile.name ? 'Dr. Khaled Al Saadi' : profile.name,
    about:
      profile.about === initialProfile.about
        ? "Certified psychotherapist specializing in anxiety and depression disorders. Holds a master's degree in clinical psychology from King Saud University. Eight years of experience in individual and group therapy."
        : profile.about,
  })
  const [error, setError] = useState('')
  function field(label: string, key: keyof ProfileData, type = 'text') {
    return (
      <label className={`remaining-field profile-field-${key}`}>
        {label}
        <span
          className={key === 'phone' || key === 'location' ? 'editable-profile-field' : undefined}
        >
          <input
            type={type}
            value={draft[key]}
            required
            onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
          />
          {(key === 'phone' || key === 'location') && <RemainingIcon name="pen" />}
        </span>
      </label>
    )
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!Object.values(draft).every((value) => value.trim())) {
      setError('Complete all profile fields; blank spaces are not valid values.')
      return
    }
    onSave(
      Object.fromEntries(
        Object.entries(draft).map(([key, value]) => [key, value.trim()]),
      ) as ProfileData,
    )
  }
  return (
    <form onSubmit={submit}>
      <div className="remaining-field-grid">
        {field('Job Title', 'title')}
        {field('Name', 'name')}
      </div>
      {field('Specialization', 'specialization')}
      <label className="remaining-field">
        General View
        <textarea
          required
          value={draft.about}
          onChange={(event) => setDraft({ ...draft, about: event.target.value })}
        />
      </label>
      <div className="remaining-field-grid">
        {field('Mobile Number', 'phone', 'tel')}
        {field('Email', 'email', 'email')}
      </div>
      {field('Location', 'location')}
      {error && (
        <p className="remaining-error" role="alert">
          {error}
        </p>
      )}
      <FormActions onClose={onClose} />
    </form>
  )
}

function PasswordForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('new'))
    if (password !== data.get('confirm')) setError('The new passwords must match.')
    else if (password === data.get('current')) setError('Choose a different new password.')
    else {
      event.currentTarget.reset()
      onSave()
    }
  }
  return (
    <form onSubmit={submit}>
      {[
        ['Current Password', 'current'],
        ['New Password', 'new'],
        ['Confirm New Password', 'confirm'],
      ].map(([label, name]) => (
        <label className="remaining-field" key={name}>
          {label}
          <input
            type="password"
            name={name}
            autoComplete={name === 'current' ? 'current-password' : 'new-password'}
            required
            minLength={name === 'current' ? 1 : 8}
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="remaining-error">
          {error}
        </p>
      )}
      <FormActions onClose={onClose} />
    </form>
  )
}

function PreferencesForm({
  values,
  onSave,
  onClose,
}: {
  values: boolean[]
  onSave: (value: boolean[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(values)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <div className="preferences-list">
        {notificationLabels.map((label, index) => (
          <label key={label}>
            <span>{label}</span>
            <input
              type="checkbox"
              role="switch"
              checked={draft[index]}
              onChange={(event) =>
                setDraft(
                  draft.map((value, item) => (item === index ? event.target.checked : value)),
                )
              }
            />
          </label>
        ))}
      </div>
      <FormActions onClose={onClose} label="Save Preferences" />
    </form>
  )
}

function HoursForm({
  values,
  onSave,
  onClose,
}: {
  values: Hours
  onSave: (value: Hours) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(values)
  const [error, setError] = useState('')
  function update(index: number, change: Partial<Hours[number]>) {
    setDraft(draft.map((day, i) => (i === index ? { ...day, ...change } : day)))
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const invalid = draft.find(
      (day) => day.enabled && (day.from || day.to) && (!day.from || !day.to || day.from >= day.to),
    )
    if (invalid) setError(`Enter an end time after the start time for ${invalid.day}.`)
    else onSave(draft)
  }
  return (
    <form onSubmit={submit}>
      <div className="hours-list demo-hours-list">
        {draft.map((day, index) => (
          <div key={day.day} className={day.enabled ? '' : 'day-off'}>
            <label>
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(event) => update(index, { enabled: event.target.checked })}
              />
              {day.day}
            </label>
            {day.enabled ? (
              <>
                <input
                  type="time"
                  aria-label={`${day.day} start time`}
                  value={day.from}
                  onChange={(event) => update(index, { from: event.target.value })}
                />
                <span>To</span>
                <input
                  type="time"
                  aria-label={`${day.day} end time`}
                  value={day.to}
                  onChange={(event) => update(index, { to: event.target.value })}
                />
              </>
            ) : (
              <span>Day Off</span>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="remaining-error" role="alert">
          {error}
        </p>
      )}
      <FormActions onClose={onClose} label="Save Preferences" />
    </form>
  )
}

function HolidaysForm({
  values,
  onChange,
  onClose,
}: {
  values: Holiday[]
  onChange: (value: Holiday[]) => void
  onClose: () => void
}) {
  const [error, setError] = useState('')
  const [toMinimum, setToMinimum] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const reason = String(data.get('reason')).trim(),
      from = String(data.get('from')),
      to = String(data.get('to'))
    if (!reason || from > to) {
      setError('Enter a reason and a valid date range.')
      return
    }
    onChange([...values, { id: Date.now(), reason, from, to }])
    setError('')
    event.currentTarget.reset()
    setToMinimum('')
  }
  return (
    <form onSubmit={submit}>
      <label className="remaining-field">
        Reason
        <input name="reason" required placeholder="Example: Annual leave, travel..." />
      </label>
      <div className="remaining-field-grid">
        <label className="remaining-field">
          From
          <input
            type="date"
            name="from"
            required
            onChange={(event) => setToMinimum(event.target.value)}
          />
        </label>
        <label className="remaining-field">
          To
          <input type="date" name="to" required min={toMinimum} />
        </label>
      </div>
      <div className="holiday-list">
        {values.map((holiday) => (
          <article key={holiday.id}>
            <span className="holiday-clock"><RemainingIcon name="pendingMobile" /></span>
            <div className="holiday-copy">
              <strong>{holiday.reason}</strong>
              <p>
                {holiday.from} ← {holiday.to}
              </p>
            </div>
            <button
              type="button"
              className="icon-button holiday-remove"
              aria-label={`Remove ${holiday.reason}`}
              onClick={() => onChange(values.filter((item) => item.id !== holiday.id))}
            >
              <span className="remaining-icon" aria-hidden="true">
                <img src={asset('r4-profile-settings-holiday-remove.svg')} alt="" />
              </span>
            </button>
          </article>
        ))}
      </div>
      {error && (
        <p role="alert" className="remaining-error">
          {error}
        </p>
      )}
      <FormActions onClose={onClose} label="Add Holiday" cancelLabel="Close" />
      <p className="remaining-muted">
        Changes are local to this demo; no calendar service is connected.
      </p>
    </form>
  )
}

function ContactForm({ onClose, onSend }: { onClose: () => void; onSend: () => void }) {
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        if (String(data.get('subject')).trim() && String(data.get('message')).trim()) onSend()
        else setError('Enter a subject and message, not just blank spaces.')
      }}
    >
      <label className="remaining-field">
        Subject
        <input name="subject" required placeholder="Example: Annual leave, travel..." />
      </label>
      <label className="remaining-field">
        Message
        <textarea name="message" placeholder="Example: Annual leave, travel..." required />
      </label>
      <FormActions onClose={onClose} label="Send" />
      {error && (
        <p className="remaining-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
