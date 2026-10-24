import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, type ApiSession } from '../src/api'
import { Clients } from '../src/Clients'
import { Dashboard } from '../src/Dashboard'
import { readFileSync } from 'node:fs'

const clientId = '22222222-2222-4222-8222-222222222222'
const session: ApiSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111', name: 'Actual therapist', email: null,
    whatsapp_number: '', role: 'therapist', is_active: true,
    phone_verified_at: '2025-01-01T00:00:00Z', timezone: 'Asia/Riyadh',
  },
  access_token: 'test-access', refresh_token: 'r'.repeat(64), token_type: 'Bearer',
  expires_at: '2099-01-01T00:00:00Z', refresh_expires_at: '2099-02-01T00:00:00Z',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
async function clientsHarness(failFirst = false) {
  const paths: string[] = []
  const api = new ApiClient('https://api.example.test/api/v1', vi.fn(async (input) => {
    const url = new URL(String(input))
    paths.push(url.pathname + url.search)
    if (failFirst) { failFirst = false; return json({ message: 'private server detail' }, 500) }
    const page = Number(url.searchParams.get('page')) || 1
    return json({
      data: url.searchParams.get('search') ? [] : [
        { id: clientId, full_name: 'Current client', status: 'active', completed_sessions_count: 7, next_session_date: null },
        { id: '33333333-3333-4333-8333-333333333333', full_name: 'Past client', status: 'past', completed_sessions_count: 3, next_session_date: null },
      ],
      pagination: { current_page: page, last_page: 2, total: 2 },
    })
  }) as typeof fetch)
  await api.establish(session)
  return { api, paths }
}
beforeEach(() => {
  window.history.replaceState({}, '', '/dashboard')
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false })
})

