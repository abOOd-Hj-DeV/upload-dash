import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { ApiClient, type ApiSession } from '../src/api'

const enabled =
  !!process.env.SAKINA_CONTRACT_API &&
  !!process.env.SAKINA_CONTRACT_FIXTURE &&
  !!process.env.SAKINA_CONTRACT_PASSWORD
describe.skipIf(!enabled)('opt-in HTTP contract against isolated Laravel fixtures', () => {
  const fixture = enabled
    ? (JSON.parse(readFileSync(process.env.SAKINA_CONTRACT_FIXTURE!, 'utf8')) as {
        phone: string
        therapist: string
        patient: string
        upcoming: string
        completed: string
      })
    : null
  const client = new ApiClient(process.env.SAKINA_CONTRACT_API || 'http://127.0.0.1:8000/api/v1')
  let originalBio: string | null = null
  afterAll(async () => {
    await client.logout().catch(() => undefined)
  })

  it('logs in via WhatsApp/password and validates the returned therapist identity', async () => {
    const issued = await client.mutate<ApiSession>(
      '/auth/login',
      {
        whatsapp_number: fixture!.phone,
        password: process.env.SAKINA_CONTRACT_PASSWORD,
      },
      { public: true },
    )
    await client.establish(issued)
    expect(client.getUser()?.id).toBe(fixture!.therapist)
    expect(client.getUser()?.role).toBe('therapist')
    const identity = await client.get<{ user: { id: string }; roles: string[] }>('/auth/user')
    expect(identity.user.id).toBe(fixture!.therapist)
    expect(identity.roles.includes('therapist')).toBe(true)
  })
  it('matches dashboard/profile/client/session pagination to the real response shapes', async () => {
    const dashboard = await client.get<{
      therapist: { id: string; bio: string | null }
      stats: { completed: number }
      timezone: string
    }>('/therapists/me/dashboard')
    expect(dashboard.therapist.id).toBe(fixture!.therapist)
    expect(dashboard.stats.completed).toBe(1)
    expect(dashboard.timezone).toBe('UTC')
    originalBio = dashboard.therapist.bio
    const clients = await client.get<{
      data: { id: string; status: string }[]
      pagination: { last_page: number }
    }>('/therapists/clients?per_page=100')
    expect(
      clients.data.some((item) => item.id === fixture!.patient && item.status === 'active'),
    ).toBe(true)
    expect(clients.pagination.last_page).toBe(1)
    const sessions = await client.get<{
      data: { id: string; starts_at: string }[]
      pagination: { total: number }
    }>('/therapists/me/sessions?per_page=50')
    expect(sessions.pagination.total).toBe(2)
    expect(sessions.data.some((item) => item.id === fixture!.upcoming && !!item.starts_at)).toBe(
      true,
    )
  })
  it('saves only supported therapist profile settings', async () => {
    const result = await client.mutate<{ data: { bio: string } }>(
      '/therapists/me/settings',
      { bio: 'Synthetic HTTP contract check' },
      {},
      'PUT',
    )
    expect(result.data.bio).toBe('Synthetic HTTP contract check')
    await client.mutate('/therapists/me/settings', { bio: originalBio }, {}, 'PUT')
  })
  it('matches real clinical read and private-note shapes without patient-visible report confusion', async () => {
    const detail = await client.get<{ session: { id: string; patient_id: string } }>(
      `/sessions/${fixture!.upcoming}`,
    )
    expect(detail.session.id).toBe(fixture!.upcoming)
    expect(detail.session.patient_id).toBe(fixture!.patient)
    const clientDetail = await client.get<{ client: { id: string }; clinical: object }>(
      `/therapists/clients/${fixture!.patient}`,
    )
    expect(clientDetail.client.id).toBe(fixture!.patient)
    const note = await client.mutate<{ note: { body: string } }>(
      `/therapists/clients/${fixture!.patient}/notes`,
      { body: 'Synthetic private note', session_id: fixture!.upcoming },
    )
    expect(note.note.body).toBe('Synthetic private note')
    const notes = await client.get<{ notes: { body: string }[]; session_reports: object[] }>(
      `/therapists/clients/${fixture!.patient}/notes`,
    )
    expect(notes.notes.some((item) => item.body === 'Synthetic private note')).toBe(true)
    const stranger = '00000000-0000-4000-8000-000000000000'
    await expect(client.get(`/therapists/clients/${stranger}`)).rejects.toMatchObject({
      status: 404,
    })
  })
  it('matches chat direct-object history and replays a send once with the same idempotency key', async () => {
    const key = crypto.randomUUID()
    const body = { content: 'Synthetic contract message' }
    const first = await client.mutate<{ data: { id: string; content: string } }>(
      `/chat/${fixture!.patient}`,
      body,
      { idempotencyKey: key },
    )
    const replay = await client.mutate<{ data: { id: string } }>(
      `/chat/${fixture!.patient}`,
      body,
      { idempotencyKey: key },
    )
    expect(first.data.content).toBe(body.content)
    expect(replay.data.id).toBe(first.data.id)
    const history = await client.get<{
      data: { id: string }[]
      conversation: { status: string }
      pagination: { last_page: number }
    }>(`/chat/${fixture!.patient}`)
    expect(history.data.filter((item) => item.id === first.data.id)).toHaveLength(1)
    expect(history.conversation.status).toBe('active')
    const list = await client.get<{ data: { counterpart_id: string }[] }>('/chat')
    expect(list.data.some((item) => item.counterpart_id === fixture!.patient)).toBe(true)
  })
  it('matches real content/blocked-period/notification pagination contracts', async () => {
    const content = await client.get<{ data: { data: object[]; last_page: number } }>(
      '/therapists/content',
    )
    expect(Array.isArray(content.data.data)).toBe(true)
    expect(content.data.last_page).toBe(1)
    const blocked = await client.get<{ data: object[] }>('/therapists/me/blocked-periods')
    expect(Array.isArray(blocked.data)).toBe(true)
    const notifications = await client.get<{
      data: object[]
      unread_count: number
      pagination: { last_page: number }
    }>('/notifications')
    expect(Array.isArray(notifications.data)).toBe(true)
    expect(Number.isInteger(notifications.unread_count)).toBe(true)
    expect(notifications.pagination.last_page).toBeGreaterThanOrEqual(1)
  })
  it('creates a manual-review withdrawal, replays once and observes server reservation', async () => {
    const before = await client.get<{ available: number; currency: string }>('/therapists/wallet')
    expect(before.available).toBe(200)
    const key = crypto.randomUUID()
    const body = {
      amount: 25,
      payout_details: {
        method: 'bank_transfer',
        account: 'SYNTHETIC-ONLY',
        holder_name: 'Synthetic Therapist',
      },
    }
    const first = await client.mutate<{
      withdrawal: { id: string; status: string; amount: number }
    }>('/therapists/wallet/withdraw', body, { idempotencyKey: key })
    expect(first.withdrawal.status).toBe('pending')
    expect(first.withdrawal.amount).toBe(25)
    const replay = await client.mutate<{ withdrawal: { id: string } }>(
      '/therapists/wallet/withdraw',
      body,
      { idempotencyKey: key },
    )
    expect(replay.withdrawal.id).toBe(first.withdrawal.id)
    const after = await client.get<{
      available: number
      reserved: number
      recent_withdrawals: { id: string }[]
    }>('/therapists/wallet')
    expect(after.available).toBe(175)
    expect(after.reserved).toBe(25)
    expect(after.recent_withdrawals.filter((item) => item.id === first.withdrawal.id)).toHaveLength(
      1,
    )
  })
  it('logs out remotely, clears the local session and denies further protected access', async () => {
    await client.logout()
    expect(client.getUser()).toBeNull()
    await expect(client.get('/therapists/wallet')).rejects.toMatchObject({ status: 401 })
  })
})
