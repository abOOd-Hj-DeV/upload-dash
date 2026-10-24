import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiClient, type ApiSession } from '../src/api'
import { Chats } from '../src/Chats'
import { LiveNotifications } from '../src/api-chat-and-notifications-live-notifications'
import { readFileSync } from 'node:fs'

const chatStyles = readFileSync('src/visual-chats.css', 'utf8')

// Unit-level DOM contracts only: no browser, screenshot or pixel-parity assertion.
vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, active }: { children: ReactNode; active: string }) => (
    <main data-active={active}>{children}</main>
  ),
  DesignIcon: ({ name }: { name: string }) => <img alt="" data-design-icon={name} />,
}))

const actor = '11111111-1111-4111-8111-111111111111'
const clientA = '22222222-2222-4222-8222-222222222222'
const clientB = '33333333-3333-4333-8333-333333333333'
const notification = '88888888-8888-4888-8888-888888888888'
const pagination = { current_page: 1, last_page: 1, total: 1 }
const session: ApiSession = {
  user: { id: actor, name: 'Therapist', email: null, whatsapp_number: '', role: 'therapist',
    is_active: true, phone_verified_at: '2026-10-01T00:00:00Z', timezone: 'UTC' },
  access_token: 'test-memory-access', refresh_token: 'r'.repeat(64), token_type: 'Bearer',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
}
function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}
async function makeApi(read = false) {
  const transport = vi.fn<typeof fetch>((input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/notifications')) return Promise.resolve(json({
      data: [{ id: notification, data: { kind: 'chat_message_received', sender_id: clientB,
        title: 'Do not expose stored title', preview: 'Private preview', url: 'https://evil.test' },
        read_at: read ? '2026-10-01T00:00:00Z' : null, created_at: '2026-10-01T00:00:00Z' }], unread_count: read ? 0 : 1, pagination,
    }))
    if (url.pathname.endsWith('/chat')) return Promise.resolve(json({ data: [], pagination }))
    const id = url.pathname.split('/').at(-1)
    if ([clientA, clientB].includes(id || '')) return Promise.resolve(json({
      conversation: { id: '44444444-4444-4444-8444-444444444444', counterpart_id: id,
        patient: { id, name: id === clientA ? 'Client A' : 'Client B' },
        therapist: { id: actor, name: 'Therapist' }, status: 'active', unread_count: 0, last_message_at: null },
      data: [], pagination,
    }))
    return Promise.resolve(json({ updated: 0 }))
  })
  const api = new ApiClient('https://care.example/api/v1', transport)
  await api.establish(session)
  return { api, transport }
}
beforeEach(() => {
  window.history.replaceState({}, '', '/chats')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('chat visual repair contracts', () => {
  it('marks only the original three full-width phone bubbles and responds to composer resizing', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 370 })
    window.history.replaceState({}, '', '/chats?state=thread')
    const { container } = render(<Chats navigate={vi.fn()} />)
    expect(container.querySelectorAll('.reference-phone-wide')).toHaveLength(3)
    expect(screen.getByText('Can I start the new unit?').closest('.message-group')).not.toHaveClass('reference-phone-wide')
    expect(screen.getByText('Yeah for sure').closest('.message-group')).not.toHaveClass('reference-phone-wide')
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('placeholder', 'Type your message')
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('placeholder', 'Type your message to the client...')
  })

  it('keeps confirmed context tokens scoped rather than changing shared shell CSS', () => {
    expect(chatStyles).toContain('.chat-layout .conversation strong')
    expect(chatStyles).toContain('700 13.5px / normal')
    expect(chatStyles).toContain('700 14.5px / normal')
    expect(chatStyles).toContain('background: #fdf3da')
    expect(chatStyles).toContain('color: #8a6413')
    expect(chatStyles).toContain('width: 242.7px')
    expect(chatStyles).toContain('.chat-workspace .mobile-bottom-nav')
    expect(chatStyles).toContain('border-radius: 18px 18px 0 0')
    expect(chatStyles).toContain('margin-bottom: 10px')
  })

  it('allows a wrapping composer without submitting Shift+Enter or IME composition', () => {
    const { container } = render(<Chats navigate={vi.fn()} />)
    const composer = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement
    expect(composer.tagName).toBe('TEXTAREA')
    const submit = vi.spyOn(composer.form!, 'requestSubmit').mockImplementation(() => {})
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(composer, { key: 'Enter', isComposing: true })
    expect(submit).not.toHaveBeenCalled()
    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(submit).toHaveBeenCalledOnce()
    expect(container.querySelector('.message-history')?.lastElementChild).toHaveClass('reply-reminder')
  })

  it.each([false, true])('gives safe notifications a title/time hierarchy, grouped actions and read treatment (read=%s)', async (read) => {
    const { api } = await makeApi(read)
    const { container } = render(<LiveNotifications api={api} navigate={vi.fn()} />)
    const title = await screen.findByText('New care message')
    const row = title.closest('article')!
    expect(row).toHaveClass(read ? 'is-read' : 'is-unread')
    expect(title.closest('.notification-title')?.querySelector('time')).not.toBeNull()
    expect(row.querySelector('.notification-kind-icon img')).not.toBeNull()
    expect(row.querySelector('.notification-unread-dot') !== null).toBe(!read)
    expect(within(row).getByRole('button', { name: read ? 'Read' : 'Mark read' }).closest('.notification-actions')).not.toBeNull()
    expect(container.querySelector('a[href="https://evil.test"]')).toBeNull()
    expect(screen.queryByText('Private preview')).not.toBeInTheDocument()
    expect(screen.queryByText('Do not expose stored title')).not.toBeInTheDocument()
  })

  it('does not highlight Sara when the reference has no selected conversation', () => {
    window.history.replaceState({}, '', '/chats?state=empty')
    render(<Chats navigate={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Select a conversation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sara Khaled/ })).not.toHaveClass('selected')
    expect(document.querySelectorAll('.chat-list .conversation.selected')).toHaveLength(0)
  })

  it('retains the Sara row highlight in the separate phone-list reference', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 370 })
    render(<Chats navigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Sara Khaled/ })).toHaveClass('selected')
    expect(document.querySelectorAll('.chat-list .conversation.selected')).toHaveLength(1)
  })

  it('keeps Messages active and adds the reference empty illustration without fixture clients', async () => {
    const { api } = await makeApi()
    const { container } = render(<Chats api={api} navigate={vi.fn()} />)
    const empty = screen.getByRole('region', { name: 'Select a conversation' })
    expect(empty.querySelector('[data-design-icon="part2-20-imgMessageCircleLinesAlt1.svg"]')).not.toBeNull()
    expect(within(empty).getByRole('heading', { name: 'Select a conversation' })).toBeInTheDocument()
    expect(screen.getByText('Search only this loaded conversation page.')).toBeInTheDocument()
    expect(screen.queryByText('Sara Khaled')).not.toBeInTheDocument()
    expect(container.querySelector('main')).toHaveAttribute('data-active', 'Messages')
  })

  it('opens another sender from notifications on the same pathname and clears the previous draft', async () => {
    window.history.replaceState({}, '', `/chats?client=${clientA}`)
    const { api, transport } = await makeApi()
    const navigate = vi.fn((path: string) => window.history.pushState({}, '', path))
    render(<><Chats api={api} navigate={navigate} /><LiveNotifications api={api} navigate={navigate} /></>)
    await screen.findByRole('region', { name: 'Conversation with Client A' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Draft for A' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Open conversation' }))
    await screen.findByRole('region', { name: 'Conversation with Client B' })
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
    expect(navigate).toHaveBeenCalledWith(`/chats?client=${clientB}`)
    expect(transport.mock.calls.some(([url]) => String(url).includes(`/chat/${clientB}?`))).toBe(true)
    expect(screen.queryByText('Private preview')).not.toBeInTheDocument()
    expect(screen.queryByText('Do not expose stored title')).not.toBeInTheDocument()
  })

  it('validates history destinations and returns to the empty state without requesting invalid IDs', async () => {
    window.history.replaceState({}, '', `/chats?client=${clientA}`)
    const { api, transport } = await makeApi()
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('region', { name: 'Conversation with Client A' })
    act(() => {
      window.history.pushState({}, '', '/chats?client=not-a-uuid')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('region', { name: 'Select a conversation' })).toBeInTheDocument()
    expect(transport.mock.calls.some(([url]) => String(url).includes('not-a-uuid'))).toBe(false)
  })
})
