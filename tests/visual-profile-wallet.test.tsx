import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
const repairCss = readFileSync('src/visual-profile-wallet.css', 'utf8')
import { ApiClient, type ApiSession } from '../src/api'
import { Profile } from '../src/Profile'
import { Wallet } from '../src/Wallet'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, active }: { children: ReactNode; active: string }) => (
    <main data-active={active}>{children}</main>
  ),
}))
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const user = {
  id: actor, name: 'Real Therapist', email: 'therapist@example.test',
  whatsapp_number: '+123456789', role: 'therapist', is_active: true,
  phone_verified_at: '2026-01-01T00:00:00Z', timezone: 'UTC',
}
const therapist = {
  id: actor, full_name: 'Real Therapist', specialty: 'Counselling', country: 'Jordan',
  languages: ['ar', 'en'], bio: 'Actual biography', rating: 4,
  approval_status: 'approved', has_license: true,
  availability: { monday: ['09:00-12:00', '13:00-17:00'] },
}
const wallet = {
  currency: 'EUR', commission_rate: 0.2, earned: 150, pending_earnings: 45,
  withdrawn: 50, reserved: 0, available: 100, min_withdrawal: 20,
  completed_paid_sessions: 7, earned_package_sessions: 3, recent_withdrawals: [],
}
function json(value: unknown) {
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
}
async function harness(overrides: Record<string, unknown> = {}) {
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace('https://visual.example.test/api/v1', '')
    if (Object.hasOwn(overrides, path)) return json(overrides[path])
    if (path === '/auth/user') return json({ user })
    if (path === '/therapists/me/dashboard') return json({
      therapist, clients_count: 7,
      stats: { pending: 2, confirmed: 3, completed: 12, today: 1 }, timezone: 'UTC',
    })
    if (path === '/therapists/me/blocked-periods') return json({ data: [{
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      start_date: '2030-06-10', end_date: '2030-06-15', reason: 'Annual leave',
    }] })
    if (path === '/faqs?page=1') return json({
      data: [{ id: 'faq-1', question: '<b>Question</b>', answer: '<script>Answer</script>' }],
      pagination: { current_page: 1, last_page: 1 },
    })
    if (path === '/therapists/wallet') return json(wallet)
    throw new Error(`Unexpected request: ${path}`)
  })
  const api = new ApiClient('https://visual.example.test/api/v1', transport)
  const session: ApiSession = {
    user, access_token: 'test-memory-access', refresh_token: 'r'.repeat(64), token_type: 'Bearer',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
  await api.establish(session)
  return { api, transport }
}
beforeEach(() => {
  window.history.replaceState({}, '', '/profile')
})

