import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, type ApiSession } from '../src/api'
import { SessionDetails } from '../src/SessionDetails'
import { Sessions } from '../src/Sessions'
import type { CareClient, CareSession } from '../src/api-sessions-and-clinical-support'
import { existsSync, readFileSync } from 'node:fs'

const careStyles = readFileSync('src/visual-sessions-clinical.css', 'utf8')

const therapistId = '11111111-1111-4111-8111-111111111111'
const patientId = '22222222-2222-4222-8222-222222222222'
const sessionId = '33333333-3333-4333-8333-333333333333'
const contentId = '44444444-4444-4444-8444-444444444444'
const credentials: ApiSession = {
  user: {
    id: therapistId, name: 'Test therapist', email: null, whatsapp_number: '',
    role: 'therapist', is_active: true, phone_verified_at: '2025-01-01T00:00:00Z', timezone: 'UTC',
  },
  access_token: 'unit-test-access', refresh_token: 'r'.repeat(64), token_type: 'Bearer',
  expires_at: '2099-01-01T00:00:00Z', refresh_expires_at: '2099-02-01T00:00:00Z',
}
const client: CareClient = {
  id: patientId, full_name: 'Test client', age: 34, gender: 'female', language: 'ar',
  status: 'active', completed_sessions_count: 1,
}
const session: CareSession = {
  id: sessionId, patient_id: patientId, therapist_id: therapistId,
  session_date: '2025-01-01', session_time: '10:00:00', starts_at: '2025-01-01T10:00:00Z',
  local: { date: '2025-01-01', time: '10:00', timezone: 'UTC' }, medium: 'meet', price: '0.00', status: 'confirmed', is_initial: false, payment_status: 'free',
  link: null, summary: null, report_revision: 0, attendance_confirmed_at: null,
  reschedule: null, cancellation: null,
}
const json = (data: unknown) => new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json' },
})

async function careApi() {
  const writes: string[] = []
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace('/api/v1', '')
    if (init?.method && init.method !== 'GET') writes.push(path)
    if (path === '/therapists/me/sessions') return json({ data: [session], pagination: { current_page: 1, last_page: 1, total: 1 } })
    if (path === '/therapists/clients') return json({ data: [client], pagination: { current_page: 1, last_page: 1, total: 1 } })
    if (path === `/sessions/${sessionId}`) return json({ session, status_log: [{ id: 'history', from_status: 'pending', to_status: 'confirmed', created_at: '2025-01-01', actor: null }] })
    if (path === `/therapists/clients/${patientId}`) return json({
      client, clinical: { assessment_score: null, safety_flag: false, compliance_level: null, latest_assessment: null },
      sessions: [], stats: { total_sessions: 0, completed: 0, cancelled: 0 },
    })
    if (path.endsWith('/notes')) return json({ notes: [], session_reports: [] })
    if (path.endsWith('/modules')) return json({ patient_id: patientId, has_active_subscription: true, programs: [{
      id: 'program', name: 'Test program', modules: ['completed', 'pending'].map((status) => ({
        id: status, title: `Test ${status} module`, status, is_hidden: false, is_hideable: true,
        locked: false, lock_reason: null, completed_at: null, homework_prompt: null, homework: null, homework_submitted_at: null,
      })),
    }] })
    if (path === '/therapists/content') return json({ data: { data: url.searchParams.has('patient_id') ? [] : [{
      id: contentId, title: 'Test assigned article', content_type: 'text', body: 'Test text', url: null,
      assigned_patients: [{ id: patientId, name: client.full_name, assigned_at: null }],
    }], current_page: 1, last_page: 1, total: 1 } })
    return new Response('{}', { status: 404 })
  })
  const api = new ApiClient('https://api.example.test/api/v1', transport as typeof fetch)
  await api.establish(credentials)
  return { api, writes }
}