describe('confirmed dashboard search reference', () => {
  it('preserves the evidenced tablet card width without uncapping narrower layouts', () => {
    const css = readFileSync('src/visual-dashboard-clients.css', 'utf8')
    expect(css).toMatch(/@media \(min-width: 740px\) and \(max-width: 1100px\)\s*\{\s*\.visual-demo-dashboard \.next-session\s*\{\s*max-width: none;/)
    expect(css).toMatch(/\.visual-demo-dashboard \.sessions-card th\s*\{\s*width: 33\.333%;/)
  })
  it('preserves cached metric glyph sizes and the glass backdrop in demo only', () => {
    const css = readFileSync('src/visual-dashboard-clients.css', 'utf8')
    expect(css).toMatch(/\.visual-demo-dashboard \.featured-icon\.has-glass > span\s*\{\s*backdrop-filter: blur\(8px\);/)
    expect(css).toMatch(/img\[src\$='dashboard-imgIcon3.svg'\]\s*\{\s*width: 20px;\s*height: 20px;/)
    expect(css).toMatch(/img\[src\$='dashboard-imgIcon4.svg'\]\s*\{\s*width: 17\.5px;\s*height: 19\.5px;/)
  })
  it('uses the cached home silhouette with the active reference color', () => {
    render(<Dashboard navigate={vi.fn()} />)
    const active = screen.getByRole('complementary', { name: 'Main navigation' }).querySelector('[aria-current="page"]')!
    expect(active.querySelector('.dashboard-active-icon')).toHaveAttribute('aria-hidden', 'true')
    const css = readFileSync('src/visual-dashboard-clients.css', 'utf8')
    expect(css).toMatch(/\.visual-demo-dashboard \.dashboard-active-icon\s*\{\s*background: #1d919e;/)
    expect(css).toMatch(/@media \(min-width: 1101px\)\s*\{\s*\.visual-demo-dashboard \.dashboard-active-icon\s*\{ background: #0a0a0a;/)
  })
  it('uses exactly the two reference rows in the explicit preview but still searches all demo patients', () => {
    window.history.replaceState({}, '', '/dashboard?state=search')
    render(<Dashboard navigate={vi.fn()} />)
    const results = screen.getByLabelText('Search results')
    expect(within(results).getAllByRole('button').map((row) => row.textContent)).toEqual(['Fatima', 'Fadi'])
    expect(within(results).getByRole('button', { name: 'Fadi' })).toHaveClass('design-preview-hover')
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'Fahad' } })
    expect(within(results).getByRole('button', { name: 'Fahad Al Ali' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'missing patient' } })
    expect(screen.getByText('No patients found')).toBeInTheDocument()
  })
})

describe('confirmed dashboard modal, notifications and offline reference', () => {
  it('uses the reference notification subjects, unread cues and per-event styling without changing demo actions', () => {
    window.history.replaceState({}, '', '/dashboard?state=notifications')
    render(<Dashboard navigate={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'Notifications' })
    const rows = within(panel).getAllByRole('article')
    expect(rows).toHaveLength(6)
    expect(rows[1]).toHaveClass('demo-notification-2')
    expect(rows[1]).toHaveTextContent('Cognitive Behavioral Therapy.')
    expect(rows[2]).toHaveTextContent('Anxiety Management Session #3')
    expect(rows[3]).toHaveTextContent('Weekly Therapy Review.')
    expect(rows[4]).toHaveTextContent('Session Summaries.')
    expect(rows[5]).toHaveTextContent('Review client progress reports.')
    expect(within(rows[0]).getByLabelText('Unread')).toBeInTheDocument()
    expect(within(rows[1]).getByLabelText('Unread')).toBeInTheDocument()
    expect(within(rows[2]).queryByLabelText('Unread')).not.toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Accept' }))
    expect(within(panel).getAllByRole('article')).toHaveLength(5)
    expect(within(panel).getByRole('status')).toHaveTextContent('Demo invitation accepted')
  })
  it('renders a nonfunctional design meeting URL and exact copy/close shapes', () => {
    window.history.replaceState({}, '', '/dashboard?state=meeting')
    render(<Dashboard navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('dashboard-meeting-modal')
    expect(within(dialog).getByLabelText('Meeting URL')).toHaveValue('https://meet.google.com/kxx-eyzx-dew?author=0')
    expect(within(dialog).getByRole('button', { name: 'Copy meeting URL' }).querySelector('svg')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Join meeting' }))
    expect(within(dialog).getByRole('status')).toHaveTextContent('Demo only: no live meeting service')
  })
  it('uses reference warning icon without enabling an offline meeting', () => {
    window.history.replaceState({}, '', '/dashboard?state=offline')
    render(<Dashboard navigate={vi.fn()} />)
    expect(screen.getByRole('status').querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
  })
})

describe('clients functional presentation', () => {
  it('keeps active/past actions truthful and routes actual clinical/chat identifiers', async () => {
    const { api } = await clientsHarness()
    const navigate = vi.fn()
    render(<Clients api={api} navigate={navigate} />)
    const current = (await screen.findByText('Current client')).closest('article')!
    const past = screen.getByText('Past client').closest('article')!
    expect(within(current).getByText('7')).toBeInTheDocument()
    expect(within(current).getByText('None scheduled')).toBeInTheDocument()
    expect(within(past).queryByRole('button', { name: 'Message' })).not.toBeInTheDocument()
    fireEvent.click(within(current).getByRole('button', { name: 'Current client' }))
    expect(navigate).toHaveBeenLastCalledWith(`/clients/profile?id=${clientId}`)
    fireEvent.click(within(current).getByRole('button', { name: 'Clinical record' }))
    expect(navigate).toHaveBeenLastCalledWith(`/sessions/upcoming?client=${clientId}`)
    fireEvent.click(within(current).getByRole('button', { name: 'Message' }))
    expect(navigate).toHaveBeenLastCalledWith(`/chats?client=${clientId}`)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled())
  })
  it('makes the header search functional, encoded, bounded and resets pagination', async () => {
    const { api, paths } = await clientsHarness()
    render(<Clients api={api} navigate={vi.fn()} />)
    await screen.findByText('Current client')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(paths.at(-1)).toContain('page=2'))
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: '  A&B  ' } })
    expect(await screen.findByText('No clients found.')).toBeInTheDocument()
    expect(paths.at(-1)).toBe('/api/v1/therapists/clients?search=A%26B&page=1')
    expect(screen.getByLabelText('Search clients')).toHaveValue('  A&B  ')
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'x'.repeat(120) } })
    await waitFor(() => expect(paths.at(-1)).toContain(`search=${'x'.repeat(100)}&page=1`))
    expect(screen.getByLabelText('Search clients')).toHaveValue('x'.repeat(100))
  })
  it('keeps generic request failure and retry available', async () => {
    const { api } = await clientsHarness(true)
    render(<Clients api={api} navigate={vi.fn()} />)
    const alert = await screen.findByRole('alert')
    expect(alert).not.toHaveTextContent('private server detail')
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Current client')).toBeInTheDocument()
  })
})
