export type ApiUser = {
  id: string
  name: string
  email: string | null
  whatsapp_number: string
  role: string
  is_active: boolean
  phone_verified_at: string | null
  timezone: string
}

export type ApiSession = {
  user: ApiUser
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_at: string
  refresh_expires_at: string
}

export type LoginChallenge = {
  requires_2fa: true
  login_challenge: string
  challenge_expires_at: string
  request_reference: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly fields: Record<string, string[]> = {},
    public readonly retryAfter = 0,
  ) {
    super(
      status === 401
        ? 'Your session has ended. Please sign in again.'
        : status === 403
          ? 'This action is not permitted for your account.'
          : status === 404
            ? 'The requested record is unavailable.'
            : status === 409
              ? 'The request conflicts with the current server state. Refresh before retrying.'
              : status === 422
                ? 'Please check the submitted information.'
                : status === 429
                  ? 'Too many requests. Wait before trying again.'
                  : status === 413
                    ? 'The submitted content is too large.'
                    : status === 0
                      ? 'Unable to reach the server. Check your connection. The result may be unknown.'
                      : 'The server could not complete the request. Refresh before retrying.',
    )
    this.name = 'ApiError'
  }
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The request could not be completed.'
}

export function apiId(value: string): string {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value))
    throw new ApiError(404)
  return value
}

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

type RequestOptions = {
  body?: unknown
  signal?: AbortSignal
  public?: boolean
  idempotencyKey?: string
  binary?: boolean
}

function baseUrl(value: string): string {
  const url = new URL(value, window.location.origin)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.replace(/\/$/, '').endsWith('/api/v1')
  )
    throw new Error('API base must be an HTTPS /api/v1 URL (HTTP is allowed only on localhost).')
  return url.href.replace(/\/$/, '')
}

function validSession(value: ApiSession): boolean {
  return (
    !!value &&
    typeof value.access_token === 'string' &&
    !!value.access_token &&
    typeof value.refresh_token === 'string' &&
    value.refresh_token.length === 64 &&
    value.token_type === 'Bearer' &&
    Date.parse(value.expires_at) > Date.now() &&
    Date.parse(value.refresh_expires_at) > Date.now() &&
    !!value.user &&
    typeof value.user.id === 'string' &&
    value.user.role === 'therapist' &&
    value.user.is_active === true &&
    !!value.user.phone_verified_at
  )
}

export class ApiClient {
  private session: ApiSession | null = null
  private listeners = new Set<() => void>()
  private generation = 0
  private requests = new Set<AbortController>()
  private refreshing: Promise<void> | null = null
  private closing = false
  readonly base: string

  constructor(
    base = import.meta.env.VITE_API_BASE_URL || '/api/v1',
    private readonly transport = fetch,
  ) {
    this.base = baseUrl(base)
  }

  getUser = (): ApiUser | null => this.session?.user ?? null
  getSessionKey = (): number => this.generation
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private emit() {
    this.listeners.forEach((listener) => listener())
  }

  establish = async (session: ApiSession): Promise<void> => {
    if (!validSession(session)) {
      if (session?.access_token) {
        await this.raw('/auth/logout', 'POST', { public: true }, session.access_token).catch(
          () => undefined,
        )
      }
      throw new ApiError(403)
    }
    this.clear()
    const { id, name, email, whatsapp_number, role, is_active, phone_verified_at, timezone } =
      session.user
    this.session = {
      user: Object.freeze({
        id,
        name,
        email,
        whatsapp_number,
        role,
        is_active,
        phone_verified_at,
        timezone,
      }),
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type,
      expires_at: session.expires_at,
      refresh_expires_at: session.refresh_expires_at,
    }
    this.emit()
  }

  clear = (): void => {
    this.generation++
    this.session = null
    this.refreshing = null
    this.requests.forEach((controller) => controller.abort())
    this.requests.clear()
    this.emit()
  }