beforeEach(() => {
  window.history.replaceState({}, '', `/sessions/upcoming?id=${sessionId}`)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('sessions and clinical visual markup contracts', () => {
  it('places the live sessions header outside the scrolling table and uses contextual initials', async () => {
    const { api } = await careApi()
    window.history.replaceState({}, '', '/sessions')
    const { container } = render(<Sessions api={api} navigate={vi.fn()} />)
    const region = await screen.findByRole('region', { name: 'All Sessions' })
    const header = within(region).getByRole('heading', { name: 'All Sessions' }).parentElement!
    expect(header.parentElement).toBe(region)
    expect(header.nextElementSibling).toHaveClass('sessions-list-scroll')
    const avatar = container.querySelector('.patient-cell .care-avatar')!
    expect(avatar).toHaveClass('avatar')
    expect(avatar).not.toHaveClass('initials')
    expect(avatar).toHaveTextContent('Tc')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.patient-cell img')).toBeNull()
    expect(screen.getByRole('button', { name: 'Schedule New' })).toBeDisabled()
  })

  it('labels a direct clinical record Patients while session details stay under Sessions', async () => {
    const { api } = await careApi()
    window.history.replaceState({}, '', `/sessions/upcoming?client=${patientId}`)
    const page = render(<SessionDetails api={api} navigate={vi.fn()} />)
    expect(screen.getByText('Patients / Clinical record')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Patients' })).toHaveAttribute('aria-current', 'page')
    page.unmount()
    window.history.replaceState({}, '', `/sessions/upcoming?id=${sessionId}`)
    render(<SessionDetails api={api} navigate={vi.fn()} />)
    expect(screen.getByText('Sessions / Session record')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
  })

  it('uses the detail avatar size without borrowing a fixture patient photo', async () => {
    const { api } = await careApi()
    const { container } = render(<SessionDetails api={api} navigate={vi.fn()} />)
    await screen.findByRole('heading', { name: client.full_name })
    expect(container.querySelector('.detail-client .care-avatar')).toHaveClass('detail-avatar')
    expect(container.querySelector('.detail-client img')).toBeNull()
  })

  it('orders live actions after tabs, then clinical grid and history without hiding them', async () => {
    const { api } = await careApi()
    const { container } = render(<SessionDetails api={api} navigate={vi.fn()} />)
      const history = await screen.findByRole('heading', { name: 'Session status history' })
      const root = container.querySelector('.care-session-detail')!
      const actions = root.querySelector('.care-session-actions')!
      const grid = root.querySelector('.detail-grid')!
      expect(root.querySelector('.detail-tabs')).toBeTruthy()
      expect(actions.parentElement).toBe(root)
      expect(grid.parentElement).toBe(root)
      expect(history.closest('.care-session-history')?.parentElement).toBe(root)
      expect(careStyles).toMatch(/\.care-session-detail > \.care-session-actions\s*\{[^}]*order:\s*2;/)
      expect(careStyles).toMatch(/\.care-session-detail > \.detail-grid,[^}]*order:\s*3;/)
      expect(careStyles).toMatch(/\.care-session-detail > \.care-session-history\s*\{[^}]*order:\s*4;/)
  })

  it('keeps selected library filters and assigned rows visibly distinct without enabling reassignment', async () => {
    const { api, writes } = await careApi()
    render(<SessionDetails api={api} navigate={vi.fn()} />)
    const open = await screen.findByRole('button', { name: 'Add New Homework' })
    await waitFor(() => expect(open).toBeEnabled())
    fireEvent.click(open)
    const dialog = screen.getByRole('dialog')
    const filters = within(dialog).getByRole('group', { name: 'Content type filters' })
    const all = within(filters).getByRole('button', { name: 'All' })
    expect(all).toHaveClass('selected')
    const text = within(filters).getByRole('button', { name: 'text' })
    fireEvent.click(text)
    expect(text).toHaveClass('selected')
    expect(text).toHaveAttribute('aria-pressed', 'true')
    expect(all).not.toHaveClass('selected')
    const added = await within(dialog).findByRole('button', { name: 'Added Test assigned article' })
    expect(added).toHaveClass('added')
    expect(added).toBeDisabled()
    fireEvent.click(added)
    expect(writes).toEqual([])
  })

  it('redirects the removed demo homework dialog states while the live dialog keeps its sizing', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=create')
    const navigate = vi.fn()
    const demo = render(<SessionDetails navigate={navigate} />)
    expect(navigate).toHaveBeenCalledWith('/homework/create')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(careStyles).toMatch(/\.part2-modal\.homework-modal\.is-create\s*\{[^}]*width:\s*min\(500px/)
    demo.unmount()
    window.history.replaceState({}, '', '/sessions/upcoming?state=library')
    render(<SessionDetails navigate={navigate} />)
    expect(navigate).toHaveBeenCalledWith('/homework')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps schedule demo-only and matches its evidenced modal width without changing native inputs', () => {
    window.history.replaceState({}, '', '/sessions?state=schedule')
    render(<Sessions navigate={vi.fn()} />)
    const schedule = screen.getByRole('dialog')
    expect(schedule).toHaveClass('schedule-modal')
    expect(careStyles).toMatch(/\.part2-modal\.schedule-modal\s*\{[^}]*width:\s*min\(415px/)
    expect(careStyles).toMatch(/\.part2-modal\.schedule-modal \.modal-heading\s*\{[^}]*margin-bottom:\s*16px/)
    expect(careStyles).toMatch(/\.part2-modal\.schedule-modal \.part2-form label\s*\{[^}]*line-height:\s*16px;[^}]*gap:\s*10px/)
    expect(careStyles).toMatch(/\.part2-modal\.schedule-modal \.form-footer\s*\{[^}]*margin-top:\s*0/)
    expect(within(schedule).getByLabelText(/Patient/i).tagName).toBe('SELECT')
    expect(careStyles).toMatch(/\.part2-modal\.schedule-modal \.form-footer button\s*\{[^}]*font:\s*600 14px\/16px 'IBM Plex Sans Arabic'[^}]*padding:\s*10px 16px/)
  })

  it('scopes the table panel and segmented tabs to the demo sessions list', () => {
    window.history.replaceState({}, '', '/sessions')
    const { container } = render(<Sessions navigate={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'All Sessions' })).toHaveClass('demo-all-sessions')
    expect(container.querySelector('.demo-sessions-toolbar .session-tabs')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Schedule New' }).querySelector('img')).toBeTruthy()
    expect(careStyles).toMatch(/\.demo-all-sessions\s*\{[^}]*background:\s*#fff/)
    expect(careStyles).toMatch(/\.demo-all-sessions \.all-sessions-table\s*\{[^}]*border-spacing:\s*0 11px/)
  })

  it('uses the existing grain asset only on the demo summary and the evidenced action-menu tokens', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=actions')
    const { container } = render(<SessionDetails navigate={vi.fn()} />)
    expect(container.querySelector('.clinical-summary')).toBeTruthy()
    expect(container.querySelector('.session-actions-menu')).toBeTruthy()
    expect(careStyles).toMatch(/\.session-detail \.clinical-summary\s*\{[^}]*background:\s*rgba\(35, 148, 161, 0\.1\)/)
    expect(careStyles).toMatch(/\.session-detail \.clinical-summary::before\s*\{[^}]*opacity:\s*0\.02/)
    expect(existsSync('public/assets/dashboard-imgFrame2147234885.png')).toBe(true)
    expect(careStyles).toMatch(/\.session-detail \.session-actions-menu\s*\{[^}]*width:\s*199px/)
    expect(careStyles).toMatch(/\.session-detail \.session-actions-menu button\s*\{[^}]*letter-spacing:\s*-0\.42px/)
  })

  it('renders completed and pending module indicators while retaining read-only patient completion', async () => {
    const { api, writes } = await careApi()
    render(<SessionDetails api={api} navigate={vi.fn()} />)
    for (const status of ['completed', 'pending']) {
      const title = await screen.findByText(`Test ${status} module`)
      const article = title.closest('article')!
      const checkbox = within(article).getByRole('checkbox', { name: status })
      expect(checkbox).toBeDisabled()
      expect(checkbox).toHaveProperty('checked', status === 'completed')
      const indicator = checkbox.nextElementSibling!
      expect(indicator.tagName).toBe('SPAN')
      expect(indicator).toHaveAttribute('aria-hidden', 'true')
      expect(indicator.textContent).toBe(status === 'completed' ? '✓' : '')
    }
    expect(writes).toEqual([])
  })
})
