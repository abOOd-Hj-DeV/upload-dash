import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiClient, type ApiSession } from '../src/api'
import { Chats } from '../src/Chats'
import { LiveNotifications } from '../src/api-chat-and-notifications-live-notifications'

// Focus these tests on our owned integration, not the concurrently edited shell.
vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, api }: { children: ReactNode; api?: ApiClient }) => (
    <main data-live-api={!!api}>{children}</main>
  ),
  DesignIcon: () => <span aria-hidden="true" />,
}))

const actor = '11111111-1111-4111-8111-111111111111'
const patientA = '22222222-2222-4222-8222-222222222222'
const patientB = '33333333-3333-4333-8333-333333333333'
const conversationA = '44444444-4444-4444-8444-444444444444'
const conversationB = '55555555-5555-4555-8555-555555555555'
const messageA = '66666666-6666-4666-8666-666666666666'
const messageB = '77777777-7777-4777-8777-777777777777'
const notificationId = '88888888-8888-4888-8888-888888888888'
const key = '99999999-9999-4999-8999-999999999999'
const session = (id = actor): ApiSession => ({
  user: {
    id,
    name: 'Therapist',
    email: null,
    whatsapp_number: '',
    role: 'therapist',
    is_active: true,
    phone_verified_at: '2026-10-01T00:00:00Z',
    timezone: 'UTC',
  },
  access_token: 'test-memory-access',
  refresh_token: 'r'.repeat(64),
  token_type: 'Bearer',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
})
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
const pagination = { current_page: 1, last_page: 1, total: 1 }
function conversation(id = patientA, status = 'active') {
  return {
    id: id === patientA ? conversationA : conversationB,
    counterpart_id: id,
    patient: { id, name: id === patientA ? 'Client A' : 'Client B' },
    therapist: { id: actor, name: 'Therapist' },
    status,
    unread_count: 2,
    last_message_at: null,
  }
}
function message(id = patientA, content = 'History A', outgoing = false) {
  return {
    id: id === patientA ? messageA : messageB,
    conversation_id: id === patientA ? conversationA : conversationB,
    sender_id: outgoing ? actor : id,
    receiver_id: outgoing ? id : actor,
    content,
    attachment: null,
    is_read: true,
    read_at: '2026-10-01T00:00:00Z',
    sent_at: '2026-10-01T00:00:00Z',
  }
}
async function makeApi(handler: (path: string, init: RequestInit) => Promise<Response> | Response) {
  const transport = vi.fn<typeof fetch>((input, init) =>
    Promise.resolve(
      handler(
        new URL(String(input)).pathname.replace('/api/v1', '') + new URL(String(input)).search,
        init || {},
      ),
    ),
  )
  const api = new ApiClient('https://care.example/api/v1', transport)
  await api.establish(session())
  return { api, transport }
}
function baseHandler(path: string, init: RequestInit): Response {
  if (path.startsWith('/chat?'))
    return json({ data: [conversation(), conversation(patientB)], pagination })
  if (path.startsWith(`/chat/${patientA}?`))
    return json({ conversation: conversation(), data: [message()], pagination })
  if (path.startsWith(`/chat/${patientB}?`))
    return json({
      conversation: conversation(patientB),
      data: [message(patientB, 'History B')],
      pagination,
    })
  if (path.endsWith('/read')) return json({ updated: 0 })
  if (init.method === 'POST')
    return json({ conversation_id: conversationA, data: message(patientA, 'Reply', true) }, 201)
  return json({}, 404)
}
function selectClient(name = 'Client A') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
}

