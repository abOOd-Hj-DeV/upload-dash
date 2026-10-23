import { useEffect, useRef, useState } from 'react'
import { ApiClient, apiErrorMessage, apiId } from './api'
import { useApiUser } from './api-hooks'
import { asset } from './assets'
import {
  useChatConnectivity,
  useChatLifetime,
  useChatPolling,
} from './api-chat-and-notifications-polling'

type StoredNotification = {
  id: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string | null
}
type NotificationPage = {
  data: StoredNotification[]
  unread_count: number
  pagination: { current_page: number; last_page: number; total: number }
}
type Props = {
  api?: ApiClient
  navigate?: (path: string) => void
  onUnreadCount?: (count: number) => void
}
const LABELS: Record<string, string> = {
  chat_message_received: 'New care message',
  session_booked: 'Session booked',
  session_reminder: 'Session reminder',
  session_status_changed: 'Session status changed',
  reschedule_requested: 'Session reschedule requested',
  reschedule_approved: 'Session reschedule approved',
  reschedule_rejected: 'Session reschedule rejected',
  cancellation_requested: 'Session cancellation requested',
  cancellation_approved: 'Session cancellation approved',
  cancellation_rejected: 'Session cancellation rejected',
  assessment_completed: 'Assessment completed',
  red_flag_raised: 'Care flag raised',
  red_flag_priority_raised: 'Care flag priority raised',
  red_flag_escalated: 'Care flag escalated',
  payment_proof_pending: 'Payment proof pending',
  payment_review_overdue: 'Payment review overdue',
  payment_reviewed: 'Payment reviewed',
  therapist_approval: 'Therapist approval update',
  therapist_switch: 'Therapist assignment update',
  patient_transferred: 'Client transferred',
  document_requested: 'Document requested',
  document_submitted: 'Document submitted',
  document_reviewed: 'Document reviewed',
  session_recommendation: 'Session recommendation available',
  support_reply: 'Support reply available',
  parallel_layer_updated: 'Care plan updated',
  emergency_contact_requested: 'Emergency contact requested',
}
function notificationKind(item: StoredNotification) {
  return item.data && typeof item.data.kind === 'string' ? item.data.kind : ''
}
function destination(item: StoredNotification): string | null {
  const kind = notificationKind(item)
  if (kind === 'chat_message_received') {
    // conversation_id is NOT the counterpart route parameter.
    try {
      return typeof item.data.sender_id === 'string'
        ? `/chats?client=${apiId(item.data.sender_id)}`
        : null
    } catch {
      return null
    }
  }
  if (
    [
      'session_booked',
      'session_reminder',
      'session_status_changed',
      'reschedule_requested',
      'reschedule_approved',
      'reschedule_rejected',
      'cancellation_requested',
      'cancellation_approved',
      'cancellation_rejected',
      'session_recommendation',
    ].includes(kind)
  )
    return '/sessions'
  if (
    [
      'assessment_completed',
      'red_flag_raised',
      'red_flag_priority_raised',
      'red_flag_escalated',
      'therapist_switch',
      'patient_transferred',
      'parallel_layer_updated',
      'emergency_contact_requested',
    ].includes(kind)
  )
    return '/clients'
  if (
    kind === 'therapist_approval' ||
    ['document_requested', 'document_submitted', 'document_reviewed'].includes(kind)
  )
    return '/profile'
  if (kind === 'support_reply') return '/contact'
  // Staff payment review actions are deliberately not offered to a therapist.
  return null
}

