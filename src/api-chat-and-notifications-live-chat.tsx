import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiClient, ApiError, apiErrorMessage, apiId } from './api'
import { useApiUser } from './api-hooks'
import { DesignIcon, Workspace } from './Workspace'
import {
  chatCanRefresh,
  useChatConnectivity,
  useChatLifetime,
  useChatPolling,
} from './api-chat-and-notifications-polling'

type Pagination = { current_page: number; last_page: number; total: number }
type Conversation = {
  id: string
  counterpart_id: string
  patient: { id: string; name: string | null }
  therapist: { id: string; name: string | null }
  status: 'active' | 'closed'
  unread_count: number
  last_message_at: string | null
}
type Message = {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  content: string | null
  attachment: null | {
    type: string
    name: string
    mime_type: string
    size: number
    download_url: string
  }
  is_read: boolean
  read_at: string | null
  sent_at: string | null
}
type Thread = { conversation: Conversation | null; data: Message[]; pagination: Pagination | null }
type SendRequest = { text: string; file: File | null; key: string }
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const FILE_TYPES = [
  ...IMAGE_TYPES,
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

function initialCounterpart() {
  const value = new URLSearchParams(window.location.search).get('client')
  try {
    return value ? apiId(value) : null
  } catch {
    return null
  }
}
function timestamp(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : ''
}
function mergeMessages(previous: Message[], incoming: Message[]) {
  const unique = new Map(previous.map((message) => [message.id, message]))
  incoming.forEach((message) => unique.set(message.id, message))
  return [...unique.values()].sort(
    (a, b) =>
      (Date.parse(a.sent_at || '') || 0) - (Date.parse(b.sent_at || '') || 0) ||
      a.id.localeCompare(b.id),
  )
}

export function LiveChats({ api, navigate }: { api: ApiClient; navigate: (path: string) => void }) {
  const user = useApiUser(api)
  return user ? (
    <ActorChats key={api.getSessionKey()} api={api} navigate={navigate} actor={user.id} />
  ) : (
    <Workspace api={api} title="Chats" active="Messages" navigate={navigate}>
      <p role="alert">Your session has ended. Please sign in again.</p>
    </Workspace>
  )
}

function ActorChats({
  api,
  navigate,
  actor,
}: {
  api: ApiClient
  navigate: (path: string) => void
  actor: string
}) {
  const [selected, setSelected] = useState<string | null>(initialCounterpart)
  const [selectedName, setSelectedName] = useState('Client')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [chooser, setChooser] = useState(false)
  const online = useChatConnectivity()
  useEffect(() => {
    // Same-path notification destinations do not remount the pathname-keyed page.
    // Re-read only the validated counterpart; the keyed thread still owns cancellation.
    const syncDestination = () => {
      if (!['/chats', '/messages'].includes(window.location.pathname)) return
      setSelected(initialCounterpart())
      setSelectedName('Client')
      setChooser(false)
    }
    window.addEventListener('popstate', syncDestination)
    return () => window.removeEventListener('popstate', syncDestination)
  }, [])
  const list = useChatPolling<{ data: Conversation[]; pagination: Pagination }>(
    api,
    `/chat?page=${page}&per_page=15`,
    30000,
  )
  function select(id: string, name: string | null) {
    try {
      setSelected(apiId(id))
      setSelectedName(name || 'Client')
      setChooser(false)
    } catch {
      /* Invalid route IDs are never forwarded to the API. */
    }
  }
  const conversations =
    list.data?.data.filter((item) =>
      (item.patient.name || 'Client').toLowerCase().includes(query.trim().toLowerCase()),
    ) ?? []
  return (
    <Workspace
      api={api}
      title="Chats"
      active="Messages"
      navigate={navigate}
      offline={!online}
      onSearch={setQuery}
    >
      <div className={`chat-layout live-chat-layout ${selected ? 'has-conversation' : 'no-conversation'}`}>
        <section className="chat-list" aria-label="Conversations">
          <label className="chat-search">
            <DesignIcon name="part2-03-imgSearch.svg" />
            <input
              aria-label="Search conversations"
              placeholder="Search loaded page…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p className="response-promise list-promise">
            Search only this loaded conversation page.
          </p>
          <button
            className="soft-button new-conversation"
            aria-expanded={chooser}
            disabled={!online || list.error?.status === 403}
            onClick={() => setChooser(!chooser)}
          >
            New conversation
          </button>
          {chooser && <OwnedClients api={api} select={select} />}
          {list.loading && <p role="status">Loading conversations…</p>}
          {list.error && (
            <p role="alert">
              {apiErrorMessage(list.error)}{' '}
              <button onClick={list.reload} disabled={!!list.retryAt}>
                Retry conversations
              </button>
            </p>
          )}
          {!!list.retryAt && <p role="status">Waiting before retrying the server.</p>}
          <div className="conversation-list">
            {conversations.map((item) => (
              <button
                key={item.id}
                className={`conversation ${selected === item.counterpart_id ? 'selected' : ''}`}
                onClick={() => select(item.counterpart_id, item.patient.name)}
              >
                <span className="chat-avatar api-avatar" aria-hidden="true">
                  {(item.patient.name || 'Client').slice(0, 1)}
                </span>
                <span className="conversation-copy">
                  <span>
                    <strong>{item.patient.name || 'Client'}</strong>
                    <time>{timestamp(item.last_message_at)}</time>
                  </span>
                  <span>
                    <small>
                      {item.status === 'closed' ? 'Closed conversation' : 'Conversation'}
                    </small>
                    {item.unread_count > 0 && (
                      <i aria-label={`${item.unread_count} unread messages`}>{item.unread_count}</i>
                    )}
                  </span>
                </span>
              </button>
            ))}
            {list.data && conversations.length === 0 && (
              <p className="empty-result">No conversations found.</p>
            )}
          </div>
          {list.data && (
            <nav aria-label="Conversation pages">
              <button
                disabled={page <= 1 || list.loading || !!list.retryAt}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {list.data.pagination.last_page}
              </span>
              <button
                disabled={page >= list.data.pagination.last_page || list.loading || !!list.retryAt}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
        {selected ? (
          <ChatThread
            key={selected}
            api={api}
            actor={actor}
            counterpart={selected}
            name={selectedName}
            onBack={() => setSelected(null)}
            onReconcile={list.reload}
          />
        ) : (
          <section className="empty-conversation" aria-label="Select a conversation">
            <div>
              <span>
                <DesignIcon name="part2-20-imgMessageCircleLinesAlt1.svg" />
              </span>
              <h2>Select a conversation</h2>
              <p>Open a conversation or choose an assigned client to start one.</p>
            </div>
          </section>
        )}
      </div>
    </Workspace>
  )
}

function OwnedClients({
  api,
  select,
}: {
  api: ApiClient
  select: (id: string, name: string | null) => void
}) {
  const [page, setPage] = useState(1)
  const resource = useChatPolling<{
    data: { id: string; full_name: string | null; status: string }[]
    pagination: Pagination
  }>(api, `/therapists/clients?status=active&page=${page}&per_page=20`, 30000)
  return (
    <section className="assigned-clients" aria-label="Assigned clients">
      <p>Start a conversation with a currently assigned client.</p>
      {resource.loading && <p role="status">Loading assigned clients…</p>}
      {resource.error && (
        <p role="alert">
          {apiErrorMessage(resource.error)}{' '}
          <button disabled={!!resource.retryAt} onClick={resource.reload}>
            Retry clients
          </button>
        </p>
      )}
      {resource.data?.data
        .filter((client) => client.status === 'active')
        .map((client) => (
          <button key={client.id} onClick={() => select(client.id, client.full_name)}>
            {client.full_name || 'Client'}
          </button>
        ))}
      {resource.data?.data.length === 0 && <p>No currently assigned clients.</p>}
      {resource.data && (
        <nav aria-label="Assigned client pages">
          <button
            disabled={page <= 1 || resource.loading || !!resource.retryAt}
            onClick={() => setPage(page - 1)}
          >
            Previous clients
          </button>
          <span>
            Page {page} of {resource.data.pagination.last_page}
          </span>
          <button
            disabled={
              page >= resource.data.pagination.last_page || resource.loading || !!resource.retryAt
            }
            onClick={() => setPage(page + 1)}
          >
            Next clients
          </button>
        </nav>
      )}
    </section>
  )
}

function ChatThread({
  api,
  actor,
  counterpart,
  name,
  onBack,
  onReconcile,
}: {
  api: ApiClient
  actor: string
  counterpart: string
  name: string
  onBack: () => void
  onReconcile: () => void
}) {
  const path = `/chat/${apiId(counterpart)}`
  const resource = useChatPolling<Thread>(api, `${path}?page=1&per_page=30`, 15000)
  const lifetime = useChatLifetime()
  const online = useChatConnectivity()
  const [messages, setMessages] = useState<Message[]>([])
  const conversationId = useRef<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyBusy, setHistoryBusy] = useState(false)
  const historyLock = useRef(false)
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingRequest, setPendingRequest] = useState<SendRequest | null>(null)
  const requestRef = useRef<SendRequest | null>(null)
  const sendLock = useRef(false)
  const [sending, setSending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [readError, setReadError] = useState('')
  const readLock = useRef(false)
  const readSignature = useRef('')
  const [downloadBusy, setDownloadBusy] = useState(false)
  const downloadLock = useRef(false)
  const denied = resource.error?.status === 403 || resource.error?.status === 404
  const closed = resource.data?.conversation?.status === 'closed'
  const readOnly =
    closed || conflict || denied || !resource.data || (!!pendingRequest && resource.loading)
  const threadName = resource.data?.conversation?.patient.name || name

  useEffect(() => {
    if (resource.data) {
      const data = resource.data
      const changed = conversationId.current !== (data.conversation?.id || null)
      conversationId.current = data.conversation?.id || null
      setMessages((current) =>
        data.conversation ? mergeMessages(changed ? [] : current, data.data) : [],
      )
      if (changed || !data.conversation) setHistoryPage(1)
      setConflict(false)
    } else if (resource.error) {
      setMessages([])
      setHistoryPage(1)
    }
  }, [resource.data, resource.error])

  async function markRead(signature: string) {
    if (readLock.current || !resource.canRequest() || !resource.data || resource.error) return
    readLock.current = true
    readSignature.current = signature
    const controller = new AbortController()
    lifetime.current.controllers.add(controller)
    setReadError('')
    try {
      await api.mutate(`${path}/read`, undefined, { signal: controller.signal })
      if (!lifetime.current.alive || controller.signal.aborted) return
      resource.reload()
      onReconcile()
    } catch (failure) {
      if (lifetime.current.alive && !controller.signal.aborted) {
        resource.defer(failure)
        setReadError(apiErrorMessage(failure))
        if (failure instanceof ApiError && [403, 404].includes(failure.status)) resource.reload()
      }
    } finally {
      lifetime.current.controllers.delete(controller)
      readLock.current = false
    }
  }
  // Mark only a successfully loaded, actually displayed thread. This endpoint marks ALL
  // incoming unread messages, not just this page; notification read status is independent.
  const unreadSignature = messages
    .filter((item) => item.sender_id !== actor && !item.is_read)
    .map((item) => item.id)
    .sort()
    .join(',')
  useEffect(() => {
    if (unreadSignature && unreadSignature !== readSignature.current && chatCanRefresh())
      void markRead(unreadSignature)
    // The signature and latest successful page are the read boundary, not timer ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadSignature, resource.data])

  async function older() {
    if (historyLock.current || !resource.canRequest() || !resource.data?.pagination) return
    historyLock.current = true
    setHistoryBusy(true)
    setError('')
    const controller = new AbortController()
    lifetime.current.controllers.add(controller)
    try {
      // Refetch the boundary before adding another shifting page; merge by message UUID.
      const nextPage = historyPage + 1
      const boundary = await api.get<Thread>(
        `${path}?page=${historyPage}&per_page=30`,
        controller.signal,
      )
      const result = await api.get<Thread>(
        `${path}?page=${nextPage}&per_page=30`,
        controller.signal,
      )
      if (!lifetime.current.alive || controller.signal.aborted) return
      if (
        !result.conversation ||
        result.conversation.id !== conversationId.current ||
        boundary.conversation?.id !== conversationId.current
      ) {
        setMessages([])
        setHistoryPage(1)
        resource.reload()
        return
      }
      setMessages((current) => mergeMessages(current, [...boundary.data, ...result.data]))
      setHistoryPage(nextPage)
      resource.reload()
    } catch (failure) {
      if (lifetime.current.alive && !controller.signal.aborted) {
        resource.defer(failure)
        setError(apiErrorMessage(failure))
        if (failure instanceof ApiError && [403, 404].includes(failure.status)) resource.reload()
      }
    } finally {
      lifetime.current.controllers.delete(controller)
      historyLock.current = false
      if (lifetime.current.alive && !controller.signal.aborted) setHistoryBusy(false)
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    if (
      sendLock.current ||
      readOnly ||
      !resource.canRequest() ||
      (!draft.trim() && !file && !requestRef.current)
    )
      return
    const request = requestRef.current || {
      text: draft.trim().replace(/\0/g, ''),
      file,
      key: crypto.randomUUID(),
    }
    if (!request.text && !request.file) return
    requestRef.current = request
    setPendingRequest(request)
    sendLock.current = true
    setSending(true)
    setError('')
    setFeedback('')
    const controller = new AbortController()
    lifetime.current.controllers.add(controller)
    try {
      let body: FormData | { content: string | null }
      if (request.file) {
        body = new FormData()
        if (request.text) body.append('content', request.text)
        body.append('attachment', request.file)
      } else body = { content: request.text || null }
      await api.mutate<{ conversation_id: string; data: Message }>(path, body, {
        signal: controller.signal,
        idempotencyKey: request.key,
      })
      if (!lifetime.current.alive || controller.signal.aborted) return
      requestRef.current = null
      setPendingRequest(null)
      setDraft('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      // A keyed replay is an old snapshot, not proof that clinical data still exists.
      // Display from an independently authorized GET rather than appending its cached body.
      setFeedback('Message accepted by the server. Refreshing conversation…')
      resource.reload()
      onReconcile()
    } catch (failure) {
      if (lifetime.current.alive && !controller.signal.aborted) {
        resource.defer(failure)
        setError(apiErrorMessage(failure))
        // Reconcile after any ambiguous response before an explicit same-key retry.
        resource.reload()
        onReconcile()
        if (failure instanceof ApiError && [403, 404, 409].includes(failure.status)) {
          setConflict(true)
          resource.reload()
        }
        // Validation/authorization denial is definitive. Ambiguous failures keep the
        // exact text, same File object and same key for explicit, safe retries.
        if (failure instanceof ApiError && [403, 404, 413, 422].includes(failure.status)) {
          requestRef.current = null
          setPendingRequest(null)
        }
        if (failure instanceof ApiError && failure.fields.attachment)
          setError('Please check the attachment type and size. The server validates file contents.')
        else if (failure instanceof ApiError && failure.fields.content)
          setError(
            'Please check the message. Use text up to 4,000 characters or an allowed attachment.',
          )
      }
    } finally {
      lifetime.current.controllers.delete(controller)
      sendLock.current = false
      if (lifetime.current.alive && !controller.signal.aborted) setSending(false)
    }
  }

  function chooseFile(value: File | null) {
    if (!value) return
    const max = IMAGE_TYPES.includes(value.type) ? 5 * 1024 * 1024 : 10 * 1024 * 1024
    if (!FILE_TYPES.includes(value.type) || value.size > max || value.size === 0) {
      setError(
        'Choose an allowed image (up to 5 MB), audio or PDF/text/Word file (up to 10 MB). Server file validation is authoritative.',
      )
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setFile(value)
    setError('')
  }

  async function download(message: Message) {
    if (downloadLock.current || !message.attachment || !resource.canRequest() || denied) return
    downloadLock.current = true
    setDownloadBusy(true)
    setError('')
    const controller = new AbortController()
    lifetime.current.controllers.add(controller)
    let url: string | null = null
    try {
      // Never use attachment.download_url or send a bearer token to a returned host.
      const blob = await api.request<Blob>(`/chat/attachments/${apiId(message.id)}`, 'GET', {
        binary: true,
        signal: controller.signal,
      })
      if (!lifetime.current.alive || controller.signal.aborted) return
      url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download =
        Array.from(message.attachment.name.split(/[\\/]/).at(-1) || '')
          .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
          .join('') || 'attachment'
      link.rel = 'noopener'
      document.body.appendChild(link)
      try {
        link.click()
      } finally {
        link.remove()
      }
    } catch (failure) {
      if (lifetime.current.alive && !controller.signal.aborted) {
        resource.defer(failure)
        setError(apiErrorMessage(failure))
      }
    } finally {
      if (url) URL.revokeObjectURL(url)
      lifetime.current.controllers.delete(controller)
      downloadLock.current = false
      if (lifetime.current.alive && !controller.signal.aborted) setDownloadBusy(false)
    }
  }

  return (
    <section className="chat-thread" aria-label={`Conversation with ${threadName}`}>
      <header className="chat-thread-header">
        <button
          className="thread-back icon-button"
          aria-label="Back to conversations"
          onClick={onBack}
        >
          <DesignIcon name="part2-06-imgIcon.svg" />
        </button>
        <span className="chat-avatar api-avatar" aria-hidden="true">
          {threadName.slice(0, 1)}
        </span>
        <div>
          <strong>{threadName}</strong>
          <p>{closed ? 'Closed conversation · Read only' : 'Care conversation'}</p>
        </div>
      </header>
      <div className="message-history">
        {resource.loading && <p role="status">Loading conversation…</p>}
        {resource.error && (
          <p role="alert">
            {apiErrorMessage(resource.error)}{' '}
            <button disabled={!!resource.retryAt} onClick={resource.reload}>
              Retry conversation
            </button>
          </p>
        )}
        {!!resource.retryAt && <p role="status">Waiting before retrying the server.</p>}
        {resource.data && messages.length === 0 && <p>No messages yet.</p>}
        {!resource.error &&
          messages.map((message) => (
            <div
              key={message.id}
              className={`message-group ${message.sender_id === actor ? 'outgoing' : ''}`}
            >
              {message.content && <p className="message-bubble">{message.content}</p>}
              {message.attachment && (
                <button
                  disabled={downloadBusy || !online || !!resource.retryAt}
                  onClick={() => void download(message)}
                >
                  Download {message.attachment.name} ({Math.ceil(message.attachment.size / 1024)}{' '}
                  KB)
                </button>
              )}
              <time>
                {timestamp(message.sent_at)}
                {message.sender_id === actor ? (message.is_read ? ' · Read' : ' · Sent') : ''}
              </time>
            </div>
          ))}
        {resource.data?.pagination && historyPage < resource.data.pagination.last_page && (
          <button
            disabled={historyBusy || !online || !!resource.retryAt}
            onClick={() => void older()}
          >
            {historyBusy ? 'Loading earlier messages…' : 'Load earlier messages'}
          </button>
        )}
        <p>
          Opening this history marks all incoming messages in this conversation as read.
          Notifications are separate.
        </p>
        {readError && (
          <p role="alert">
            {readError}{' '}
            <button
              disabled={!!resource.retryAt || !online}
              onClick={() => void markRead(unreadSignature)}
            >
              Retry marking messages read
            </button>
          </p>
        )}
      </div>
      {closed && (
        <p role="status">
          This conversation is closed. You can read history and download attachments, but cannot
          send messages.
        </p>
      )}
      {conflict && <p role="status">Sending paused while the current conversation is refreshed.</p>}
      <form className="message-composer" onSubmit={(event) => void send(event)}>
        <button
          type="button"
          aria-label="Attach a file"
          disabled={readOnly || !online || !!pendingRequest}
          onClick={() => fileRef.current?.click()}
        >
          <DesignIcon name="part2-03-imgIcon3.svg" />
        </button>
        <input
          hidden
          ref={fileRef}
          type="file"
          accept={FILE_TYPES.join(',')}
          aria-label="Message attachment"
          disabled={readOnly || !online || !!pendingRequest}
          onChange={(event) => chooseFile(event.target.files?.[0] || null)}
        />
        <input
          aria-label="Message"
          placeholder={
            closed ? 'This conversation is read only' : 'Type your message to the client…'
          }
          maxLength={4000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={readOnly || !online || !!pendingRequest}
        />
        <button
          type="submit"
          aria-label={pendingRequest && !sending ? 'Retry sending message' : 'Send message'}
          disabled={
            readOnly || !online || sending || !!resource.retryAt || (!draft.trim() && !file)
          }
        >
          <DesignIcon name="part2-03-imgIcon4.svg" />
        </button>
      </form>
      {file && (
        <p className="demo-feedback">
          Attachment: {file.name}{' '}
          <button
            disabled={!!pendingRequest}
            onClick={() => {
              setFile(null)
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            Remove attachment
          </button>
        </p>
      )}
      {sending && <p role="status">Sending message…</p>}
      {pendingRequest && !sending && (
        <p role="status">
          Your draft is retained. Retry sends this exact message with the same request key; no
          delivery is assumed.
        </p>
      )}
      {error && (
        <p className="demo-feedback" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <p className="demo-feedback" role="status">
          {feedback}
        </p>
      )}
    </section>
  )
}
