import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, type ApiSession } from '../src/api'
import { Dashboard } from '../src/Dashboard'
import { Sessions } from '../src/Sessions'
import { SessionDetails } from '../src/SessionDetails'
import {
  careCategory,
  careDate,
  careMeetingUrl,
  type CareClient,
  type CareContent,
  type CareSession,
} from '../src/api-sessions-and-clinical-support'

const therapistId = '11111111-1111-4111-8111-111111111111'
const patientId = '22222222-2222-4222-8222-222222222222'
const sessionId = '33333333-3333-4333-8333-333333333333'
const contentId = '44444444-4444-4444-8444-444444444444'
const moduleId = '55555555-5555-4555-8555-555555555555'
const secondId = '66666666-6666-4666-8666-666666666666'
const userSession: ApiSession = {
  user: {
    id: therapistId,
    name: 'Real therapist',
    email: null,
    whatsapp_number: '',
    role: 'therapist',
    is_active: true,
    phone_verified_at: '2025-01-01T00:00:00Z',
    timezone: 'Asia/Riyadh',
  },
  access_token: 'test-access',
  refresh_token: 'r'.repeat(64),
  token_type: 'Bearer',
  expires_at: '2099-01-01T00:00:00Z',
  refresh_expires_at: '2099-02-01T00:00:00Z',
}
const canonical: CareSession = {
  id: sessionId,
  patient_id: patientId,
  therapist_id: therapistId,
  session_date: '2025-01-01',
  session_time: '10:00:00',
  starts_at: '2025-01-01T10:00:00Z',
  local: { date: '2025-01-01', time: '13:00', timezone: 'Asia/Riyadh' },
  medium: 'meet',
  price: '0.00',
  status: 'confirmed',
  is_initial: false,
  payment_status: 'free',
  link: 'https://meet.google.com/abc-defg-hij',
  summary: null,
  report_revision: 0,
  attendance_confirmed_at: '2025-01-01T10:00:00Z',
  reschedule: null,
  cancellation: null,
}
const client: CareClient = {
  id: patientId,
  full_name: 'Actual client',
  age: 34,
  gender: 'female',
  language: 'ar',
  status: 'active',
  completed_sessions_count: 7,
}
const content: CareContent = {
  id: contentId,
  title: 'Real library exercise',
  content_type: 'text',
  body: '<script>not executable</script>',
  url: null,
  assigned_patients: [],
}
type Call = {
  path: string
  method: string
  body: unknown
  key: string | null
  signal: AbortSignal | null | undefined
}
type Override = (call: Call) => Response | Promise<Response> | undefined
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function harness(
  options: {
    session?: Partial<CareSession>
    past?: boolean
    pagination?: boolean
    override?: Override
  } = {},
) {
  let current = { ...canonical, ...options.session }
  let shared = false
  let created = false
  let hidden = false
  let recommendation: {
    note: string
    revision: number
    package: { id: string; name: string }
    program: null
  } | null = null
  const notes: { id: string; session_id: string | null; body: string; created_at: string }[] = []
  const calls: Call[] = []
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const headers = new Headers(init?.headers)
    const call = {
      path: url.pathname.replace('/api/v1', '') + url.search,
      method: init?.method || 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      key: headers.get('Idempotency-Key'),
      signal: init?.signal,
    }
    calls.push(call)
    const custom = options.override?.(call)
    if (custom) return custom
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/therapists/me/dashboard')
      return json({
        therapist: {
          id: therapistId,
          full_name: 'Real therapist',
          rating: 4.2,
          approval_status: 'approved',
        },
        clients_count: 1,
        clients_limit: 10,
        can_accept_clients: true,
        stats: { pending: 2, confirmed: 3, completed: 7, today: 4 },
        timezone: 'Asia/Riyadh',
        upcoming_sessions: [{ summary: 'raw rows must not be used as canonical cards' }],
      })
    if (path === '/therapists/me/sessions')
      return json({
        data:
          options.pagination && url.searchParams.get('page') === '2'
            ? [{ ...current, id: secondId, status: 'completed' }]
            : [current],
        pagination: {
          current_page: Number(url.searchParams.get('page')),
          last_page: options.pagination ? 2 : 1,
          total: options.pagination ? 2 : 1,
        },
      })
    if (path === '/therapists/clients')
      return json({
        data: [{ ...client, status: options.past ? 'past' : 'active' }],
        pagination: { current_page: 1, last_page: 1, total: 1 },
      })
    if (path === `/therapists/clients/${patientId}`)
      return json({
        client,
        clinical: {
          assessment_score: 9,
          safety_flag: false,
          compliance_level: 'medium',
          latest_assessment: { type: 'phq9', score: 9, completed_at: '2025-01-01T00:00:00Z' },
        },
        sessions: [current],
        stats: { total_sessions: 1, completed: 0, cancelled: 0 },
      })
    if (path === `/therapists/clients/${patientId}/notes`) {
      if (call.method === 'POST') {
        const payload = call.body as { body: string; session_id?: string }
        notes.push({
          id: contentId,
          session_id: payload.session_id || null,
          body: payload.body,
          created_at: '2025-01-01T00:00:00Z',
        })
        return json({ message: 'Note added.', note: notes[notes.length - 1] }, 201)
      }
      return json({ notes, session_reports: [] })
    }
    if (path === `/therapists/clients/${patientId}/modules`)
      return json({
        patient_id: patientId,
        has_active_subscription: true,
        programs: [
          {
            id: secondId,
            name: 'Real program',
            modules: [
              {
                id: moduleId,
                title: 'Real module',
                is_hideable: true,
                is_hidden: hidden,
                locked: false,
                lock_reason: null,
                status: 'pending',
                completed_at: null,
                homework_prompt: 'Describe your day',
                homework: { response: 'Actual patient response' },
                homework_submitted_at: '2025-01-01T00:00:00Z',
              },
            ],
          },
        ],
      })
    if (path === `/therapists/clients/${patientId}/modules/${moduleId}/hide`) {
      hidden = call.method === 'POST'
      return json({ message: 'Visibility updated.', module: { id: moduleId, is_hidden: hidden } })
    }
    if (path === '/therapists/content') {
      if (call.method === 'POST') {
        created = true
        shared = true
        return json({ content }, 201)
      }
      const item = {
        ...content,
        assigned_patients: shared
          ? [{ id: patientId, name: client.full_name, assigned_at: null }]
          : [],
      }
      return json({
        data: {
          data:
            url.searchParams.has('patient_id') && !shared
              ? []
              : created
                ? [item, { ...item, id: secondId, title: 'New created content' }]
                : [item],
          current_page: 1,
          last_page: 1,
          total: 1,
        },
      })
    }
    if (path === `/therapists/content/${contentId}/assign` && call.method === 'POST') {
      shared = true
      return json({ content })
    }
    if (
      path === `/therapists/content/${contentId}/assign/${patientId}` &&
      call.method === 'DELETE'
    ) {
      shared = false
      return json({ content })
    }
    if (path === `/sessions/${sessionId}/recommendation`) {
      if (call.method === 'PUT')
        recommendation = {
          note: String((call.body as { note: string }).note),
          revision: 2,
          package: { id: contentId, name: 'Existing package' },
          program: null,
        }
      return json({
        recommendation: recommendation || {
          note: 'Existing continuity',
          revision: 1,
          package: { id: contentId, name: 'Existing package' },
          program: null,
        },
      })
    }
    if (path === `/sessions/${sessionId}`) return json({ session: current, status_log: [] })
    if (path.startsWith(`/sessions/${sessionId}/`) && call.method === 'POST') {
      if (path.endsWith('/confirm')) current = { ...current, status: 'confirmed' }
      if (path.endsWith('/complete') || path.endsWith('/report'))
        current = {
          ...current,
          status: 'completed',
          summary: (call.body as { summary: string }).summary,
        }
      if (path.endsWith('/cancel') || path.endsWith('/cancel/decide'))
        current = { ...current, status: 'cancelled', cancellation: null }
      if (path.endsWith('/reschedule/decide')) current = { ...current, reschedule: null }
      if (path.endsWith('/link'))
        current = { ...current, link: (call.body as { link: string }).link }
      return json({ session: current })
    }
    return json({ message: 'not available' }, 404)
  })
  const api = new ApiClient('https://api.example.test/api/v1', transport as typeof fetch)
  await api.establish(userSession)
  return { api, calls, transport, writes: () => calls.filter((call) => call.method !== 'GET') }
}