// Drop-in replacement for Workspace's API notification body. The parent owns the
// panel shell/badge; this component never invents actions or renders stored notes.
export function LiveNotifications(props: Props) {
  return props.api ? <AuthenticatedNotifications {...props} api={props.api} /> : null
}
function AuthenticatedNotifications(props: Props & { api: ApiClient }) {
  const user = useApiUser(props.api)
  return user ? (
    <ActorNotifications key={props.api.getSessionKey()} {...props} />
  ) : (
    <p role="alert">Your session has ended. Please sign in again.</p>
  )
}
function ActorNotifications({ api, navigate, onUnreadCount }: Props & { api: ApiClient }) {
  const [page, setPage] = useState(1)
  const resource = useChatPolling<NotificationPage>(
    api,
    `/notifications?page=${page}&per_page=20`,
    30000,
  )
  const lifetime = useChatLifetime()
  const online = useChatConnectivity()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (resource.data) onUnreadCount?.(resource.data.unread_count)
  }, [resource.data, onUnreadCount])
  async function read(id?: string) {
    if (lock.current || !resource.canRequest() || !resource.data) return
    lock.current = true
    setBusy(true)
    setError('')
    const controller = new AbortController()
    lifetime.current.controllers.add(controller)
    try {
      await api.mutate(
        id ? `/notifications/${apiId(id)}/read` : '/notifications/read-all',
        undefined,
        { signal: controller.signal },
      )
      if (!lifetime.current.alive || controller.signal.aborted) return
      // Read is not delete, and unread_count is not returned by these mutations.
      resource.reload()
    } catch (failure) {
      if (lifetime.current.alive && !controller.signal.aborted) {
        resource.defer(failure)
        setError(apiErrorMessage(failure))
      }
    } finally {
      lifetime.current.controllers.delete(controller)
      lock.current = false
      if (lifetime.current.alive && !controller.signal.aborted) setBusy(false)
    }
  }
  return (
    <div className="live-notifications">
      {resource.loading && <p role="status">Loading notifications…</p>}
      {(error || resource.error) && (
        <p role="alert">
          {error || apiErrorMessage(resource.error)}{' '}
          <button disabled={!!resource.retryAt || !online} onClick={resource.reload}>
            Refresh notifications
          </button>
        </p>
      )}
      {!!resource.retryAt && <p role="status">Waiting before retrying the server.</p>}
      {resource.data && (
        <>
          <p className="notification-count">{resource.data.unread_count} unread notifications</p>
          <button
            className="soft-button notification-mark-all"
            disabled={busy || !online || !!resource.retryAt || !resource.data.unread_count}
            onClick={() => void read()}
          >
            Mark all read
          </button>
          {resource.data.data.length === 0 && <p>No notifications.</p>}
          {resource.data.data.map((item) => {
            const route = destination(item)
            const created =
              item.created_at && Number.isFinite(Date.parse(item.created_at))
                ? new Date(item.created_at).toLocaleString()
                : ''
            return (
              <article
                key={item.id}
                className={`notification-item ${item.read_at ? 'is-read' : 'is-unread'}`}
              >
                <span className="notification-kind-icon" aria-hidden="true">
                  <img
                    src={asset(
                      notificationKind(item) === 'chat_message_received'
                        ? 'part2-03-imgMessageCircleLinesAlt.svg'
                        : 'dashboard-imgNotification.svg',
                    )}
                    alt=""
                  />
                </span>
                <div className="notification-body">
                  <div className="notification-title">
                    <strong>
                      {Object.hasOwn(LABELS, notificationKind(item))
                        ? LABELS[notificationKind(item)]
                        : 'Account update'}
                    </strong>
                    <time dateTime={item.created_at && created ? item.created_at : undefined}>
                      {created}
                    </time>
                  </div>
                  <p>Open the relevant page to view currently authorized information.</p>
                  <span className="notification-read-state">{item.read_at ? 'Read' : 'Unread'}</span>
                  <div className="notification-actions">
                    <button
                      disabled={busy || !online || !!resource.retryAt || !!item.read_at}
                      onClick={() => void read(item.id)}
                    >
                      {item.read_at ? 'Read' : 'Mark read'}
                    </button>
                    {route && navigate && (
                      <button
                        onClick={() => {
                          navigate(route)
                          // pushState alone does not notify an already mounted chat page.
                          if (route.startsWith('/chats?'))
                            window.dispatchEvent(new PopStateEvent('popstate'))
                        }}
                      >
                        {notificationKind(item) === 'chat_message_received'
                          ? 'Open conversation'
                          : 'Open relevant page'}
                      </button>
                    )}
                  </div>
                </div>
                {!item.read_at && <span className="notification-unread-dot" aria-hidden="true" />}
              </article>
            )
          })}
          <nav aria-label="Notification pages">
            <button
              disabled={page <= 1 || resource.loading || busy || !!resource.retryAt}
              onClick={() => setPage(page - 1)}
            >
              Previous notifications
            </button>
            <span>
              Page {page} of {resource.data.pagination.last_page}
            </span>
            <button
              disabled={
                page >= resource.data.pagination.last_page ||
                resource.loading ||
                busy ||
                !!resource.retryAt
              }
              onClick={() => setPage(page + 1)}
            >
              Next notifications
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