  async logout(all = false): Promise<void> {
    if (this.closing) return
    this.closing = true
    const generation = this.generation
    const originalToken = this.session?.access_token
    try {
      // Finish a rotation before selecting its replacement token; never clear a newer login.
      await this.refreshing?.catch(() => undefined)
      const token = generation === this.generation ? this.session?.access_token : originalToken
      if (generation === this.generation) this.clear()
      if (token)
        await this.raw(all ? '/auth/logout-all' : '/auth/logout', 'POST', { public: true }, token)
    } finally {
      this.closing = false
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing
    const session = this.session
    const generation = this.generation
    if (!session || this.closing || Date.parse(session.refresh_expires_at) <= Date.now()) {
      this.clear()
      throw new ApiError(401)
    }
    this.refreshing = (async () => {
      try {
        const tokens = await this.raw<Omit<ApiSession, 'user'>>('/auth/refresh', 'POST', {
          public: true,
          body: { refresh_token: session.refresh_token },
        })
        if (generation !== this.generation) throw new DOMException('Session changed', 'AbortError')
        const next = {
          user: session.user,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          expires_at: tokens.expires_at,
          refresh_expires_at: tokens.refresh_expires_at,
        }
        if (!validSession(next)) throw new ApiError(401)
        this.session = next
        this.emit()
      } catch (error) {
        if (generation === this.generation) this.clear()
        throw error
      }
    })()
    const pending = this.refreshing
    try {
      await pending
    } finally {
      if (this.refreshing === pending) this.refreshing = null
    }
  }

  async request<T>(path: string, method = 'GET', options: RequestOptions = {}): Promise<T> {
    if (!options.public) {
      const generation = this.generation
      if (!this.session || this.closing) throw new ApiError(401)
      if (Date.parse(this.session.expires_at) <= Date.now() + 15000) await this.refresh()
      if (generation !== this.generation) throw new DOMException('Session changed', 'AbortError')
      if (!this.session || this.closing) throw new ApiError(401)
    }
    return this.raw<T>(
      path,
      method,
      options,
      options.public ? undefined : this.session?.access_token,
    )
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, 'GET', { signal })
  }
  mutate<T>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, 'body'> = {},
    method = 'POST',
  ): Promise<T> {
    return this.request<T>(path, method, { ...options, body })
  }

  private async raw<T>(
    path: string,
    method: string,
    options: RequestOptions,
    token?: string,
  ): Promise<T> {
    const pathname = path.split('?')[0]
    const destination = new URL(this.base + path)
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      /[\\#]|\.\./.test(path) ||
      /%(?:2e|2f|5c|25)/i.test(pathname) ||
      destination.origin !== new URL(this.base).origin ||
      !destination.pathname.startsWith(new URL(this.base).pathname + '/')
    )
      throw new Error('Only API-relative paths are accepted.')
    const generation = this.generation
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) controller.abort()
    this.requests.add(controller)
    const timeout = setTimeout(() => controller.abort(), 25000)
    const assertCurrent = () => {
      if (controller.signal.aborted || (generation !== this.generation && !options.public))
        throw new DOMException('Request cancelled', 'AbortError')
    }
    try {
      assertCurrent()
      const headers = new Headers({ Accept: 'application/json' })
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
      const multipart = options.body instanceof FormData
      if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json')
      const response = await this.transport(this.base + path, {
        method,
        headers,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
        body:
          options.body === undefined
            ? undefined
            : multipart
              ? (options.body as FormData)
              : JSON.stringify(options.body),
      })
      assertCurrent()
      if (!response.ok) {
        if (response.status === 401 && token && !options.public) this.clear()
        // Never render server exception text or field-error contents, which can contain secrets.
        let keys: string[] = []
        if (response.status === 422) {
          const value = await response.json().catch(() => null)
          assertCurrent()
          if (value?.errors && typeof value.errors === 'object') keys = Object.keys(value.errors)
        }
        const retry = response.headers.get('Retry-After')
        const delay = retry
          ? /^\d+$/.test(retry)
            ? Number(retry)
            : Math.max(0, Math.ceil((Date.parse(retry) - Date.now()) / 1000))
          : 0
        throw new ApiError(
          response.status,
          Object.fromEntries(keys.map((key) => [key, ['Please check this field.']])),
          Number.isFinite(delay) ? delay : 0,
        )
      }
      if (options.binary) {
        const body = await response.blob()
        assertCurrent()
        return body as T
      }
      if (response.status === 204) return undefined as T
      if (!response.headers.get('Content-Type')?.includes('application/json'))
        throw new ApiError(502)
      const body = await response.json()
      assertCurrent()
      return body as T
    } catch (error) {
      if (
        error instanceof ApiError ||
        (error instanceof DOMException &&
          error.name === 'AbortError' &&
          (options.signal?.aborted || generation !== this.generation))
      )
        throw error
      throw new ApiError(0)
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
      this.requests.delete(controller)
    }
  }
}

export const api = new ApiClient()