beforeEach(() => {
  window.history.replaceState({}, '', `/sessions/upcoming?id=${sessionId}`)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

function expectNoPatientActions(calls: Call[]) {
  expect(
    calls.some(
      (call) =>
        call.path === '/sessions' ||
        call.path.startsWith('/sessions?') ||
        call.path === '/sessions/book' ||
        /\/(attendance|proof)$/.test(call.path) ||
        /\/sessions\/[^/]+\/reschedule$/.test(call.path) ||
        call.path.startsWith('/patients/'),
    ),
  ).toBe(false)
}

describe('live therapist sessions and clinical records', () => {
  it('loads all owned session pages, joins real clients, and routes by UUID', async () => {
    const state = await harness({ pagination: true })
    const navigate = vi.fn()
    render(<Sessions api={state.api} navigate={navigate} />)
    expect(await screen.findByRole('heading', { name: 'All Sessions' })).toBeInTheDocument()
    expect(
      state.calls.some((call) => call.path === '/therapists/me/sessions?per_page=50&page=2'),
    ).toBe(true)
    expect(screen.getAllByText('Actual client')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Schedule New' })).toBeDisabled()
    expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Open session for Actual client' })[0],
    )
    expect(navigate).toHaveBeenCalledWith(`/sessions/upcoming?id=${sessionId}`)
    expectNoPatientActions(state.calls)
  })

  it('uses dashboard counts, not raw dashboard sessions or fictional attendance/trends', async () => {
    const state = await harness()
    render(<Dashboard api={state.api} navigate={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Real therapist' })).toBeInTheDocument()
    expect(screen.getByText('You have 4 pending or confirmed sessions today.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Completed sessions' }).parentElement,
    ).toHaveTextContent('7')
    expect(screen.queryByText(/Attendance Rate/)).not.toBeInTheDocument()
    expect(screen.queryByText(/raw rows must/)).not.toBeInTheDocument()
    expectNoPatientActions(state.calls)
  })

  it('direct-client routes load the actual clinical record and post a private note without a fake session', async () => {
    window.history.replaceState({}, '', `/sessions/upcoming?client=${patientId}`)
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    const input = await screen.findByRole('textbox', { name: 'New Note' })
    await userEvent.type(input, 'Actual private clinical note')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Add Note' }))
    await screen.findByText('Actual private clinical note')
    expect(state.writes()[0]).toMatchObject({
      path: `/therapists/clients/${patientId}/notes`,
      body: { body: 'Actual private clinical note' },
    })
    expect(state.calls.some((call) => call.path.startsWith('/sessions/'))).toBe(false)
    expect(screen.getByText('Actual patient response', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expectNoPatientActions(state.calls)
  })

  it('never substitutes a name/client query for the patient on the canonical session', async () => {
    window.history.replaceState(
      {},
      '',
      `/sessions/upcoming?id=${sessionId}&client=${secondId}&patient=Fake`,
    )
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Actual client' })
    await userEvent.click(screen.getByRole('tab', { name: 'Session record' }))
    await userEvent.type(screen.getByLabelText('New Note'), 'Session-bound private note')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Add Note' }))
    await waitFor(() => expect(state.writes()).toHaveLength(1))
    expect(state.writes()[0].body).toEqual({
      body: 'Session-bound private note',
      session_id: sessionId,
    })
    expect(state.calls.some((call) => call.path.includes(`/clients/${secondId}`))).toBe(false)
  })

  it('keeps former-client current assessments/homework private and disables new clinical writes', async () => {
    const state = await harness({ past: true })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    expect(await screen.findByText(/This is a former client/)).toBeInTheDocument()
    expect(
      state.calls.some(
        (call) =>
          call.path.startsWith(`/therapists/clients/${patientId}`) ||
          call.path.startsWith('/therapists/content'),
      ),
    ).toBe(false)
    expect(screen.queryByRole('button', { name: 'Add Note' })).not.toBeInTheDocument()
    expectNoPatientActions(state.calls)
  })

  it('does not load or edit clinical recommendations for a former client completed session', async () => {
    const state = await harness({
      past: true,
      session: { status: 'completed', summary: 'Historical shared report' },
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await screen.findByText('Clinical record unavailable')
    expect(screen.getByText('Historical shared report', { selector: 'p' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Edit recommendation' })).not.toBeInTheDocument()
    expect(state.calls.some((call) => call.path.endsWith('/recommendation'))).toBe(false)
    expect(state.writes()).toHaveLength(0)
  })

  it('confirms only payment-eligible sessions and does not fabricate patient attendance', async () => {
    const state = await harness({ session: { status: 'pending', attendance_confirmed_at: null } })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirm session' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirm session' }))
    await waitFor(() => expect(state.writes()[0]?.path).toBe(`/sessions/${sessionId}/confirm`))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Complete session' })).toBeDisabled(),
    )
    expect(screen.getByText(/Therapists cannot mark attendance/)).toBeInTheDocument()
    expectNoPatientActions(state.calls)
  })

  it('requires an explicit destructive warning for cancellation rejection, which also cancels', async () => {
    const state = await harness({
      session: {
        cancellation: { pending: true, requested_at: '2025-01-01T00:00:00Z', forfeited: false },
      },
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel with forfeiture' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel with forfeiture' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('ALSO CANCELS')
    expect(dialog).toHaveTextContent('does not keep the appointment')
    expect(state.writes()).toHaveLength(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }))
    await waitFor(() =>
      expect(state.writes()[0]).toMatchObject({
        path: `/sessions/${sessionId}/cancel/decide`,
        body: { approve: false },
      }),
    )
    expectNoPatientActions(state.calls)
  })

  it('uses therapist reschedule decisions instead of a patient-only reschedule proposal', async () => {
    const state = await harness({
      session: {
        reschedule: { date: '2098-01-01', time: '09:00:00', local: null, requested_at: null },
      },
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reject reschedule' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reject reschedule' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm change' }),
    )
    await waitFor(() =>
      expect(state.writes()[0]).toMatchObject({
        path: `/sessions/${sessionId}/reschedule/decide`,
        body: { action: 'reject' },
      }),
    )
    expectNoPatientActions(state.calls)
  })

  it('labels report submission as patient-visible completion and saves only the server report schema', async () => {
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await userEvent.type(
      await screen.findByLabelText('Patient-visible session report'),
      'A patient-visible clinical report',
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit report and complete' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Submit report and complete' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('COMPLETE the session')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm change' }),
    )
    await waitFor(() =>
      expect(state.writes()[0]).toMatchObject({
        path: `/sessions/${sessionId}/report`,
        body: { summary: 'A patient-visible clinical report' },
      }),
    )
    expectNoPatientActions(state.calls)
  })

  it('preserves package/program on completed recommendation replacement', async () => {
    const state = await harness({ session: { status: 'completed' } })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit recommendation' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Edit recommendation' }))
    const input = await screen.findByLabelText('Continuity note')
    fireEvent.change(input, { target: { value: 'New continuity' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save recommendation' }))
    await waitFor(() =>
      expect(state.writes()[0]).toMatchObject({
        path: `/sessions/${sessionId}/recommendation`,
        method: 'PUT',
        body: { note: 'New continuity', package_id: contentId, program_id: null },
      }),
    )
  })

  it('uses nested library pagination, escaped text, correct content schema and a stable key on retry', async () => {
    let failed = false
    const state = await harness({
      override: (call) => {
        if (call.path === '/therapists/content' && call.method === 'POST' && !failed) {
          failed = true
          return json({ message: 'SECRET raw exception' }, 503)
        }
      },
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add New Homework' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add New Homework' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('<script>not executable</script>')).toBeInTheDocument()
    expect(dialog.querySelector('script')).toBeNull()
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Create New' }))
    await userEvent.type(within(dialog).getByLabelText('Homework title'), 'Real text homework')
    await userEvent.type(within(dialog).getByLabelText('Content body'), 'Read this text')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create and assign content' }))
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('The server could not complete'),
    )
    expect(screen.queryByText(/SECRET raw exception/)).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Create and assign content' }),
      ).toBeEnabled(),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create and assign content' }))
    await waitFor(() => expect(state.writes()).toHaveLength(2))
    expect(state.writes()[0].body).toEqual({
      title: 'Real text homework',
      content_type: 'text',
      body: 'Read this text',
      url: null,
      patient_ids: [patientId],
    })
    expect(state.writes()[0].key).toMatch(/^[0-9a-f-]{36}$/)
    expect(state.writes()[1].key).toBe(state.writes()[0].key)
    expect(state.writes()[1].body).toEqual(state.writes()[0].body)
    expectNoPatientActions(state.calls)
  })

  it('does not report a failed note as saved, retains drafts, and blocks duplicate/in-flight submissions', async () => {
    let rejectRequest: ((response: Response) => void) | undefined
    const state = await harness({
      override: (call) =>
        call.method === 'POST' && call.path.endsWith('/notes')
          ? new Promise<Response>((resolve) => {
              rejectRequest = resolve
            })
          : undefined,
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Session record' }))
    await userEvent.type(await screen.findByLabelText('New Note'), 'Keep this failed draft')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled())
    const button = screen.getByRole('button', { name: 'Add Note' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(state.writes()).toHaveLength(1))
    await act(async () =>
      rejectRequest?.(
        json({ message: 'raw-secret', errors: { body: ['sensitive server field'] } }, 422),
      ),
    )
    await screen.findByText('Please check the submitted information. Check: body.')
    expect(screen.getByLabelText('New Note')).toHaveValue('Keep this failed draft')
    expect(
      screen.queryByText(/raw-secret|sensitive server field|Private therapist note added/),
    ).not.toBeInTheDocument()
  })

  it('unmounts drafts and aborts pending writes when the actor logs out', async () => {
    const state = await harness({
      override: (call) =>
        call.method === 'POST' && call.path.endsWith('/notes')
          ? new Promise<Response>(() => {})
          : undefined,
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Session record' }))
    await userEvent.type(await screen.findByLabelText('New Note'), 'Sensitive unsaved draft')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Add Note' }))
    const pending = state.writes()[0]
    act(() => state.api.clear())
    expect(screen.queryByLabelText('New Note')).not.toBeInTheDocument()
    expect(screen.queryByText('Actual client')).not.toBeInTheDocument()
    expect(pending.signal?.aborted).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in')
  })

  it('shows sanitized permission errors rather than a demo fallback', async () => {
    const state = await harness({
      override: (call) =>
        call.path.startsWith('/therapists/me/sessions')
          ? json({ message: 'private server exception' }, 403)
          : undefined,
    })
    render(<Sessions api={state.api} navigate={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This action is not permitted')
    expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
    expect(screen.queryByText('private server exception')).not.toBeInTheDocument()
    expectNoPatientActions(state.calls)
  })

  it('saves a real permitted meeting link and immediately cancels only after confirmation', async () => {
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    const input = await screen.findByRole('textbox', { name: 'Meeting URL' })
    fireEvent.change(input, { target: { value: 'https://meet.google.com/fresh-link' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save meeting link' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save meeting link' }))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Join meeting' })).toHaveAttribute(
        'href',
        'https://meet.google.com/fresh-link',
      ),
    )
    expect(state.writes()[0]).toMatchObject({
      path: `/sessions/${sessionId}/link`,
      body: { link: 'https://meet.google.com/fresh-link' },
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cancel session' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('record is retained')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm change' }),
    )
    await waitFor(() =>
      expect(state.writes()[1]).toMatchObject({
        path: `/sessions/${sessionId}/cancel`,
        method: 'POST',
        body: undefined,
      }),
    )
    expectNoPatientActions(state.calls)
  })

  it('completes an attendance-confirmed started session without fabricating attendance', async () => {
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Complete session' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Complete session' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('patient-visible')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm change' }),
    )
    await waitFor(() =>
      expect(state.writes()[0]).toMatchObject({
        path: `/sessions/${sessionId}/complete`,
        body: { summary: null },
      }),
    )
    expectNoPatientActions(state.calls)
  })

  it('assigns existing content additively, then removes only this patient share', async () => {
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add New Homework' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add New Homework' }))
    const add = await within(screen.getByRole('dialog')).findByRole('button', {
      name: 'Add Real library exercise',
    })
    await waitFor(() => expect(add).toBeEnabled())
    await userEvent.click(add)
    await within(screen.getByRole('dialog')).findByRole('button', {
      name: 'Added Real library exercise',
    })
    expect(state.writes()[0]).toMatchObject({
      path: `/therapists/content/${contentId}/assign`,
      body: { patient_ids: [patientId] },
    })
    expect(state.writes()[0].key).toBeTruthy()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove assignment' })).toBeEnabled(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Remove assignment' }))
    await waitFor(() =>
      expect(state.writes()[1]).toMatchObject({
        path: `/therapists/content/${contentId}/assign/${patientId}`,
        method: 'DELETE',
      }),
    )
    expect(state.writes().some((call) => call.path === `/therapists/content/${contentId}`)).toBe(
      false,
    )
    expectNoPatientActions(state.calls)
  })

  it('changes only module visibility; completion and submitted homework stay patient-owned', async () => {
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hide module' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Hide module' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unhide module' })).toBeEnabled())
    expect(state.writes()[0]).toMatchObject({
      path: `/therapists/clients/${patientId}/modules/${moduleId}/hide`,
      method: 'POST',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Unhide module' }))
    await waitFor(() =>
      expect(state.writes()[1]).toMatchObject({
        path: `/therapists/clients/${patientId}/modules/${moduleId}/hide`,
        method: 'DELETE',
      }),
    )
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expectNoPatientActions(state.calls)
  })

  it('refetches after an uncertain non-idempotent note and never blindly duplicates it', async () => {
    const state = await harness({
      override: (call) =>
        call.method === 'POST' && call.path.endsWith('/notes')
          ? json({ message: 'hidden exception' }, 503)
          : undefined,
    })
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Session record' }))
    await userEvent.type(await screen.findByLabelText('New Note'), 'Retain this uncertain note')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Add Note' }))
    await screen.findByText(/The result may be unknown or conflicted/)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'I reviewed the refreshed records' }),
      ).toBeEnabled(),
    )
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeDisabled()
    expect(screen.getByLabelText('New Note')).toHaveValue('Retain this uncertain note')
    expect(state.writes()).toHaveLength(1)
    expect(state.writes()[0].key).toBeNull()
    expect(
      state.calls.filter((call) => call.path.endsWith('/notes') && call.method === 'GET').length,
    ).toBeGreaterThan(1)
    expectNoPatientActions(state.calls)
  })

  it('invalid UUID routes never fetch a patient/session or choose a demo patient', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming?id=session-1&patient=Ahmed')
    const state = await harness()
    render(<SessionDetails api={state.api} navigate={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('valid UUID')
    expect(state.calls).toHaveLength(0)
    expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
  })
})

describe('canonical timing and safe meeting controls', () => {
  it('takes starts_at as authoritative and classifies today in the account timezone', () => {
    const value = {
      ...canonical,
      starts_at: '2026-01-01T22:00:00Z',
      session_date: '1999-01-01',
      local: null,
    }
    expect(careCategory(value, 'Asia/Riyadh', Date.parse('2026-01-02T01:00:00Z'))).toBe('Today')
    expect(careDate(value, 'Asia/Riyadh')).toContain('2 Jan 2026')
    expect(careDate(value, 'Asia/Riyadh')).toContain('01:00')
    expect(careCategory({ ...value, status: 'completed' }, 'Asia/Riyadh')).toBe('Previous')
  })
  it('accepts only confirmed HTTPS links with the correct medium host and no URL credentials', () => {
    expect(careMeetingUrl(canonical)).toBe('https://meet.google.com/abc-defg-hij')
    for (const value of [
      'javascript:alert(1)',
      'http://meet.google.com/a',
      'https://meet.google.com.evil.test/a',
      'https://name:pass@meet.google.com/a',
      'https://zoom.us/a',
    ])
      expect(careMeetingUrl({ ...canonical, link: value })).toBeNull()
    expect(careMeetingUrl({ ...canonical, status: 'pending' })).toBeNull()
    expect(careMeetingUrl({ ...canonical, status: 'completed' })).toBeNull()
  })
})
