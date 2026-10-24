import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiClient, ApiError, apiErrorMessage, apiId, type ApiUser } from './api'
import { useApiResource, useApiUser } from './api-hooks'
import { Workspace } from './Workspace'
import { Modal } from './ui'
import { FaqSummary, RemainingIcon, SettingRow, type RemainingIconName } from './RemainingUI'

type Page = 'profile' | 'settings' | 'help'
type Props = { page: Page; navigate: (path: string) => void; api?: ApiClient }
type Therapist = {
  id: string
  full_name: string
  specialty: string
  country: string
  languages: string[] | Record<string, string> | null
  bio: string | null
  rating: number
  approval_status: 'pending' | 'approved' | 'rejected' | null
  has_license: boolean
  availability: Partial<Record<Day, string[]>> | [] | null
}
type Dashboard = {
  therapist: Therapist
  clients_count: number
  stats: { pending: number; confirmed: number; completed: number; today: number }
  timezone: string
}
type Period = { id: string; start_date: string; end_date: string; reason: string | null }
type PeriodBody = { start_date: string; end_date: string | null; reason: string | null }
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type Day = (typeof days)[number]
const titles = {
  edit: 'Edit Profile',
  hours: 'Work Hours Management',
  holidays: 'Vacations and Breaks',
  password: 'Change Password',
  preferences: 'Notification Settings',
  logout: 'Log out',
  faq: 'Frequently Asked Questions',
  contact: 'Contact support',
}
type Dialog = keyof typeof titles | ''
const fieldLabels: Record<string, string> = {
  specialty: 'Specialty',
  country: 'Country',
  languages: 'Languages',
  bio: 'Bio',
  availability: 'Working hours',
  current_password: 'Current password',
  password: 'New password',
  password_confirmation: 'Password confirmation',
  start_date: 'Start date',
  end_date: 'End date',
  reason: 'Reason',
  therapist: 'Therapist profile',
}

function Failure({ error }: { error: unknown }) {
  if (!error) return null
  const labels =
    error instanceof ApiError
      ? [
          ...new Set(
            Object.keys(error.fields)
              .map((key) => fieldLabels[key.split('.')[0]])
              .filter(Boolean),
          ),
        ]
      : []
  return (
    <div className="remaining-error" role="alert">
      <p>
        {apiErrorMessage(error)}
        {error instanceof ApiError && error.retryAfter > 0
          ? ` Retry after ${error.retryAfter} seconds.`
          : ''}
      </p>
      {labels.map((label) => (
        <p key={label}>{label}: Please check this field.</p>
      ))}
    </div>
  )
}

// A synchronous lock prevents double clicks before React updates. Aborting/unmounting
// and actor checks also protect against transports that resolve despite cancellation.
function useMutation(api: ApiClient) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const active = useRef(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      request.current?.abort()
    }
  }, [api])
  async function run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    success: (value: T) => void,
    failed?: (error: unknown) => void,
  ) {
    if (request.current || !active.current || !api.getUser()) return
    const actor = api.getUser()?.id
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(null)
    const current = () =>
      active.current && !controller.signal.aborted && api.getUser()?.id === actor
    try {
      const value = await work(controller.signal)
      if (current()) success(value)
    } catch (cause) {
      if (current()) {
        setError(cause)
        failed?.(cause)
      }
    } finally {
      if (request.current === controller) request.current = null
      if (current()) setPending(false)
    }
  }
  return { pending, error, run }
}

function Actions({
  pending,
  close,
  label = 'Save Changes',
}: {
  pending: boolean
  close: () => void
  label?: string
}) {
  return (
    <footer className="remaining-form-actions">
      <button type="button" className="remaining-cancel" onClick={close}>
        Cancel
      </button>
      <button type="submit" className="remaining-primary" disabled={pending}>
        {pending ? 'Saving…' : label}
      </button>
    </footer>
  )
}