describe('profile/wallet designed component regression contracts', () => {
  it('retains direct live overview section/request actions and uses a natural-height summary', async () => {
    const { api, transport } = await harness()
    const { container } = render(<Wallet api={api} navigate={vi.fn()} />)
    await screen.findByText('Lifetime net earnings')
    expect(container.querySelector('.wallet-live.wallet-overview')).not.toBeNull()
    expect(container.querySelector('.wallet-chart')).toBeNull()
    expect(container.querySelector('.wallet-summary')).toHaveTextContent('not provided by the wallet API')
    const nav = within(screen.getByRole('navigation', { name: 'Wallet sections' }))
    fireEvent.click(nav.getByRole('button', { name: 'Earnings' }))
    expect(screen.getByRole('heading', { name: 'Net earnings summary' })).toBeInTheDocument()
    fireEvent.click(nav.getByRole('button', { name: 'Overview' }))
    fireEvent.click(nav.getByRole('button', { name: 'Request withdrawal' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('manual finance review')
    expect(transport.mock.calls.every(([input]) => !String(input).endsWith('/withdraw'))).toBe(true)
    // Static CSS contracts only: jsdom does not verify phone rendering or overflow.
    expect(repairCss).toMatch(/@media \(max-width: 600px\)/)
    expect(repairCss).toMatch(/\.wallet-live\.wallet-overview \.wallet-tabs\s*\{\s*display: flex/)
    expect(repairCss).toMatch(/\.wallet-live \.wallet-tabs \.wallet-withdraw-button\s*\{\s*display: block/)
    expect(repairCss).toMatch(/\.wallet-live\.wallet-overview \.wallet-advisory\s*\{\s*position: static/)
  })

  it('gives rejected, approved, pending and paid requests distinct status classes without implying payment', async () => {
    const statuses = ['pending', 'approved', 'rejected', 'paid']
    const recent = statuses.map((status, index) => ({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`, therapist_id: actor,
      amount: 25, status, payout_details: { method: 'wise', account: 'destination-1234' },
      note: status === 'rejected' ? 'Not approved' : null, reviewed_at: null, created_at: null,
    }))
    const { api } = await harness({ '/therapists/wallet': { ...wallet, recent_withdrawals: recent } })
    render(<Wallet api={api} navigate={vi.fn()} />)
    await screen.findByText('Lifetime net earnings')
    fireEvent.click(screen.getByRole('button', { name: 'Withdrawals' }))
    await waitFor(() => expect(screen.getByText('Rejected')).toHaveClass('withdrawal-rejected'))
    expect(screen.getByText('Approved')).toHaveClass('withdrawal-approved')
    expect(screen.getByText('Pending')).toHaveClass('withdrawal-pending')
    expect(screen.getByText('Paid')).toHaveClass('completed')
    expect(screen.getByText(/Review note: Not approved/)).toBeInTheDocument()
    expect(screen.queryByText('destination-1234')).not.toBeInTheDocument()
  })

  it('renders reference-shaped but non-submittable live contact fields', async () => {
    window.history.replaceState({}, '', '/profile/help?state=contact')
    const { api, transport } = await harness()
    render(<Profile page="help" api={api} navigate={vi.fn()} />)
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText('Subject')).toBeDisabled()
    expect(dialog.getByLabelText('Message')).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Send Message (unavailable)' })).toBeDisabled()
    expect(dialog.getByText(/no ticket, email or call has been sent/)).toBeInTheDocument()
    expect(transport.mock.calls.every(([input]) => !String(input).includes('support'))).toBe(true)
  })

  it('keeps live notification controls disabled and documents measured switch geometry', async () => {
    window.history.replaceState({}, '', '/profile/settings?state=preferences')
    const { api } = await harness()
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    const switches = within(screen.getByRole('dialog')).getAllByRole('switch')
    expect(switches).toHaveLength(5)
    switches.forEach((input) => {
      expect(input).toBeDisabled()
      expect(input).not.toBeChecked()
    })
    expect(screen.getByRole('button', { name: /Save Preferences/ })).toBeDisabled()
    expect(repairCss).toMatch(/\.preferences-list input\[role='switch'\]\s*\{\s*width: 44px;\s*height: 24px/)
    expect(repairCss).toMatch(/\.preferences-list input\[role='switch'\]:before\s*\{\s*width: 20px;\s*height: 20px/)
  })

  it('preserves demo-only holiday state while showing the reference clock tile', () => {
    window.history.replaceState({}, '', '/profile/settings?state=holidays')
    const { container } = render(<Profile page="settings" navigate={vi.fn()} />)
    const holiday = container.querySelector('.holiday-list article')
    expect(holiday?.querySelector('.holiday-clock')).not.toBeNull()
    expect(holiday).toHaveTextContent('Annual Leave')
    expect(screen.getByRole('button', { name: 'Remove Annual Leave' })).toHaveClass('holiday-remove')
    expect(screen.getByRole('button', { name: 'Add Holiday' })).toBeEnabled()
    expect(screen.getByText(/Changes are local to this demo/)).toBeInTheDocument()
  })

  it('uses honest initials and icon slots for real profile fields, with Profile active', async () => {
    const { api } = await harness()
    const { container } = render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await screen.findByText('Actual biography')
    expect(screen.getByRole('main')).toHaveAttribute('data-active', 'Profile')
    const avatar = screen.getByLabelText('Profile initials')
    expect(avatar).toHaveClass('profile-avatar-initials')
    expect(avatar).toHaveTextContent('RT')
    expect(avatar.querySelector('img')).toBeNull()
    const rows = container.querySelectorAll('.profile-info-row')
    expect(rows).toHaveLength(9)
    rows.forEach((row) => expect(row.querySelector(':scope > .remaining-icon')).not.toBeNull())
    expect(screen.getByText('On file (not independent verification)')).toBeInTheDocument()
    expect(container.querySelector('.profile-verified')).toBeNull()
  })

  it('restores the help card wrapper without enabling callbacks', async () => {
    const { api } = await harness()
    const { container } = render(<Profile page="help" api={api} navigate={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Real Therapist' })
    expect(container.querySelector('.help-live > div > h3')).toHaveTextContent('Support availability')
    expect(screen.getByRole('button', { name: /Request a callback/ })).toBeDisabled()
  })

  it('styles every supported availability window without dropping multiple windows', async () => {
    const { api } = await harness()
    const { container } = render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Real Therapist' })
    fireEvent.click(screen.getByRole('button', { name: /Manage Working Hours/ }))
    await screen.findByLabelText('monday start 1')
    expect(container.querySelectorAll('.live-hours-day')).toHaveLength(7)
    expect(container.querySelectorAll('.live-hours-window')).toHaveLength(2)
    expect(screen.getByLabelText('monday start 2')).toHaveValue('13:00')
    expect(screen.getByLabelText('monday end 2')).toHaveValue('17:00')
    fireEvent.click(screen.getByRole('button', { name: 'Add monday window' }))
    expect(screen.getByLabelText('monday start 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove monday window 3' }))
    expect(screen.queryByLabelText('monday start 3')).not.toBeInTheDocument()
    expect(screen.getByText(/entire weekly schedule/)).toBeInTheDocument()
  })

  it('uses the styled holiday row and an accessible removal control for server periods', async () => {
    const { api } = await harness()
    const { container } = render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Real Therapist' })
    fireEvent.click(screen.getByRole('button', { name: /Vacations and Breaks/ }))
    await screen.findByText('Annual leave')
    const card = container.querySelector('.holiday-list article')
    expect(card?.querySelector('.holiday-clock')).not.toBeNull()
    expect(card).toHaveTextContent('2030-06-10 – 2030-06-15')
    expect(screen.getByRole('button', { name: 'Remove blocked period 2030-06-10' })).toHaveClass('holiday-remove')
    expect(container.querySelector('.holidays-list')).toBeNull()
  })

  it('adds disclosure icons while preserving escaped live FAQs and pagination boundaries', async () => {
    window.history.replaceState({}, '', '/profile/help?state=faq')
    const { api } = await harness()
    const { container } = render(<Profile page="help" api={api} navigate={vi.fn()} />)
    const question = await screen.findByText('<b>Question</b>')
    const summary = question.closest('summary')!
    expect(summary.querySelector('.faq-open-arrow img')).not.toBeNull()
    expect(summary.querySelector('.faq-closed-arrow img')).not.toBeNull()
    expect(summary.closest('details')).toHaveAttribute('open')
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByRole('button', { name: 'Previous FAQs' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next FAQs' })).toBeDisabled()
  })
})
