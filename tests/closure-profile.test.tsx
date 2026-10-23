import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ApiClient, type ApiSession } from '../src/api'
import { Profile } from '../src/Profile'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const css = readFileSync('src/visual-profile-closure.css', 'utf8')
const baseCss = readFileSync('src/remaining.css', 'utf8')
const profileSource = readFileSync('src/Profile.tsx', 'utf8')
const user = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Test Therapist',
  email: 'therapist@example.test', whatsapp_number: '+123456789', role: 'therapist',
  is_active: true, phone_verified_at: '2026-01-01T00:00:00Z', timezone: 'UTC',
}
async function liveClient() {
  const transport = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace('https://closure.example.test/api/v1', '')
    const response = path === '/auth/user' ? { user }
      : path === '/therapists/me/dashboard' ? { therapist: null, clients_count: 0, stats: { completed: 0 } }
        : path === '/faqs?page=1' ? {
          data: [{ id: 'faq-test', question: 'Test FAQ question', answer: '<b>Plain text answer</b>' }],
          pagination: { current_page: 1, last_page: 1 },
        } : undefined
    if (!response) throw new Error(`Unexpected request: ${path}`)
    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } })
  })
  const api = new ApiClient('https://closure.example.test/api/v1', transport)
  await api.establish({
    user, access_token: 'test-memory-access', refresh_token: 'x'.repeat(64), token_type: 'Bearer',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  } as ApiSession)
  return { api, transport }
}

beforeEach(() => window.history.replaceState({}, '', '/profile'))