export function LiveProfile({ api, ...props }: Props) {
  return api ? (
    <ProfileBoundary api={api} {...props} />
  ) : (
    <p role="alert">A live API session is required.</p>
  )
}
function ProfileBoundary({ api, ...props }: Omit<Props, 'api'> & { api: ApiClient }) {
  const user = useApiUser(api)
  return user ? (
    <ProfileActor key={api.getSessionKey()} api={api} user={user} {...props} />
  ) : (
    <p role="status">You are signed out. Private profile data has been cleared.</p>
  )
}

function ProfileActor({
  api,
  user,
  page,
  navigate,
}: Omit<Props, 'api'> & { api: ApiClient; user: ApiUser }) {
  const identity = useApiResource<{ user: ApiUser }>(api, '/auth/user')
  const validIdentity =
    identity.data?.user.id === user.id &&
    identity.data.user.role === 'therapist' &&
    identity.data.user.is_active &&
    !!identity.data.user.phone_verified_at
  const dashboard = useApiResource<Dashboard>(
    api,
    validIdentity ? '/therapists/me/dashboard' : null,
  )
  const [savedProfile, setSavedProfile] = useState<Therapist | null>(null)
  const therapist = savedProfile ?? dashboard.data?.therapist ?? null
  const timezone = dashboard.data?.timezone || identity.data?.user.timezone || user.timezone
  const [dialog, setDialog] = useState<Dialog>(() => {
    const requested = new URLSearchParams(window.location.search).get('state')
    return requested && Object.hasOwn(titles, requested) ? (requested as Dialog) : ''
  })
  const [notice, setNotice] = useState('')
  // Keys and uncertain submissions are kept only for this actor, across modal closes.
  const periodKeys = useRef(new Map<string, string>())
  const uncertainPeriod = useRef<PeriodBody | null>(null)
  const close = () => setDialog('')
  function saved(value: Therapist, message: string) {
    setSavedProfile(value)
    close()
    setNotice(message)
  }
  const name = therapist?.full_name || identity.data?.user.name || user.name
  return (
    <Workspace title="Profile" active="Profile" navigate={navigate} api={api}>
      <div className={`profile-layout profile-${page}`}>
        <aside className="profile-summary" aria-label="Profile overview">
          <div className="profile-identity">
            <span className="profile-avatar profile-avatar-initials" aria-label="Profile initials">
              {name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <h2>{name}</h2>
              <p>
                {therapist
                  ? `Approval: ${therapist.approval_status ?? 'Not submitted'}`
                  : 'Therapist account'}
              </p>
            </div>
          </div>
          <button
            className="remaining-primary profile-edit"
            disabled={!therapist}
            onClick={() => setDialog('edit')}
          >
            Edit Profile
          </button>
          <div className="profile-description">
            <h3>Description</h3>
            <p>{therapist?.specialty || 'Professional profile unavailable.'}</p>
          </div>
          {dashboard.data && (
            <div className="profile-counts">
              <div>
                <strong>{dashboard.data.clients_count}</strong>
                <span>Clients</span>
              </div>
              <div>
                <strong>{dashboard.data.stats.completed}</strong>
                <span>Completed sessions</span>
              </div>
            </div>
          )}
        </aside>
        <section className="profile-panel" aria-label="Profile details">
          <nav className="profile-tabs" aria-label="Profile sections">
            {(['profile', 'settings', 'help'] as const).map((tab) => (
              <button
                key={tab}
                aria-current={page === tab ? 'page' : undefined}
                className={page === tab ? 'selected' : ''}
                onClick={() => navigate(tab === 'profile' ? '/profile' : `/profile/${tab}`)}
              >
                <RemainingIcon name={`${tab}${page === tab ? 'Active' : 'Idle'}`} />
                {tab === 'profile' ? 'Profile' : tab === 'settings' ? 'Settings' : 'Help'}
              </button>
            ))}
          </nav>
          {(identity.loading || dashboard.loading) && <p role="status">Loading profile…</p>}
          <Failure error={identity.error || dashboard.error} />
          {(identity.error || dashboard.error) && (
            <>
              <p>
                Professional profile unavailable. Approval or care permissions may be required; the
                API has no unrestricted self-profile read. No sample profile is substituted.
              </p>
              <button
                className="remaining-cancel"
                onClick={() => {
                  setSavedProfile(null)
                  identity.reload()
                  dashboard.reload()
                }}
              >
                Retry profile
              </button>
            </>
          )}
          {identity.data && !validIdentity && (
            <p role="alert">
              An active, phone-verified therapist account is required. Professional profile access
              is unavailable.
            </p>
          )}
          {page === 'profile' && (
            <div className="profile-information">
              <section className="profile-about">
                <h3>About Me</h3>
                <p>
                  {therapist
                    ? therapist.bio || 'No bio provided.'
                    : 'Professional profile unavailable.'}
                </p>
              </section>
              <div className="profile-information-grid">
                <section>
                  <h3>Professional Information</h3>
                  <div className="profile-info-rows">
                    <Info icon="briefcase" label="Specialty" value={therapist?.specialty} />
                    <Info icon="location" label="Country" value={therapist?.country} />
                    <Info
                      icon="user"
                      label="Languages"
                      value={
                        therapist?.languages
                          ? Object.values(therapist.languages).join(', ')
                          : undefined
                      }
                    />
                    <Info
                      icon="award"
                      label="License file"
                      value={
                        therapist
                          ? therapist.has_license
                            ? 'On file (not independent verification)'
                            : 'Not on file'
                          : undefined
                      }
                    />
                    <Info
                      icon="user"
                      label="Approval status"
                      value={therapist?.approval_status ?? undefined}
                    />
                  </div>
                </section>
                <section>
                  <h3>Account Information</h3>
                  <div className="profile-info-rows">
                    <Info
                      icon="user"
                      label="Account name"
                      value={identity.data?.user.name || user.name}
                    />
                    <Info icon="mail" label="Email" value={identity.data?.user.email ?? user.email} />
                    <Info
                      icon="phone"
                      label="Mobile Number"
                      value={identity.data?.user.whatsapp_number || user.whatsapp_number}
                    />
                    <Info icon="clock" label="Scheduling timezone" value={timezone} />
                  </div>
                </section>
              </div>
            </div>
          )}
          {page === 'settings' && (
            <div className="profile-settings-grid">
              <section className="profile-availability">
                <h3>Availability and Appointments</h3>
                <SettingRow
                  icon="clock"
                  title="Manage Working Hours"
                  detail={`Weekly hours in ${timezone || 'your server timezone'}`}
                  onClick={() => setDialog('hours')}
                />
                <SettingRow
                  icon="briefcase"
                  title="Vacations and Breaks"
                  detail="Whole-day blocked periods"
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
                  detail="Preferences unavailable in the API"
                  onClick={() => setDialog('preferences')}
                />
              </section>
            </div>
          )}
          {page === 'help' && (
            <div className="profile-help-grid">
              <section className="help-live">
                <div>
                  <h3>Support availability</h3>
                  <p>
                    Therapist support requests, live chat and callbacks are not supported by the
                    current API. Contact your platform management through your established support
                    channel.
                  </p>
                  <button className="remaining-cancel" disabled>
                    Request a callback (unavailable)
                  </button>
                </div>
              </section>
              <section className="help-links">
                <h3>Support &amp; Help</h3>
                <SettingRow
                  icon="faq"
                  title="FAQs"
                  detail="Published answers from the platform"
                  onClick={() => setDialog('faq')}
                />
                <SettingRow
                  icon="mail"
                  title="Contact support"
                  detail="Therapist ticket submission unavailable"
                  onClick={() => setDialog('contact')}
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
          title={titles[dialog]}
          className={`remaining-modal ${dialog}-modal`}
          closeIcon={<RemainingIcon name="close" />}
          onClose={close}
        >
          {dialog === 'edit' &&
            (therapist ? (
              <EditSettings
                api={api}
                user={identity.data?.user || user}
                therapist={therapist}
                close={close}
                saved={(value) => saved(value, 'Profile settings updated on the server.')}
              />
            ) : (
              <Unavailable close={close} />
            ))}
          {dialog === 'hours' &&
            (therapist && timezone ? (
              <WorkingHours
                api={api}
                therapist={therapist}
                timezone={timezone}
                close={close}
                saved={(value) =>
                  saved(
                    value,
                    'Working hours updated on the server. Existing appointments have not been cancelled.',
                  )
                }
              />
            ) : (
              <Unavailable close={close} />
            ))}
          {dialog === 'holidays' && (
            <BlockedPeriods
              api={api}
              timezone={timezone}
              close={close}
              keys={periodKeys.current}
              uncertain={uncertainPeriod}
            />
          )}
          {dialog === 'password' && (
            <ChangePassword
              api={api}
              close={close}
              saved={() => {
                close()
                setNotice(
                  'Password changed. Other devices have been signed out. Your current session remains active.',
                )
              }}
            />
          )}
          {dialog === 'logout' && <Logout api={api} navigate={navigate} close={close} />}
          {dialog === 'preferences' && (
            <>
              <p>
                Notification preferences cannot be read or saved by the current API. Inbox read
                state is separate from notification delivery preferences.
              </p>
              <fieldset disabled className="preferences-list">
                {[
                  'New client messages',
                  'Client progress updates',
                  'Payment and withdrawal notifications',
                  'Platform news and offers',
                  'Session reminders',
                ].map((label) => (
                  <label key={label}>
                    {label}
                    <input type="checkbox" role="switch" />
                  </label>
                ))}
              </fieldset>
              <button className="remaining-primary" disabled>
                Save Preferences (unavailable)
              </button>
            </>
          )}
          {dialog === 'contact' && (
            <>
              <p>
                Therapist support submission is unavailable. Patient requester routes and staff
                support-management routes are not therapist capabilities. Contact platform
                management through your established channel; no ticket, email or call has been sent.
              </p>
              <fieldset disabled className="live-contact-fields">
                <Field label="Subject">
                  <input placeholder="Subject (unavailable)" />
                </Field>
                <Field label="Message">
                  <textarea placeholder="Message (unavailable)" />
                </Field>
              </fieldset>
              <button className="remaining-primary" disabled>
                Send Message (unavailable)
              </button>
            </>
          )}
          {dialog === 'faq' && <Faqs api={api} />}
        </Modal>
      )}
    </Workspace>
  )
}
function Info({
  icon,
  label,
  value,
}: {
  icon: RemainingIconName
  label: string
  value?: string | null
}) {
  return (
    <div className="profile-info-row">
      <RemainingIcon name={icon} />
      <div>
        <small>{label}</small>
        <p>{value || 'Not provided'}</p>
      </div>
    </div>
  )
}
function Unavailable({ close }: { close: () => void }) {
  return (
    <>
      <p role="alert">
        Professional profile is unavailable. Wait for loading or resolve approval/access issues
        before editing. The API does not provide a self-profile read for all onboarding accounts.
      </p>
      <button className="remaining-cancel" onClick={close}>
        Close
      </button>
    </>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="remaining-field">
      {label}
      {children}
    </label>
  )
}

function EditSettings({
  api,
  user,
  therapist,
  close,
  saved,
}: {
  api: ApiClient
  user: ApiUser
  therapist: Therapist
  close: () => void
  saved: (therapist: Therapist) => void
}) {
  const [draft, setDraft] = useState({
    specialty: therapist.specialty,
    country: therapist.country,
    languages: Object.values(therapist.languages ?? []).join(', '),
    bio: therapist.bio ?? '',
  })
  const [validation, setValidation] = useState('')
  const mutation = useMutation(api)
  function submit(event: FormEvent) {
    event.preventDefault()
    const languages = draft.languages
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    if (
      !draft.specialty.trim() ||
      !draft.country.trim() ||
      languages.some((item) => item.length > 10)
    ) {
      setValidation(
        'Enter specialty and country; each comma-separated language must be at most 10 characters.',
      )
      return
    }
    setValidation('')
    const body = {
      specialty: draft.specialty.trim(),
      country: draft.country.trim(),
      languages,
      bio: draft.bio.trim() || null,
    }
    void mutation.run(
      (signal) =>
        api.request<{ data: Therapist }>('/therapists/me/settings', 'PUT', { body, signal }),
      (result) => saved(result.data),
    )
  }
  return (
    <form onSubmit={submit}>
      <p className="remaining-muted">
        Identity and contact details are server-owned and cannot be changed here. Only specialty,
        country, languages and bio are supported.
      </p>
      <Field label="Professional name">
        <input disabled value={therapist.full_name} />
      </Field>
      <div className="remaining-field-grid">
        <Field label="Email">
          <input disabled value={user.email ?? ''} />
        </Field>
        <Field label="Mobile Number">
          <input disabled value={user.whatsapp_number} />
        </Field>
      </div>
      <fieldset disabled={mutation.pending}>
        <Field label="Specialty">
          <input
            required
            maxLength={255}
            value={draft.specialty}
            onChange={(event) => setDraft({ ...draft, specialty: event.target.value })}
          />
        </Field>
        <Field label="Country">
          <input
            required
            maxLength={100}
            value={draft.country}
            onChange={(event) => setDraft({ ...draft, country: event.target.value })}
          />
        </Field>
        <Field label="Languages (comma-separated)">
          <input
            value={draft.languages}
            onChange={(event) => setDraft({ ...draft, languages: event.target.value })}
          />
        </Field>
        <Field label="Bio (optional)">
          <textarea
            maxLength={2000}
            value={draft.bio}
            onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
          />
        </Field>
      </fieldset>
      {validation && (
        <p className="remaining-error" role="alert">
          {validation}
        </p>
      )}
      <Failure error={mutation.error} />
      <Actions pending={mutation.pending} close={close} />
    </form>
  )
}

type WindowDraft = { from: string; to: string }
function WorkingHours({
  api,
  therapist,
  timezone,
  close,
  saved,
}: {
  api: ApiClient
  therapist: Therapist
  timezone: string
  close: () => void
  saved: (therapist: Therapist) => void
}) {
  const [draft, setDraft] = useState<Record<Day, WindowDraft[]>>(
    () =>
      Object.fromEntries(
        days.map((day) => [
          day,
          (therapist.availability && !Array.isArray(therapist.availability)
            ? (therapist.availability[day] ?? [])
            : []
          ).map((window) => {
            const [from, to] = window.split('-')
            return { from, to }
          }),
        ]),
      ) as Record<Day, WindowDraft[]>,
  )
  const [validation, setValidation] = useState('')
  const mutation = useMutation(api)
  function update(day: Day, index: number, value: Partial<WindowDraft>) {
    setDraft({
      ...draft,
      [day]: draft[day].map((window, item) => (item === index ? { ...window, ...value } : window)),
    })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    for (const day of days) {
      const windows = [...draft[day]].sort((a, b) => a.from.localeCompare(b.from))
      if (
        windows.some(
          (window, index) =>
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.from) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.to) ||
            window.to <= window.from ||
            (index > 0 && window.from < windows[index - 1].to),
        )
      ) {
        setValidation(
          `Enter complete, non-overlapping start/end times for ${day}; end must be after start. Overnight hours are not supported.`,
        )
        return
      }
    }
    setValidation('')
    // All seven days are submitted: the server replaces, rather than merges, this map.
    const availability = Object.fromEntries(
      days.map((day) => [day, draft[day].map(({ from, to }) => `${from}-${to}`)]),
    )
    void mutation.run(
      (signal) =>
        api.request<{ data: Therapist }>('/therapists/me/settings', 'PUT', {
          body: { availability },
          signal,
        }),
      (result) => saved(result.data),
    )
  }
  return (
    <form onSubmit={submit}>
      <p>
        All times are wall-clock hours in {timezone}, not your browser timezone. Saving replaces the
        entire weekly schedule. Days with no windows are off.
      </p>
      <p className="remaining-muted">
        Updates change future bookability; existing appointments are not cancelled or rescheduled.
      </p>
      <fieldset disabled={mutation.pending} className="hours-list live-hours-list">
        {days.map((day) => (
          <section className="live-hours-day" key={day}>
            <h3>{day[0].toUpperCase() + day.slice(1)}</h3>
            {!draft[day].length && <p>Off</p>}
            {draft[day].map((window, index) => (
              <div className="live-hours-window" key={index}>
                <Field label={`${day} start ${index + 1}`}>
                  <input
                    type="time"
                    required
                    value={window.from}
                    onChange={(event) => update(day, index, { from: event.target.value })}
                  />
                </Field>
                <Field label={`${day} end ${index + 1}`}>
                  <input
                    type="time"
                    required
                    value={window.to}
                    onChange={(event) => update(day, index, { to: event.target.value })}
                  />
                </Field>
                <button
                  className="remaining-cancel"
                  type="button"
                  aria-label={`Remove ${day} window ${index + 1}`}
                  onClick={() =>
                    setDraft({ ...draft, [day]: draft[day].filter((_, item) => item !== index) })
                  }
                >
                  Remove window
                </button>
              </div>
            ))}
            <button
              type="button"
              className="remaining-cancel"
              onClick={() => setDraft({ ...draft, [day]: [...draft[day], { from: '', to: '' }] })}
            >
              Add {day} window
            </button>
          </section>
        ))}
      </fieldset>
      {validation && (
        <p className="remaining-error" role="alert">
          {validation}
        </p>
      )}
      <Failure error={mutation.error} />
      <Actions pending={mutation.pending} close={close} />
    </form>
  )
}

