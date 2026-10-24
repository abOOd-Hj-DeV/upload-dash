import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError, type ApiSession } from '../src/api'

const base = 'https://api.example.test/api/v1'
function session(): ApiSession {
  return {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Test therapist',
      email: null,
      whatsapp_number: '+491234567890',
      role: 'therapist',
      is_active: true,
      phone_verified_at: '2026-01-01T00:00:00Z',
      timezone: 'UTC',
    },
    access_token: 'synthetic-access',
    refresh_token: 'r'.repeat(64),
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
}
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
afterEach(() => vi.useRealTimers())

describe('memory-only API transport security', () => {
  it.each([
    'http://api.example.test/api/v1',
    'https://user:password@example.test/api/v1',
    'https://example.test/api/v1?token=secret',
    'https://example.test/api/v1#fragment',
    'https://example.test/other',
  ])('rejects unsafe API base %s', (value) => {
    expect(() => new ApiClient(value)).toThrow(/API base/)
  })
  it('permits localhost HTTP for isolated development only', () => {
    expect(new ApiClient('http://127.0.0.1:8000/api/v1').base).toBe('http://127.0.0.1:8000/api/v1')
  })
  it.each([
    'https://evil.test/path',
    '//evil.test/path',
    '/../secret',
    '/%2e%2e/secret',
    '/%252e%252e/secret',
    '/safe%2f..%2fsecret',
    '/\\evil.test',
    '/profile#token',
  ])('rejects API escape %s before transport', async (path) => {
    const transport = vi.fn<typeof fetch>()
    const api = new ApiClient(base, transport)
    await api.establish(session())
    await expect(api.get(path)).rejects.toThrow(/API-relative/)
    expect(transport).not.toHaveBeenCalled()
  })
  it('requires a session on protected routes and sends no credentials on public routes', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true }))
    const api = new ApiClient(base, transport)
    await expect(api.get('/therapists/wallet')).rejects.toMatchObject({ status: 401 })
    expect(transport).not.toHaveBeenCalled()
    await api.request('/auth/login', 'POST', {
      public: true,
      body: { whatsapp_number: '+491234567890', password: 'synthetic' },
    })
    const [url, init] = transport.mock.calls[0]
    expect(String(url)).not.toContain('synthetic')
    expect(new Headers(init?.headers).get('Authorization')).toBeNull()
    expect(init).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
  })
  it('keeps tokens out of browser storage and sends bearer/idempotency headers only to the configured API', async () => {
    const persisted = vi.spyOn(Storage.prototype, 'setItem')
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true }))
    const api = new ApiClient(base, transport)
    await api.establish(session())
    await api.mutate(
      '/therapists/wallet/withdraw',
      { amount: 25 },
      { idempotencyKey: 'stable-test-key' },
    )
    expect(persisted).not.toHaveBeenCalled()
    const [url, init] = transport.mock.calls[0]
    expect(url).toBe(base + '/therapists/wallet/withdraw')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-access')
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('stable-test-key')
    api.clear()
    expect(api.getUser()).toBeNull()
  })
  it('leaves multipart boundaries to fetch and reads authenticated binary data', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('private file', { headers: { 'Content-Type': 'application/pdf' } }),
      )
    const api = new ApiClient(base, transport)
    await api.establish(session())
    const body = new FormData()
    body.append('message', 'Test')
    await api.mutate('/chat/11111111-1111-4111-8111-111111111111', body, { binary: true })
    expect(transport.mock.calls[0][1]?.body).toBe(body)
    expect(new Headers(transport.mock.calls[0][1]?.headers).has('Content-Type')).toBe(false)
  })
  it('keeps only allowlisted identity fields, independent of caller mutations and raw clinical relations', async () => {
    const issued = {
      ...session(),
      user: {
        ...session().user,
        patient: { assessment: 'synthetic private field' },
        roles: [{ name: 'internal metadata' }],
      },
    }
    const api = new ApiClient(base, vi.fn<typeof fetch>())
    await api.establish(issued)
    issued.user.name = 'Changed by caller'
    expect(api.getUser()?.name).toBe('Test therapist')
    expect(api.getUser()).not.toHaveProperty('patient')
    expect(api.getUser()).not.toHaveProperty('roles')
    expect(Object.isFrozen(api.getUser())).toBe(true)
  })
  it('never exposes server error messages or validation values', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json(
          { message: 'private SQL/password', errors: { amount: ['private payout details'] } },
          422,
        ),
      )
    const api = new ApiClient(base, transport)
    await api.establish(session())
    await expect(api.mutate('/therapists/wallet/withdraw', { amount: 25 })).rejects.toMatchObject({
      status: 422,
      fields: { amount: ['Please check this field.'] },
      message: 'Please check the submitted information.',
    })
  })
  it('honors numeric and HTTP-date Retry-After without exposing the response', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 429, { 'Retry-After': '45' }))
      .mockResolvedValueOnce(
        json({}, 503, { 'Retry-After': new Date(Date.now() + 30000).toUTCString() }),
      )
    const api = new ApiClient(base, transport)
    await api.establish(session())
    await expect(api.get('/notifications')).rejects.toMatchObject({ retryAfter: 45 })
    try {
      await api.get('/notifications')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).retryAfter).toBeGreaterThanOrEqual(29)
      expect((error as ApiError).retryAfter).toBeLessThanOrEqual(30)
    }
  })
  it('does not retry a mutation after 401 and clears the session', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({}, 401))
    const api = new ApiClient(base, transport)
    await api.establish(session())
    await expect(api.mutate('/therapists/wallet/withdraw', { amount: 25 })).rejects.toMatchObject({
      status: 401,
    })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(api.getUser()).toBeNull()
  })
  it('performs one refresh rotation for concurrent requests and uses the replacement access token', async () => {
    const refresh = deferred<Response>()
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation((url) =>
        String(url).endsWith('/auth/refresh')
          ? refresh.promise
          : Promise.resolve(json({ ok: true })),
      )
    const api = new ApiClient(base, transport)
    const issued = session()
    issued.expires_at = new Date(Date.now() + 1000).toISOString()
    await api.establish(issued)
    const first = api.get('/notifications')
    const second = api.get('/therapists/wallet')
    expect(transport).toHaveBeenCalledTimes(1)
    refresh.resolve(
      json({ ...session(), access_token: 'rotated-access', refresh_token: 's'.repeat(64) }),
    )
    await Promise.all([first, second])
    expect(transport).toHaveBeenCalledTimes(3)
    for (const [, init] of transport.mock.calls.slice(1))
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer rotated-access')
  })
  it('does not restore a cleared session when an old refresh resolves late', async () => {
    const refresh = deferred<Response>()
    const transport = vi.fn<typeof fetch>().mockReturnValue(refresh.promise)
    const api = new ApiClient(base, transport)
    const issued = session()
    issued.expires_at = new Date(Date.now() + 1000).toISOString()
    await api.establish(issued)
    const request = api.get('/notifications')
    api.clear()
    refresh.resolve(json(session()))
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(api.getUser()).toBeNull()
  })
  it('blocks data parsed after session clear even when a transport ignores AbortSignal', async () => {
    const body = deferred<unknown>()
    const response = json({})
    vi.spyOn(response, 'json').mockReturnValue(body.promise)
    const transport = vi.fn<typeof fetch>().mockResolvedValue(response)
    const api = new ApiClient(base, transport)
    await api.establish(session())
    const pending = api.get('/therapists/clients')
    await vi.waitFor(() => expect(response.json).toHaveBeenCalled())
    api.clear()
    body.resolve({ private: 'old client' })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('does not couple a new session rotation to a cancelled older refresh', async () => {
    const old = deferred<Response>()
    const current = deferred<Response>()
    let rotations = 0
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation((url) =>
        String(url).endsWith('/auth/refresh')
          ? ++rotations === 1
            ? old.promise
            : current.promise
          : Promise.resolve(json({ ok: true })),
      )
    const api = new ApiClient(base, transport)
    const issued = { ...session(), expires_at: new Date(Date.now() + 1000).toISOString() }
    await api.establish(issued)
    const stale = api.get('/notifications')
    const rejected = expect(stale).rejects.toMatchObject({ name: 'AbortError' })
    await api.establish(issued)
    const first = api.get('/notifications')
    expect(rotations).toBe(2)
    old.resolve(json(session()))
    await rejected
    const second = api.get('/therapists/wallet')
    expect(rotations).toBe(2)
    current.resolve(json({ ...session(), access_token: 'new-actor-access' }))
    await Promise.all([first, second])
    expect(
      transport.mock.calls
        .slice(2)
        .every(
          ([, init]) =>
            new Headers(init?.headers).get('Authorization') === 'Bearer new-actor-access',
        ),
    ).toBe(true)
  })
  it('does not dispatch an already aborted request', async () => {
    const transport = vi.fn<typeof fetch>()
    const api = new ApiClient(base, transport)
    await api.establish(session())
    const controller = new AbortController()
    controller.abort()
    await expect(api.get('/notifications', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(transport).not.toHaveBeenCalled()
  })
  it('revokes the rotated token on logout and leaves no local session on revocation failure', async () => {
    const refresh = deferred<Response>()
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation((url) =>
        String(url).endsWith('/auth/refresh') ? refresh.promise : Promise.resolve(json({}, 503)),
      )
    const api = new ApiClient(base, transport)
    const issued = session()
    issued.expires_at = new Date(Date.now() + 1000).toISOString()
    await api.establish(issued)
    const pending = api.get('/notifications').catch(() => undefined)
    const logout = api.logout()
    refresh.resolve(json({ ...session(), access_token: 'rotated-access' }))
    await expect(logout).rejects.toMatchObject({ status: 503 })
    await pending
    const revoke = transport.mock.calls.find(([url]) => String(url).endsWith('/auth/logout'))
    expect(new Headers(revoke?.[1]?.headers).get('Authorization')).toBe('Bearer rotated-access')
    expect(api.getUser()).toBeNull()
  })
})