describe('bounded profile closure width contracts (not visual acceptance)', () => {
  it.each(['demo', 'live'])('keeps %s logout truthful and cancellable with a natural-height 330px class', async (mode) => {
    window.history.replaceState({}, '', '/profile/settings?state=logout')
    const client = mode === 'live' ? await liveClient() : undefined
    const navigate = vi.fn()
    render(<Profile page="settings" api={client?.api} navigate={navigate} />)
    const dialog = screen.getByRole('dialog', { name: 'Log out' })
    expect(dialog).toHaveClass('remaining-modal', 'logout-modal')
    expect(css).toMatch(/\.remaining-modal\.logout-modal\s*\{\s*width: 330px;/)
    const logoutRule = css.match(/\.remaining-modal\.logout-modal\s*\{([^}]+)\}/)?.[1]
    expect(logoutRule).not.toMatch(/(?:^|[;{\s])(?:max-|min-)?height\s*:/)
    expect(dialog).toHaveTextContent(mode === 'live' ? 'remote revocation is unknown' : 'Demo only: no authenticated server session exists')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    if (client) expect(client.transport.mock.calls.every(([input]) => !String(input).includes('/logout'))).toBe(true)
  })

  it.each(['demo', 'live'])('keeps %s password fields empty and secret while using the 447px class', async (mode) => {
    window.history.replaceState({}, '', '/profile/settings?state=password')
    const api = mode === 'live' ? (await liveClient()).api : undefined
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Change Password' })
    expect(dialog).toHaveClass('remaining-modal', 'password-modal')
    expect(css).toMatch(/\.remaining-modal\.password-modal\s*\{\s*width: 447px;/)
    for (const label of ['Current Password', 'New Password', 'Confirm New Password']) {
      expect(within(dialog).getByLabelText(label)).toHaveAttribute('type', 'password')
      expect(within(dialog).getByLabelText(label)).toHaveValue('')
    }
    if (mode === 'live') expect(dialog).toHaveTextContent('signs out other devices, not this session')
  })

  it('restores summary display hierarchy and responsive spacing without replacing real profile content', () => {
    render(<Profile page="profile" navigate={vi.fn()} />)
    const summary = screen.getByRole('complementary', { name: 'Profile overview' })
    expect(summary).toHaveTextContent('Ahmed Mohamed')
    expect(summary.querySelectorAll('.profile-counts strong')).toHaveLength(2)
    expect(summary).toHaveTextContent('89Clients45Sessions')
    expect(screen.getByText(/I specialize in anxiety and depression/)).toBeInTheDocument()
    expect(css).toMatch(/\.profile-summary \.profile-counts strong\s*\{\s*font: 500 34px\/36px Georgia, serif;/)
    expect(css).toMatch(/@media \(min-width: 601px\) and \(max-width: 1100px\)[\s\S]*?width: auto;\s*justify-self: stretch;/)
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*?align-items: flex-start;/)
    expect(css).toMatch(/\.profile-information \.profile-information-grid\s*\{\s*row-gap: 0;/)
    expect(css).toMatch(/\.profile-information-grid \.profile-info-rows \.profile-info-row\s*\{\s*min-height: 50px;/)
    expect(css).toContain('not font parity')
  })

  it('keeps the complete editable biography and saves real text locally with phone footer halves', () => {
    window.history.replaceState({}, '', '/profile/settings?state=edit')
    render(<Profile page="settings" navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Edit Profile' })
    const biography = within(dialog).getByRole('textbox', { name: 'General View' })
    expect((biography as HTMLTextAreaElement).value).toContain('Eight years of experience in individual and group therapy.')
    expect(css).toMatch(/\.remaining-modal\.edit-modal textarea\s*\{\s*height: 112px;\s*min-height: 112px;/)
    expect(css).toMatch(/\.remaining-modal:is\(\.edit-modal, \.preferences-modal, \.holidays-modal, \.hours-modal\) \.remaining-form-actions > button\s*\{\s*flex: 1;/)
    fireEvent.change(biography, { target: { value: 'Updated biography in this local demo.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('locally for this demo. No backend is connected.')
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Profile overview' })).getByRole('button', { name: 'Edit Profile' }))
    expect(screen.getByRole('textbox', { name: 'General View' })).toHaveValue('Updated biography in this local demo.')
  })

  it('fills the logout footer without removing the truthful session notice or changing navigation', () => {
    window.history.replaceState({}, '', '/profile/settings?state=logout')
    const navigate = vi.fn()
    render(<Profile page="settings" navigate={navigate} />)
    const dialog = screen.getByRole('dialog', { name: 'Log out' })
    expect(css).toMatch(/\.remaining-modal\.logout-modal \.remaining-form-actions > \.remaining-danger\s*\{\s*flex: 1;/)
    expect(dialog).toHaveTextContent('Demo only: no authenticated server session exists.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Log out' }))
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('uses the source payment label without dropping a notification switch or changing local save/cancel behavior', () => {
    window.history.replaceState({}, '', '/profile/settings?state=preferences')
    render(<Profile page="settings" navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Notification Settings' })
    expect(within(dialog).getAllByRole('switch')).toHaveLength(5)
    const payment = within(dialog).getByRole('switch', { name: 'Payment & withdrawal notifications' })
    expect(payment).toBeChecked()
    fireEvent.click(payment)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Preferences' }))
    expect(screen.getByRole('status')).toHaveTextContent('Notification preferences saved locally for this demo')
    fireEvent.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(screen.getByRole('switch', { name: 'Payment & withdrawal notifications' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('switch', { name: 'Payment & withdrawal notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(screen.getByRole('switch', { name: 'Payment & withdrawal notifications' })).not.toBeChecked()
  })

  it('stacks demo weekday labels over paired native time inputs without changing validation or saved days', () => {
    window.history.replaceState({}, '', '/profile/settings?state=hours')
    render(<Profile page="settings" navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Work Hours Management' })
    expect(dialog.querySelector('.demo-hours-list')).not.toBeNull()
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(7)
    const start = within(dialog).getByLabelText('Saturday start time')
    const end = within(dialog).getByLabelText('Saturday end time')
    expect(start).toHaveAttribute('type', 'time')
    expect(end).toHaveAttribute('type', 'time')
    expect(start.parentElement).toContainElement(within(dialog).getByRole('checkbox', { name: 'Saturday' }))
    expect(css).toMatch(/\.hours-modal \.demo-hours-list label\s*\{\s*grid-column: 1 \/ -1;/)
    expect(css).toContain('grid-template-columns: minmax(0, 0.67fr) auto minmax(0, 1fr)')
    fireEvent.change(start, { target: { value: '17:00' } })
    fireEvent.change(end, { target: { value: '09:00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Preferences' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter an end time after the start time for Saturday.')
    fireEvent.change(start, { target: { value: '08:00' } })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Sunday' }))
    expect(within(dialog).queryByLabelText('Sunday start time')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Preferences' }))
    expect(screen.getByRole('status')).toHaveTextContent('Working hours saved locally for this demo')
    fireEvent.click(screen.getByRole('button', { name: /Manage Working Hours/ }))
    expect(screen.getByLabelText('Saturday start time')).toHaveValue('08:00')
    expect(screen.getByLabelText('Saturday end time')).toHaveValue('09:00')
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).not.toBeChecked()
  })

  it('keeps native holiday dates and the local-only explanation alongside the phone footer contract', () => {
    window.history.replaceState({}, '', '/profile/settings?state=holidays')
    render(<Profile page="settings" navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Work Hours Management' })
    expect(within(dialog).getByLabelText('From')).toHaveAttribute('type', 'date')
    expect(within(dialog).getByLabelText('To')).toHaveAttribute('type', 'date')
    expect(dialog).toHaveTextContent('Changes are local to this demo; no calendar service is connected.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('imports the owned CSS and limits the compact FAQ width to non-phone viewports', () => {
    expect(profileSource).toContain("import './visual-profile-closure.css'")
    // jsdom cannot measure media-query layout. These are static cascade contracts only.
    expect(css).toMatch(/@media \(min-width: 601px\)\s*\{\s*\.remaining-modal\.faq-modal\s*\{\s*width: 371px;/)
    expect(baseCss).toMatch(/\.remaining-modal\s*\{\s*width: 340px;\s*max-width: calc\(100vw - 32px\);/)
    expect(baseCss).toContain('max-height: calc(100svh - 32px)')
    expect(baseCss).toContain('overflow-y: auto')
  })

  it('uses the FAQ width class with an initially open answer and accessible dismissal in demo', () => {
    window.history.replaceState({}, '', '/profile/help?state=faq')
    render(<Profile page="help" navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Frequently Asked Questions' })
    expect(dialog).toHaveClass('remaining-modal', 'faq-modal')
    expect(within(dialog).getByText('How do I add a new client?').closest('details')).toHaveAttribute('open')
    const earningsSummary = within(dialog).getByText('How are my earnings calculated?')
    fireEvent.click(earningsSummary)
    // Native details remain expandable; compact rows must not clip truthful answers.
    expect(earningsSummary.closest('details')).toHaveAttribute('open')
    expect(earningsSummary.closest('details')).toHaveTextContent('No live earnings service is connected')
    expect(css).toMatch(/\.remaining-modal\.faq-modal \.faq-list summary\s*\{\s*font: 500 14px\/20px Arimo, Arial, sans-serif;/)
    expect(css).toMatch(/\.remaining-modal\.faq-modal \.faq-list p\s*\{[\s\S]*?font: 400 14px\/22.75px Arimo, Arial, sans-serif;/)
    expect(css).not.toMatch(/\.remaining-modal\.faq-modal\s*\{[^}]*height:/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('applies the same FAQ class to live API answers without interpreting HTML', async () => {
    window.history.replaceState({}, '', '/profile/help?state=faq')
    const { api, transport } = await liveClient()
    render(<Profile page="help" api={api} navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Frequently Asked Questions' })
    expect(dialog).toHaveClass('remaining-modal', 'faq-modal')
    expect(await within(dialog).findByText('<b>Plain text answer</b>')).toBeInTheDocument()
    expect(dialog.querySelector('b')).toBeNull()
    expect(transport.mock.calls.some(([input]) => String(input).endsWith('/faqs?page=1'))).toBe(true)
  })
})