function localDate(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    return ['year', 'month', 'day']
      .map((part) => parts.find((item) => item.type === part)?.value)
      .join('-')
  } catch {
    return undefined
  }
}
function BlockedPeriods({
  api,
  timezone,
  close,
  keys,
  uncertain,
}: {
  api: ApiClient
  timezone: string
  close: () => void
  keys: Map<string, string>
  uncertain: { current: PeriodBody | null }
}) {
  const periods = useApiResource<{ data: Period[] }>(api, '/therapists/me/blocked-periods')
  const mutation = useMutation(api)
  const reconciliation = useMutation(api)
  const [draft, setDraft] = useState<PeriodBody>(
    uncertain.current ?? { start_date: '', end_date: '', reason: '' },
  )
  const [locked, setLocked] = useState(!!uncertain.current)
  const [validation, setValidation] = useState('')
  const [notice, setNotice] = useState('')
  const today = localDate(timezone)
  function submit(event: FormEvent) {
    event.preventDefault()
    const end = draft.end_date || draft.start_date
    const span =
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${draft.start_date}T00:00:00Z`)) / 86400000 + 1
    if (
      !today ||
      !draft.start_date ||
      draft.start_date < today ||
      end < draft.start_date ||
      !Number.isFinite(span) ||
      span > 90
    ) {
      setValidation(
        'Use current or future dates in your scheduling timezone, with an inclusive range of at most 90 days.',
      )
      return
    }
    setValidation('')
    const body = {
      start_date: draft.start_date,
      end_date: end,
      reason: draft.reason?.trim() || null,
    }
    const signature = JSON.stringify(body)
    const key = keys.get(signature) ?? crypto.randomUUID()
    keys.set(signature, key)
    // Mark before dispatch so closing an in-flight modal cannot forget an ambiguous result.
    uncertain.current = body
    void mutation.run(
      (signal) =>
        api.request<{ data: Period }>('/therapists/me/blocked-periods', 'POST', {
          body,
          signal,
          idempotencyKey: key,
        }),
      () => {
        uncertain.current = null
        keys.delete(signature)
        setLocked(false)
        setDraft({ start_date: '', end_date: '', reason: '' })
        setNotice('Blocked period added on the server.')
        periods.reload()
      },
      (error) => {
        const ambiguous =
          !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500 ||
          error.status === 409
        uncertain.current = ambiguous ? body : null
        setLocked(ambiguous)
      },
    )
  }
  function reconcile() {
    void reconciliation.run(
      (signal) => api.get<{ data: Period[] }>('/therapists/me/blocked-periods', signal),
      (result) => {
        const body = uncertain.current
        const matching =
          body &&
          result.data.some(
            (period) =>
              period.start_date === body.start_date &&
              period.end_date === (body.end_date || body.start_date) &&
              (period.reason || null) === body.reason,
          )
        uncertain.current = null
        setLocked(false)
        if (matching) {
          setDraft({ start_date: '', end_date: '', reason: '' })
          setNotice(
            'A matching blocked period is present on the server. Review the list before submitting another.',
          )
        } else
          setNotice(
            'Server list refreshed. An identical retry retains its original idempotency key.',
          )
        periods.reload()
      },
    )
  }
  function remove(id: string) {
    void mutation.run(
      (signal) => api.request(`/therapists/me/blocked-periods/${apiId(id)}`, 'DELETE', { signal }),
      () => {
        setNotice('Blocked period removed on the server.')
        periods.reload()
      },
    )
  }
  const busy = mutation.pending || reconciliation.pending
  return (
    <div>
      <p>
        Whole-day inclusive blocks in {timezone || 'your server timezone'}. Overlapping blocks or
        pending/confirmed appointments may prevent a new block. Existing appointments must be
        cancelled or rescheduled first.
      </p>
      {periods.loading && <p role="status">Loading blocked periods…</p>}
      <Failure error={periods.error} />
      <button
        type="button"
        className="remaining-cancel"
        disabled={busy}
        onClick={locked ? reconcile : periods.reload}
      >
        Refresh blocked periods
      </button>
      {!periods.loading && periods.data?.data.length === 0 && <p>No blocked periods.</p>}
      <div className="holiday-list">
        {periods.data?.data.map((period) => (
          <article key={period.id}>
            <span className="holiday-clock"><RemainingIcon name="pendingMobile" /></span>
            <div className="holiday-copy">
              <strong>{period.reason || 'No reason provided'}</strong>
              <p>{period.start_date} – {period.end_date}</p>
            </div>
            <button
              className="icon-button holiday-remove"
              disabled={busy || locked}
              aria-label={`Remove blocked period ${period.start_date}`}
              onClick={() => remove(period.id)}
            >
              <RemainingIcon name="close" />
            </button>
          </article>
        ))}
      </div>
      {locked && (
        <p role="alert">
          The previous result is uncertain or conflicted. Refresh the server list before editing or
          retry this identical submission with its original key.
        </p>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy || locked || !!periods.error || periods.loading || !today}>
          <div className="remaining-field-grid">
            <Field label="Start date">
              <input
                type="date"
                required
                min={today}
                value={draft.start_date}
                onChange={(event) => setDraft({ ...draft, start_date: event.target.value })}
              />
            </Field>
            <Field label="End date (optional)">
              <input
                type="date"
                min={draft.start_date || today}
                value={draft.end_date ?? ''}
                onChange={(event) => setDraft({ ...draft, end_date: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Reason (optional)">
            <input
              maxLength={200}
              value={draft.reason ?? ''}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </Field>
        </fieldset>
        {validation && (
          <p className="remaining-error" role="alert">
            {validation}
          </p>
        )}
        <Failure error={mutation.error || reconciliation.error} />
        {notice && <p role="status">{notice}</p>}
        <Actions
          pending={busy || !!periods.error || periods.loading || !today}
          close={close}
          label={locked ? 'Retry identical submission' : 'Add blocked period'}
        />
      </form>
    </div>
  )
}

function ChangePassword({
  api,
  close,
  saved,
}: {
  api: ApiClient
  close: () => void
  saved: () => void
}) {
  const mutation = useMutation(api)
  const [validation, setValidation] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const body = {
      current_password: String(data.get('current_password') ?? ''),
      password: String(data.get('password') ?? ''),
      password_confirmation: String(data.get('password_confirmation') ?? ''),
    }
    if (
      body.password !== body.password_confirmation ||
      body.password === body.current_password ||
      body.password.length < 8
    ) {
      setValidation(
        'Use a different password of at least eight characters and matching confirmation.',
      )
      return
    }
    setValidation('')
    void mutation.run(
      (signal) => api.request('/auth/user/password', 'PUT', { body, signal }),
      () => {
        form.reset()
        saved()
      },
    )
  }
  return (
    <form onSubmit={submit}>
      <p>A successful change signs out other devices, not this session.</p>
      <fieldset disabled={mutation.pending}>
        {(
          [
            ['Current Password', 'current_password'],
            ['New Password', 'password'],
            ['Confirm New Password', 'password_confirmation'],
          ] as const
        ).map(([label, name]) => (
          <Field label={label} key={name}>
            <input
              type="password"
              name={name}
              required
              minLength={name === 'current_password' ? 1 : 8}
              autoComplete={name === 'current_password' ? 'current-password' : 'new-password'}
            />
          </Field>
        ))}
      </fieldset>
      {validation && (
        <p className="remaining-error" role="alert">
          {validation}
        </p>
      )}
      <Failure error={mutation.error} />
      <Actions pending={mutation.pending} close={close} />
    </form>
  )
}
function Logout({
  api,
  navigate,
  close,
}: {
  api: ApiClient
  navigate: (path: string) => void
  close: () => void
}) {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [started, setStarted] = useState(false)
  async function logout() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setStarted(true)
    let revoked = true
    try {
      await api.logout()
    } catch {
      revoked = false
    } finally {
      // logout intentionally unmounts private data as soon as local credentials clear.
      // Navigation must survive that unmount, but must not redirect a new signed-in actor.
      if (!api.getUser()) navigate(revoked ? '/login' : '/login?logout=revocation-unknown')
    }
  }
  // Stage the explanation before local clearing can unmount this dialog.
  return (
    <>
      <p>Log out of this device and revoke its server session?</p>
      <p role={started ? 'status' : undefined}>
        If the server cannot confirm revocation, you will still be signed out locally, but remote
        revocation is unknown and the session may remain active on the server.
      </p>
      <footer className="remaining-form-actions">
        <button className="remaining-cancel" disabled={pending} onClick={close}>
          Cancel
        </button>
        <button
          className="remaining-danger"
          disabled={pending}
          onClick={() => {
            void logout()
          }}
        >
          {pending ? 'Logging out…' : 'Log out'}
        </button>
      </footer>
    </>
  )
}
function Faqs({ api }: { api: ApiClient }) {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<{
    data: { id: string; question: string; answer: string }[]
    pagination: { current_page: number; last_page: number }
  } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    setState(null)
    api
      .request<NonNullable<typeof state>>(`/faqs?page=${page}`, 'GET', {
        public: true,
        signal: controller.signal,
      })
      .then((result) => {
        if (active) {
          setState(result)
          setLoading(false)
        }
      })
      .catch((cause) => {
        if (active && !controller.signal.aborted) {
          setError(cause)
          setLoading(false)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [api, page, revision])
  return (
    <div className="faq-list">
      {loading && <p role="status">Loading FAQs…</p>}
      <Failure error={error} />
      {!!error && (
        <button className="remaining-cancel" onClick={() => setRevision((value) => value + 1)}>
          Retry FAQs
        </button>
      )}
      {state?.data.length === 0 && <p>No published FAQs.</p>}
      {state?.data.map((faq, index) => (
        <details key={faq.id} open={index === 0}>
          <FaqSummary>{faq.question}</FaqSummary>
          <p>{faq.answer}</p>
        </details>
      ))}
      {state && (
        <footer className="remaining-form-actions">
          <button
            className="remaining-cancel"
            disabled={loading || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous FAQs
          </button>
          <span>
            Page {state.pagination.current_page} of {state.pagination.last_page}
          </span>
          <button
            className="remaining-cancel"
            disabled={loading || page >= state.pagination.last_page}
            onClick={() => setPage(page + 1)}
          >
            Next FAQs
          </button>
        </footer>
      )}
    </div>
  )
}
