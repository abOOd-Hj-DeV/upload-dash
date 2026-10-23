import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, type ApiSession } from '../src/api'
import { ClientProfile } from '../src/ClientProfile'

const id = '22222222-2222-4222-8222-222222222222'
const actor = '11111111-1111-4111-8111-111111111111'
const session: ApiSession = {
  user: {
    id: actor, name: 'Actual therapist', email: null, whatsapp_number: '', role: 'therapist',
    is_active: true, phone_verified_at: '2025-01-01T00:00:00Z', timezone: 'Asia/Riyadh',
  },
  access_token: 'test-access', refresh_token: 'r'.repeat(64), token_type: 'Bearer',
  expires_at: '2099-01-01T00:00:00Z', refresh_expires_at: '2099-02-01T00:00:00Z',
}
const json = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200, headers: { 'Content-Type': 'application/json' },
})
async function harness(status = 'active', profileId = id) {
  const paths: string[] = []
  const writes: unknown[] = []
  const api = new ApiClient('https://api.example.test/api/v1', vi.fn(async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/api/v1', '')
    paths.push(path)
    if (init?.method === 'POST') {
      writes.push(JSON.parse(String(init.body)))
      return json({ success: true })
    }
    if (path === '/therapists/clients') return json({
      data: [{ id, full_name: 'Current client', age: 29, gender: 'female', language: 'ar', status, completed_sessions_count: 7 }],
      pagination: { current_page: 1, last_page: 1, total: 1 },
    })
    if (path.endsWith('/notes')) return json({
      notes: [{ id: 'note-1', body: 'Private observation', created_at: '2026-01-03T12:00:00Z' }],
      session_reports: [{ session_id: 'session-1', session_date: '2026-01-02', summary: 'Shared report' }],
    })
    return json({
      client: { id: profileId, full_name: 'Current client', age: 29, gender: 'female', language: 'ar' },
      clinical: { assessment_score: 11, safety_flag: false, compliance_level: 'high', latest_assessment: null },
      stats: { total_sessions: 9, completed: 7, cancelled: 2 }, sessions: [],
    })
  }) as typeof fetch)
  await api.establish(session)
  return { api, paths, writes }
}
beforeEach(() => {
  window.history.replaceState({}, '', `/clients/profile?id=${id}`)
})
describe('client profile contract and privacy', () => {
  it('rejects invalid route ids without requesting client records', async () => {
    const { api, paths } = await harness()
    window.history.replaceState({}, '', '/clients/profile?id=..%2Fother')
    render(<ClientProfile api={api} navigate={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Select a client')
    expect(paths.filter((path) => path.startsWith('/therapists/clients'))).toEqual([])
  })
  it('does not request current clinical information for a former client', async () => {
    const { api, paths } = await harness('past')
    render(<ClientProfile api={api} navigate={vi.fn()} />)
    await screen.findByText('Current clinical information is unavailable for a former client.')
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(paths).not.toContain(`/therapists/clients/${id}`)
    expect(paths).not.toContain(`/therapists/clients/${id}/notes`)
    expect(screen.queryByLabelText('New Note')).not.toBeInTheDocument()
  })
  it('shows only real server stats and keeps unsupported calls and booking disabled', async () => {
    const { api } = await harness()
    const navigate = vi.fn()
    render(<ClientProfile api={api} navigate={navigate} />)
    await screen.findByText('Assessment score')
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Progress charts and clinical conclusions are not supplied by the API.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Schedule$/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Contact patient' }))
    expect(navigate).toHaveBeenCalledWith(`/chats?client=${id}`)
  })
  it('separates private notes and patient-visible reports and validates the note length', async () => {
    const { api, paths, writes } = await harness()
    render(<ClientProfile api={api} navigate={vi.fn()} />)
    await screen.findByText('Assessment score')
    expect(paths).not.toContain(`/therapists/clients/${id}/notes`)
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
    await screen.findByText('Private observation')
    expect(screen.getByText('Private therapist note')).toBeInTheDocument()
    expect(screen.getByText('Session reports (patient-visible)')).toBeInTheDocument()
    expect(screen.getByText('Shared report')).toBeInTheDocument()
    const field = screen.getByLabelText('New Note')
    expect(field).toHaveAttribute('maxlength', '5000')
    fireEvent.change(field, { target: { value: 'ab' } })
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeDisabled()
    fireEvent.change(field, { target: { value: 'x'.repeat(5001) } })
    fireEvent.submit(field.closest('form')!)
    expect(writes).toEqual([])
    fireEvent.change(field, { target: { value: '  A valid private note  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }))
    await waitFor(() => expect(writes).toEqual([{ body: 'A valid private note' }]))
    await waitFor(() => expect(field).toHaveValue(''))
  })
  it('rejects mismatched server identity instead of displaying another client clinical data', async () => {
    const { api } = await harness('active', actor)
    render(<ClientProfile api={api} navigate={vi.fn()} />)
    await screen.findByText('The returned profile does not match this client.')
    expect(screen.queryByText('Assessment score')).not.toBeInTheDocument()
  })
})
