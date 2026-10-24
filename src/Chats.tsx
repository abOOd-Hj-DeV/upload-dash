import { useEffect, useRef, useState, type FormEvent } from 'react'
import { asset } from './assets'
import { DesignIcon, Workspace } from './Workspace'
import { ApiClient } from './api'
import { LiveChats } from './api-chat-and-notifications-live-chat'
import '@fontsource/ibm-plex-sans/700.css'
import './visual-chats.css'

const clients = [
  {
    id: 'sara',
    name: 'Sara Khaled',
    image: 'dashboard-imgContainer3.png',
    preview: "When's the next unit?",
    time: '05/18',
    crop: '',
    unread: 0,
  },
  {
    id: 'ahmed',
    name: 'Ahmed Mohamed',
    image: 'dashboard-imgContainer1.png',
    preview: 'Thank you, doctor',
    time: '10:30 AM',
    crop: 'chat-portrait',
    unread: 2,
  },
  {
    id: 'jack',
    name: 'Jack watson',
    image: 'part2-03-imgContainer3.png',
    preview: 'Can I change the appointment?',
    time: 'Yesterday',
    crop: '',
    unread: 1,
  },
  {
    id: 'mohammed',
    name: 'Mohammed Hassan',
    image: 'dashboard-imgContainer4.png',
    preview: "I'm feeling a lot better",
    time: 'Yesterday',
    crop: 'chat-mohammed',
    unread: 0,
  },
]
type ChatMessage = {
  text: string
  time: string
  outgoing?: boolean
  today?: boolean
  expandOnPhone?: boolean
}
const saraMessages: ChatMessage[] = [
  {
    text: 'I feel better after applying the breathing exercises you recommended.',
    time: '9:20 AM',
    expandOnPhone: true,
  },
  {
    text: "That's great! Did you run into any difficulties applying it?",
    time: '9:30 AM · Read',
    outgoing: true,
    expandOnPhone: true,
  },
  {
    text: 'At first it was hard to concentrate, but it got easier with practice.',
    time: '10:00 AM',
    expandOnPhone: true,
  },
  { text: 'Can I start the new unit?', time: '10:30 AM' },
  { text: 'Yeah for sure', time: '9:30 AM · Read', outgoing: true, today: true },
]