beforeEach(() => {
  window.history.replaceState({}, '', '/chats')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(key)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('live Laravel chat integration', () => {
  it('sends to counterpart UUID with bearer/JSON/idempotency headers; deduplicates submissions and shows only GET-confirmed messages', async () => {
    let resolveSend!: (response: Response) => void
    let delivered = false
    const { api, transport } = await makeApi((path, init) => {
      if (path === `/chat/${patientA}` && init.method === 'POST')
        return new Promise<Response>((resolve) => {
          resolveSend = resolve
        })
      if (delivered && path.startsWith(`/chat/${patientA}?`))
        return json({
          conversation: conversation(),
          data: [message(patientB, 'Reply', true), message()],
          pagination,
        })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    expect(document.querySelector('main')).toHaveAttribute('data-live-api', 'true')
    fireEvent.change(screen.getByLabelText('Message', { exact: true }), {
      target: { value: '  Reply  ' },
    })
    const form = screen.getByLabelText('Message', { exact: true }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    const calls = transport.mock.calls.filter(
      ([url, init]) => String(url).endsWith(`/chat/${patientA}`) && init?.method === 'POST',
    )
    expect(calls).toHaveLength(1)
    const [url, init] = calls[0]
    expect(String(url)).not.toContain(conversationA)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-memory-access')
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(key)
    expect(init?.body).toBe(JSON.stringify({ content: 'Reply' }))
    expect(init?.credentials).toBe('omit')
    expect(screen.queryByText('Reply', { selector: '.message-bubble' })).not.toBeInTheDocument()
    delivered = true
    await act(async () =>
      resolveSend(
        json(
          { conversation_id: conversationA, data: message(patientA, 'Old cached payload', true) },
          201,
        ),
      ),
    )
    expect(await screen.findByText('Reply', { selector: '.message-bubble' })).toBeInTheDocument()
    expect(screen.queryByText('Old cached payload')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Message', { exact: true })).toHaveValue('')
  })

  it('retains failed text, sanitizes server errors, and retries the immutable message using the same key', async () => {
    let attempts = 0
    const { api, transport } = await makeApi((path, init) => {
      if (path === `/chat/${patientA}` && init.method === 'POST')
        return ++attempts === 1
          ? json({ message: 'SQL password leaked here' }, 500)
          : json({ conversation_id: conversationA, data: message() }, 201)
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    fireEvent.change(screen.getByLabelText('Message', { exact: true }), {
      target: { value: 'Keep this draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText(/Your draft is retained/)
    expect(screen.getByLabelText('Message', { exact: true })).toHaveValue('Keep this draft')
    expect(screen.queryByText(/SQL password/)).not.toBeInTheDocument()
    expect(
      screen.queryByText('Keep this draft', { selector: '.message-bubble' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry sending message' }))
    await waitFor(() => expect(screen.getByLabelText('Message', { exact: true })).toHaveValue(''))
    const sends = transport.mock.calls.filter(
      ([url, init]) => String(url).endsWith(`/chat/${patientA}`) && init?.method === 'POST',
    )
    expect(sends).toHaveLength(2)
    expect(sends.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key'))).toEqual([
      key,
      key,
    ])
    expect(sends[0][1]?.body).toBe(sends[1][1]?.body)
  })

  it('keeps closed history readable and composer disabled; does not fabricate permission fallback on 403', async () => {
    const { api } = await makeApi((path, init) => {
      if (path.startsWith(`/chat/${patientA}?`))
        return json({
          conversation: conversation(patientA, 'closed'),
          data: [message()],
          pagination,
        })
      if (path.startsWith(`/chat/${patientB}?`))
        return json({ message: 'private internal denial' }, 403)
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    expect(screen.getByLabelText('Message', { exact: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(screen.getByText(/This conversation is closed/)).toBeInTheDocument()
    selectClient('Client B')
    await screen.findByText('This action is not permitted for your account.')
    expect(screen.queryByText('History A')).not.toBeInTheDocument()
    expect(screen.queryByText(/private internal denial/)).not.toBeInTheDocument()
    expect(screen.queryByText('Sara Khaled')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Message', { exact: true })).toBeDisabled()
  })

  it('refetches after send conflict and makes the newly closed conversation read-only without clearing the draft', async () => {
    let closed = false
    const { api } = await makeApi((path, init) => {
      if (path === `/chat/${patientA}` && init.method === 'POST') {
        closed = true
        return json({ message: 'closed' }, 409)
      }
      if (path.startsWith(`/chat/${patientA}?`))
        return json({
          conversation: conversation(patientA, closed ? 'closed' : 'active'),
          data: [message()],
          pagination,
        })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    fireEvent.change(screen.getByLabelText('Message', { exact: true }), {
      target: { value: 'Unsent' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText(/This conversation is closed/)
    expect(screen.getByLabelText('Message', { exact: true })).toHaveValue('Unsent')
    expect(screen.getByRole('button', { name: 'Retry sending message' })).toBeDisabled()
  })

  it('aborts switched-thread GETs and never renders stale clinical content or posts read to an undisplayed thread', async () => {
    let resolveA!: (response: Response) => void
    const { api, transport } = await makeApi((path, init) => {
      if (path.startsWith(`/chat/${patientA}?`))
        return new Promise<Response>((resolve) => {
          resolveA = resolve
        })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    selectClient('Client B')
    await screen.findByText('History B')
    const aCall = transport.mock.calls.find(([url]) => String(url).includes(`/chat/${patientA}?`))!
    expect(aCall[1]?.signal?.aborted).toBe(true)
    await act(async () =>
      resolveA(
        json({
          conversation: conversation(),
          data: [{ ...message(patientA, 'Stale secret A'), is_read: false }],
          pagination,
        }),
      ),
    )
    expect(screen.queryByText('Stale secret A')).not.toBeInTheDocument()
    expect(screen.getByText('History B')).toBeInTheDocument()
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith(`/chat/${patientA}/read`)),
    ).toHaveLength(0)
  })

  it('maps sender UUIDs and newest-first history chronologically, and marks only the presented thread read', async () => {
    let read = false
    const { api, transport } = await makeApi((path, init) => {
      if (path === `/chat/${patientA}/read`) {
        read = true
        return json({ updated: 1 })
      }
      if (path.startsWith(`/chat/${patientA}?`))
        return json({
          conversation: conversation(),
          data: [
            { ...message(patientB, 'Later outgoing', true), sent_at: '2026-10-01T12:00:00Z' },
            {
              ...message(patientA, 'Earlier incoming'),
              is_read: read,
              sent_at: '2026-10-01T10:00:00Z',
            },
          ],
          pagination,
        })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    expect(transport.mock.calls.some(([url]) => String(url).endsWith('/read'))).toBe(false)
    selectClient()
    await screen.findByText('Earlier incoming')
    const bubbles = document.querySelectorAll('.message-bubble')
    expect([...bubbles].map((item) => item.textContent)).toEqual([
      'Earlier incoming',
      'Later outgoing',
    ])
    expect(screen.getByText('Later outgoing').closest('.message-group')).toHaveClass('outgoing')
    expect(screen.getByText('Earlier incoming').closest('.message-group')).not.toHaveClass(
      'outgoing',
    )
    await waitFor(() =>
      expect(
        transport.mock.calls.filter(([url]) => String(url).endsWith(`/chat/${patientA}/read`)),
      ).toHaveLength(1),
    )
    expect(
      transport.mock.calls.filter(([url]) => String(url).includes('/notifications')),
    ).toHaveLength(0)
  })

  it('loads currently owned clients for unopened threads and supports attachment-only multipart with immutable retry files', async () => {
    let attempts = 0
    const { api, transport } = await makeApi((path, init) => {
      if (path.startsWith('/therapists/clients?'))
        return json({
          data: [
            { id: patientA, full_name: 'Owned client', status: 'active' },
            { id: patientB, full_name: 'Past client', status: 'past' },
          ],
          pagination,
        })
      if (path.startsWith(`/chat/${patientA}?`))
        return json({ conversation: null, data: [], pagination: null })
      if (path === `/chat/${patientA}` && init.method === 'POST')
        return ++attempts === 1
          ? json({}, 500)
          : json({ conversation_id: conversationA, data: message() }, 201)
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Owned client' }))
    expect(screen.queryByText('Past client')).not.toBeInTheDocument()
    await screen.findByText('No messages yet.')
    const file = new File(['plain bytes'], 'care.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('Message attachment'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText(/Your draft is retained/)
    fireEvent.click(screen.getByRole('button', { name: 'Retry sending message' }))
    await screen.findByText(/Message accepted by the server/)
    const sends = transport.mock.calls.filter(
      ([url, init]) => String(url).endsWith(`/chat/${patientA}`) && init?.method === 'POST',
    )
    expect(sends).toHaveLength(2)
    for (const [, init] of sends) {
      expect(init?.body).toBeInstanceOf(FormData)
      const body = init?.body as FormData
      expect(body.get('content')).toBeNull()
      expect(body.get('attachment')).toBe(file)
      expect(new Headers(init?.headers).get('Content-Type')).toBeNull()
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(key)
    }
  })

  it('downloads from trusted message endpoint, ignoring returned attachment URLs, and immediately revokes the blob', async () => {
    const { api, transport } = await makeApi((path, init) => {
      if (path.startsWith(`/chat/${patientA}?`))
        return json({
          conversation: conversation(),
          data: [
            {
              ...message(),
              attachment: {
                name: '../care.pdf',
                type: 'file',
                mime_type: 'application/pdf',
                size: 4,
                download_url: 'https://evil.example/steal-token',
              },
            },
          ],
          pagination,
        })
      if (path === `/chat/attachments/${messageA}`)
        return new Response('file', { headers: { 'Content-Type': 'application/pdf' } })
      return baseHandler(path, init)
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:memory-test'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    fireEvent.click(await screen.findByRole('button', { name: /Download .*care.pdf/ }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    const download = transport.mock.calls.find(([url]) =>
      String(url).includes('/chat/attachments/'),
    )!
    expect(String(download[0])).toBe(`https://care.example/api/v1/chat/attachments/${messageA}`)
    expect(new Headers(download[1]?.headers).get('Authorization')).toBe('Bearer test-memory-access')
    expect(transport.mock.calls.some(([url]) => String(url).includes('evil.example'))).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:memory-test')
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
    expect(document.querySelector('iframe, audio, video')).not.toBeInTheDocument()
  })

  it('clears clinical state and drafts on actor change/logout and aborts pending requests', async () => {
    const { api } = await makeApi(baseHandler)
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    fireEvent.change(screen.getByLabelText('Message', { exact: true }), {
      target: { value: 'Sensitive draft' },
    })
    await act(async () => api.establish(session(patientB)))
    expect(screen.queryByText('History A')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Message', { exact: true })).not.toBeInTheDocument()
    act(() => api.clear())
    expect(screen.getByText(/Your session has ended/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Conversations' })).not.toBeInTheDocument()
  })

  it('paginates conversations and merges shifting older history pages by UUID without duplicates', async () => {
    const { api, transport } = await makeApi((path, init) => {
      if (path.startsWith('/chat?page=2'))
        return json({
          data: [conversation(patientB)],
          pagination: { current_page: 2, last_page: 2, total: 2 },
        })
      if (path.startsWith('/chat?'))
        return json({
          data: [conversation()],
          pagination: { current_page: 1, last_page: 2, total: 2 },
        })
      if (path.startsWith(`/chat/${patientA}?page=2`))
        return json({
          conversation: conversation(),
          data: [
            message(),
            {
              ...message(patientB, 'Earlier history'),
              conversation_id: conversationA,
              sent_at: '2026-09-01T00:00:00Z',
            },
          ],
          pagination: { current_page: 2, last_page: 2, total: 3 },
        })
      if (path.startsWith(`/chat/${patientA}?`))
        return json({
          conversation: conversation(),
          data: [message()],
          pagination: { current_page: 1, last_page: 2, total: 3 },
        })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    fireEvent.click(await screen.findByRole('button', { name: 'Load earlier messages' }))
    await screen.findByText('Earlier history')
    expect(screen.getAllByText('History A')).toHaveLength(1)
    expect(
      [...document.querySelectorAll('.message-bubble')].map((item) => item.textContent),
    ).toEqual(['Earlier history', 'History A'])
    expect(
      transport.mock.calls.some(([url]) => String(url).includes(`/${patientA}?page=2&per_page=30`)),
    ).toBe(true)
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Conversation pages' })).getByRole('button', {
        name: 'Next',
      }),
    )
    await screen.findByRole('button', { name: /^Client B/ })
    expect(screen.queryByRole('button', { name: /^Client A/ })).not.toBeInTheDocument()
    expect(screen.getByText('History A')).toBeInTheDocument()
  })

  it('rejects disallowed or oversized attachment selections without sending a request', async () => {
    const { api, transport } = await makeApi(baseHandler)
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    fireEvent.change(screen.getByLabelText('Message attachment'), {
      target: { files: [new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })] },
    })
    expect(screen.getByText(/Choose an allowed image/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    const large = new File(['x'], 'large.png', { type: 'image/png' })
    Object.defineProperty(large, 'size', { value: 5 * 1024 * 1024 + 1 })
    fireEvent.change(screen.getByLabelText('Message attachment'), { target: { files: [large] } })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(transport.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('ignores a completed stale send after switching threads and aborts its signal', async () => {
    let resolveSend!: (response: Response) => void
    const { api, transport } = await makeApi((path, init) => {
      if (path === `/chat/${patientA}` && init.method === 'POST')
        return new Promise<Response>((resolve) => {
          resolveSend = resolve
        })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await screen.findByRole('button', { name: /^Client A/ })
    selectClient()
    await screen.findByText('History A')
    fireEvent.change(screen.getByLabelText('Message', { exact: true }), {
      target: { value: 'A-only draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    selectClient('Client B')
    await screen.findByText('History B')
    const send = transport.mock.calls.find(
      ([url, init]) => String(url).endsWith(`/chat/${patientA}`) && init?.method === 'POST',
    )!
    expect(send[1]?.signal?.aborted).toBe(true)
    await act(async () =>
      resolveSend(
        json(
          { conversation_id: conversationA, data: message(patientA, 'A-only draft', true) },
          201,
        ),
      ),
    )
    expect(screen.queryByText('A-only draft')).not.toBeInTheDocument()
    expect(screen.queryByText(/Message accepted by the server/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Message', { exact: true })).toHaveValue('')
    expect(screen.getByText('History B')).toBeInTheDocument()
  })

  it('never overlaps a pending polling request, even across focus and reconnect events', async () => {
    vi.useFakeTimers()
    let resolveList!: (response: Response) => void
    const { api, transport } = await makeApi(
      () =>
        new Promise<Response>((resolve) => {
          resolveList = resolve
        }),
    )
    render(<Chats api={api} navigate={vi.fn()} />)
    await act(async () => {})
    act(() => window.dispatchEvent(new Event('focus')))
    act(() => window.dispatchEvent(new Event('online')))
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    expect(transport).toHaveBeenCalledTimes(1)
    await act(async () => resolveList(json({ data: [conversation()], pagination })))
    await act(async () => {
      vi.advanceTimersByTime(0)
    })
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('stops polling hidden/offline and honors Retry-After without overlapping pending requests', async () => {
    vi.useFakeTimers()
    let requests = 0
    const { api, transport } = await makeApi((path, init) => {
      if (path.startsWith('/chat?') && ++requests === 1)
        return json({}, 429, { 'Retry-After': '90' })
      return baseHandler(path, init)
    })
    render(<Chats api={api} navigate={vi.fn()} />)
    await act(async () => {})
    expect(transport).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })
    expect(transport).toHaveBeenCalledTimes(1)
    act(() => window.dispatchEvent(new Event('focus')))
    await act(async () => {
      vi.advanceTimersByTime(59000)
    })
    expect(transport).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(transport).toHaveBeenCalledTimes(2)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(transport).toHaveBeenCalledTimes(2)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(transport).toHaveBeenCalledTimes(2)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    await act(async () => window.dispatchEvent(new Event('online')))
    expect(transport).toHaveBeenCalledTimes(3)
  })
})

describe('live notification component for the shared Workspace', () => {
  it('uses kind mapping and generic fallback, reads without deleting, refreshes count, and navigates with sender UUID', async () => {
    let read = false
    const navigate = vi.fn()
    const { api, transport } = await makeApi((path) => {
      if (path.startsWith('/notifications?'))
        return json({
          data: [
            {
              id: notificationId,
              data: {
                kind: 'chat_message_received',
                sender_id: patientA,
                conversation_id: conversationA,
                url: 'https://evil.example',
                preview: 'Sensitive preview',
              },
              read_at: read ? '2026-10-01T00:00:00Z' : null,
              created_at: null,
            },
            {
              id: messageB,
              data: { kind: '<script>unsafe</script>', title: 'Not trusted title' },
              read_at: null,
              created_at: null,
            },
          ],
          unread_count: read ? 1 : 2,
          pagination,
        })
      if (path === '/notifications/read-all') {
        read = true
        return json({ message: 'All notifications marked as read.' })
      }
      if (path === `/notifications/${notificationId}/read`) {
        read = true
        return json({ message: 'Marked as read.' })
      }
      return json({}, 404)
    })
    render(<LiveNotifications api={api} navigate={navigate} />)
    await screen.findByText('New care message')
    expect(screen.getByText('Account update')).toBeInTheDocument()
    expect(screen.queryByText('Sensitive preview')).not.toBeInTheDocument()
    expect(screen.queryByText('Not trusted title')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open conversation' }))
    expect(navigate).toHaveBeenCalledWith(`/chats?client=${patientA}`)
    const article = screen.getByText('New care message').closest('article')!
    fireEvent.click(within(article).getByRole('button', { name: 'Mark read' }))
    await screen.findByText('1 unread notifications')
    expect(screen.getByText('New care message')).toBeInTheDocument()
    expect(
      transport.mock.calls.some(([url]) =>
        String(url).includes(`/notifications/${notificationId}/read`),
      ),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() =>
      expect(
        transport.mock.calls.some(([url]) => String(url).endsWith('/notifications/read-all')),
      ).toBe(true),
    )
    expect(transport.mock.calls.some(([url]) => String(url).includes('/chat/'))).toBe(false)
  })
})