export function Chats({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  return api ? <LiveChats api={api} navigate={navigate} /> : <DemoChats navigate={navigate} />
}

function DemoChats({ navigate }: { navigate: (path: string) => void }) {
  const initial = new URLSearchParams(window.location.search).get('state')
  const [selected, setSelected] = useState<string | null>(
    initial === 'empty' ||
      initial === 'list' ||
      (window.innerWidth <= 600 && initial !== 'thread' && initial !== 'offline')
      ? null
      : 'sara',
  )
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState<Record<string, ChatMessage[]>>({})
  const [read, setRead] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [compact, setCompact] = useState(window.innerWidth <= 600)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const offline = !online || initial === 'offline'
  const client = clients.find((item) => item.id === selected)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const resize = () => setCompact(window.innerWidth <= 600)
    window.addEventListener('resize', resize)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    const history = historyRef.current
    if (history) history.scrollTop = history.scrollHeight
  }, [selected])
  function send(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || !selected || offline) return
    const message = { text: draft.trim(), time: 'Just now · Demo', outgoing: true }
    setSent((current) => ({ ...current, [selected]: [...(current[selected] ?? []), message] }))
    setDraft('')
    setFeedback('Demo message added locally. No message was sent to a server.')
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'nearest' }))
  }
  const messages = client
    ? [
        ...(client.id === 'sara' ? saraMessages : [{ text: client.preview, time: client.time }]),
        ...(sent[client.id] ?? []),
      ]
    : []
  return (
    <Workspace
      title="Chats"
      active="Messages"
      navigate={navigate}
      offline={offline}
      onSearch={setQuery}
    >
      <div
        className={`chat-layout demo-chat-layout ${offline ? 'is-offline' : ''} ${client ? 'has-conversation' : 'no-conversation'}`}
      >
        <section className="chat-list" aria-label="Conversations">
          <label className="chat-search">
            <DesignIcon name="part2-03-imgSearch.svg" />
            <input
              aria-label="Search conversations"
              placeholder="Search..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {(!offline || client) && (
            <div className="response-promise list-promise">
              <DesignIcon name="part2-03-imgIcon1.svg" />
              <span>Committed to responding within 8 hours</span>
            </div>
          )}
          <div className="conversation-list">
            {clients
              .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((item) => (
                <button
                  key={item.id}
                  className={`conversation ${
                    selected === item.id || (!selected && compact && item.id === 'sara')
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => {
                    setSelected(item.id)
                    setDraft('')
                    setFeedback('')
                    setRead([...read, item.id])
                  }}
                >
                  <span className={`chat-avatar ${item.crop}`}>
                    <img src={asset(item.image)} alt="" />
                  </span>
                  <span className="conversation-copy">
                    <span>
                      <strong>{item.name}</strong>
                      <time>{item.time}</time>
                    </span>
                    <span>
                      <small>{sent[item.id]?.at(-1)?.text ?? item.preview}</small>
                      {item.unread > 0 && !read.includes(item.id) && <i>{item.unread}</i>}
                    </span>
                  </span>
                </button>
              ))}
            {!clients.some((item) =>
              item.name.toLowerCase().includes(query.trim().toLowerCase()),
            ) && <p className="empty-result">No conversations found</p>}
          </div>
        </section>
        {client ? (
          <section className="chat-thread" aria-label={`Conversation with ${client.name}`}>
            <header className="chat-thread-header">
              <button
                className="thread-back icon-button"
                aria-label="Back to conversations"
                onClick={() => {
                  setSelected(null)
                  setFeedback('')
                }}
              >
                <DesignIcon name="part2-06-imgIcon.svg" />
              </button>
              <span className={`chat-avatar ${client.crop}`}>
                <img src={asset(client.image)} alt="" />
              </span>
              <div>
                <strong>{client.name}</strong>
                <p>
                  <span className="desktop-concern">Generalized </span>anxiety disorder · Last seen
                  2 hours ago
                </p>
              </div>
            </header>
            <div className="message-history" ref={historyRef}>
              <div className="response-promise thread-promise">
                <DesignIcon name="part2-03-imgIcon1.svg" />
                <span>Committed to responding within 8 business hours (Sat–Thu, 9 AM–5 PM)</span>
              </div>
              <p className="message-date">Dec 9, 2025</p>
              {messages.map((message, index) => (
                <div
                  key={`${index}-${message.text}`}
                  className={`message-group ${message.outgoing ? 'outgoing' : ''} ${message.expandOnPhone ? 'reference-phone-wide' : ''}`}
                >
                  {message.today && <p className="message-date">Today</p>}
                  <p className="message-bubble">{message.text}</p>
                  <time>{message.time}</time>
                </div>
              ))}
              <div className="reply-reminder" ref={bottomRef}>
                <DesignIcon name="part2-03-imgIcon2.svg" />
                <span>New message from client · 2 hours ago — reply required within 6 hours</span>
              </div>
            </div>
            <form className="message-composer" onSubmit={send}>
              <button
                type="button"
                aria-label="Attach a file"
                disabled={offline}
                onClick={() => fileRef.current?.click()}
              >
                <DesignIcon name="part2-03-imgIcon3.svg" />
              </button>
              <input
                hidden
                ref={fileRef}
                type="file"
                aria-label="Message attachment"
                onChange={(event) =>
                  setFeedback(
                    event.target.files?.[0]
                      ? `Demo attachment selected: ${event.target.files[0].name}. No file was uploaded.`
                      : '',
                  )
                }
              />
              <textarea
                aria-label="Message"
                rows={1}
                placeholder={compact ? 'Type your message' : 'Type your message to the client...'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                disabled={offline}
              />
              <button type="submit" aria-label="Send message" disabled={!draft.trim() || offline}>
                <DesignIcon name="part2-03-imgIcon4.svg" />
              </button>
            </form>
            {feedback && (
              <p className="demo-feedback" role="status">
                {feedback}
              </p>
            )}
          </section>
        ) : (
          <section className="empty-conversation" aria-label="Select a conversation">
            <div>
              <span>
                <DesignIcon name="part2-20-imgMessageCircleLinesAlt1.svg" />
              </span>
              <h2 dir="rtl">اختر محادثة</h2>
              <p dir="rtl">اضغط على محادثة من القائمة لفتحها والرد على العميل</p>
            </div>
          </section>
        )}
      </div>
    </Workspace>
  )
}
