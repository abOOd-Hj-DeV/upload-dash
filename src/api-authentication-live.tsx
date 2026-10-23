import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ApiClient,
  ApiError,
  apiErrorMessage,
  apiId,
  type ApiSession,
  type LoginChallenge,
} from './api'
import type { AuthPage } from './Auth'
import { asset } from './assets'
import { Icon, Logo } from './ui'

type Phase = 'login' | 'activate' | 'forgot' | 'reset' | 'otp'
type Challenge = LoginChallenge & { phone: string }
type Operation = { controller: AbortController }
type AuthResponse = ApiSession | LoginChallenge

// Require an explicit international prefix; never infer a country from a local number.
function internationalPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '')
  if (!/^(?:\+|00)[1-9][0-9]{7,14}$/.test(compact)) return null
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact
}

function initialPhase(page: AuthPage): Phase {
  if (page === 'signup' || page === 'activate') return 'activate'
  if (page === 'forgot-password') return 'forgot'
  if (page === 'reset-password') return 'reset'
  return 'login'
}

export function LiveAuthentication({
  api,
  page,
  navigate,
}: {
  api: ApiClient
  page: AuthPage
  navigate: (path: string) => void
}) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(page))
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string[]>>({})
  const [notice, setNotice] = useState(
    new URLSearchParams(window.location.search).get('logout') === 'revocation-unknown'
      ? 'Signed out locally. Server revocation could not be confirmed; sign in and use sign out of all devices before leaving a shared device.'
      : page === 'verify'
        ? 'No sign-in challenge is available. Sign in with your password first.'
        : '',
  )
  const [resendUntil, setResendUntil] = useState(0)
  const [retryUntil, setRetryUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const operation = useRef<Operation | null>(null)
  const mounted = useRef(false)
  const establishing = useRef(false)
  const boundApi = useRef(api)

  function clearSecrets() {
    setPassword('')
    setConfirmation('')
    setActivationCode('')
    setOtp('')
    setChallenge(null)
    setVisible(false)
  }

  function cancel() {
    operation.current?.controller.abort()
    operation.current = null
    setBusy(false)
    clearSecrets()
    setFields({})
    setError('')
    setNotice('')
    setResendUntil(0)
  }

  useEffect(() => {
    mounted.current = true
    if (boundApi.current !== api) {
      boundApi.current = api
      setPassword('')
      setConfirmation('')
      setActivationCode('')
      setOtp('')
      setChallenge(null)
      setPhone('')
      setFields({})
      setError('')
      setNotice('')
      setVisible(false)
      setResendUntil(0)
      setRetryUntil(0)
      setBusy(false)
      setPhase(initialPhase(page))
    }
    const unsubscribe = api.subscribe(() => {
      // establish installs a validated session synchronously. All other session
      // changes (including logout while login is pending) invalidate this operation.
      if (establishing.current) return
      operation.current?.controller.abort()
      operation.current = null
      setBusy(false)
      setPassword('')
      setConfirmation('')
      setActivationCode('')
      setOtp('')
      setChallenge(null)
      setPhone('')
      setFields({})
      setError('')
      setNotice('')
      setVisible(false)
      setResendUntil(0)
      setPhase(initialPhase(page))
    })
    return () => {
      mounted.current = false
      operation.current?.controller.abort()
      operation.current = null
      unsubscribe()
    }
  }, [api, page])

  useEffect(() => {
    if (!challenge && !resendUntil && !retryUntil) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [challenge, resendUntil, retryUntil])

  useEffect(() => {
    if (challenge && Date.parse(challenge.challenge_expires_at) <= now) {
      operation.current?.controller.abort()
      operation.current = null
      setBusy(false)
      setChallenge(null)
      setOtp('')
      setPassword('')
      setConfirmation('')
      setPhase('login')
      setFields({})
      setError('This sign-in challenge has expired. Sign in with your password again.')
      setNotice('')
    }
  }, [challenge, now])

  async function run<T>(
    path: string,
    body: unknown,
    success: (response: T, current: () => boolean) => void | Promise<void>,
  ) {
    // The ref locks synchronously, before a render can disable the button.
    if (operation.current || Date.now() < retryUntil) return
    const pending: Operation = { controller: new AbortController() }
    operation.current = pending
    const current = () =>
      mounted.current && operation.current === pending && !pending.controller.signal.aborted
    setBusy(true)
    setError('')
    setFields({})
    setNotice('')
    try {
      const response = await api.request<T>(path, 'POST', {
        body,
        public: true,
        signal: pending.controller.signal,
      })
      if (!current()) return
      await success(response, current)
    } catch (failure) {
      if (!current()) return
      setError(apiErrorMessage(failure))
      if (failure instanceof ApiError) {
        // Render fixed copy by field key only; never echo field-error contents.
        setFields(failure.fields)
        if (failure.retryAfter > 0) {
          const deadline = Date.now() + failure.retryAfter * 1000
          setRetryUntil(deadline)
          setNow(Date.now())
        }
        if (Object.hasOwn(failure.fields, 'login_challenge')) {
          clearSecrets()
          setPhase('login')
          setNotice('The sign-in challenge is no longer usable. Sign in with your password again.')
        }
      }
    } finally {
      if (current()) {
        operation.current = null
        setBusy(false)
      }
    }
  }

  async function signIn(response: AuthResponse, current: () => boolean) {
    if (!current()) return
    clearSecrets()
    if ('requires_2fa' in response && response.requires_2fa === true) {
      if (
        typeof response.login_challenge !== 'string' ||
        !/^[A-Za-z0-9]{64}$/.test(response.login_challenge) ||
        typeof response.request_reference !== 'string' ||
        !/^[a-fA-F0-9]{8}$/.test(response.request_reference) ||
        typeof response.challenge_expires_at !== 'string' ||
        !(Date.parse(response.challenge_expires_at) > Date.now())
      )
        throw new ApiError(502)
      const normalized = internationalPhone(phone)
      if (!normalized) throw new ApiError(422)
      setChallenge({
        requires_2fa: true,
        login_challenge: response.login_challenge,
        challenge_expires_at: response.challenge_expires_at,
        request_reference: response.request_reference,
        phone: normalized,
      })
      setPhase('otp')
      setNow(Date.now())
      setResendUntil(Date.now() + 60000)
      return
    }
    if (phase === 'otp') setPhase('login')
    const supplied = response as ApiSession
    if (!supplied?.user || typeof supplied.user.id !== 'string') throw new ApiError(502)
    // Keep only documented identity fields: raw /auth user serialization can also
    // contain unrelated patient/clinical relations that must not enter this portal.
    const identity = supplied.user
    if (
      typeof identity.name !== 'string' ||
      (identity.email !== null && typeof identity.email !== 'string') ||
      typeof identity.whatsapp_number !== 'string' ||
      typeof identity.role !== 'string' ||
      typeof identity.is_active !== 'boolean' ||
      (identity.phone_verified_at !== null && typeof identity.phone_verified_at !== 'string') ||
      typeof identity.timezone !== 'string'
    )
      throw new ApiError(502)
    const accepted: ApiSession = {
      access_token: supplied.access_token,
      refresh_token: supplied.refresh_token,
      token_type: supplied.token_type,
      expires_at: supplied.expires_at,
      refresh_expires_at: supplied.refresh_expires_at,
      user: {
        id: apiId(identity.id),
        name: identity.name,
        email: identity.email,
        whatsapp_number: identity.whatsapp_number,
        role: identity.role,
        is_active: identity.is_active,
        phone_verified_at: identity.phone_verified_at,
        timezone: identity.timezone,
      },
    }
    // ApiClient rejects patient/staff/inactive/unverified sessions and attempts
    // to revoke their issued access token rather than treating them as therapists.
    establishing.current = true
    let established: Promise<void>
    try {
      established = api.establish(accepted)
    } finally {
      establishing.current = false
    }
    await established
    if (!current()) return
    clearSecrets()
    setPhone('')
    navigate('/dashboard')
  }

  const normalizedPhone = internationalPhone(phone)
  const newPasswordValid = password.length >= 8 && confirmation === password
  const otpValid = /^[0-9]{6}$/.test(otp)
  const challengeValid = !!challenge && Date.parse(challenge.challenge_expires_at) > now
  const valid =
    phase === 'otp'
      ? otpValid && challengeValid
      : !!normalizedPhone &&
        (phase === 'forgot' ||
          (phase === 'login'
            ? password.length > 0
            : newPasswordValid &&
              (phase === 'activate' ? /^[A-Za-z0-9]{8}$/.test(activationCode.trim()) : otpValid)))
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000))
  const resendSeconds = Math.max(0, Math.ceil((Math.max(resendUntil, retryUntil) - now) / 1000))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || operation.current || Date.now() < retryUntil) return
    if (phase === 'otp') {
      if (!challenge || Date.parse(challenge.challenge_expires_at) <= Date.now()) return
      void run<AuthResponse>(
        '/auth/login/2fa',
        { whatsapp_number: challenge.phone, otp, login_challenge: challenge.login_challenge },
        signIn,
      )
    } else if (phase === 'login') {
      void run<AuthResponse>('/auth/login', { whatsapp_number: normalizedPhone, password }, signIn)
    } else if (phase === 'activate') {
      void run<ApiSession>(
        '/auth/activate',
        {
          whatsapp_number: normalizedPhone,
          code: activationCode.trim().toUpperCase(),
          password,
          password_confirmation: confirmation,
        },
        signIn,
      )
    } else if (phase === 'forgot') {
      void run<{ message: string }>(
        '/auth/forgot-password',
        { whatsapp_number: normalizedPhone },
        () => {
          clearSecrets()
          setPhone(normalizedPhone ?? '')
          setPhase('reset')
          setNotice('If this number is registered, a reset code has been sent. Check WhatsApp.')
          setResendUntil(Date.now() + 60000)
          setNow(Date.now())
        },
      )
    } else {
      void run<{ message: string }>(
        '/auth/reset-password',
        {
          whatsapp_number: normalizedPhone,
          otp,
          password,
          password_confirmation: confirmation,
        },
        () => {
          clearSecrets()
          setPhone('')
          // Reset revokes all sessions. The resulting clear intentionally cancels
          // the old operation; reset never establishes or navigates to a dashboard.
          api.clear()
          setPhase('login')
          setNotice('Password updated successfully. Sign in with your new password.')
          navigate('/login')
        },
      )
    }
  }

  function resend() {
    if (operation.current || Date.now() < Math.max(resendUntil, retryUntil)) return
    if (phase === 'otp') {
      if (!challenge || Date.parse(challenge.challenge_expires_at) <= Date.now()) return
      void run<{ message: string }>(
        '/auth/login/2fa/resend',
        { whatsapp_number: challenge.phone, login_challenge: challenge.login_challenge },
        () => {
          setOtp('')
          setResendUntil(Date.now() + 60000)
          setNow(Date.now())
          setNotice('If a staff sign-in is pending, a new code has been sent. Check WhatsApp.')
        },
      )
    } else if (phase === 'reset' && normalizedPhone) {
      void run<{ message: string }>(
        '/auth/forgot-password',
        { whatsapp_number: normalizedPhone },
        () => {
          setOtp('')
          setResendUntil(Date.now() + 60000)
          setNow(Date.now())
          setNotice('If this number is registered, a reset code has been sent. Check WhatsApp.')
        },
      )
    }
  }

  function changePhase(next: Phase) {
    cancel()
    setPhase(next)
  }

  function fieldError(name: string) {
    return Object.hasOwn(fields, name) ? (
      <span className="live-auth-field-error" role="status">Please check this field.</span>
    ) : null
  }

  const title =
    phase === 'activate'
      ? 'Activate your invitation'
      : phase === 'forgot'
        ? 'Forgot your password?'
        : phase === 'reset'
          ? 'Reset your password'
          : phase === 'otp'
            ? 'Verify your WhatsApp code'
            : 'log in to Sakina'
  const action =
    phase === 'activate'
      ? 'Activate account'
      : phase === 'forgot'
        ? 'Request reset code'
        : phase === 'reset'
          ? 'Reset password'
          : phase === 'otp'
            ? 'Verify'
            : 'Login'

  return (
    <main className="auth-page visual-auth live-auth">
      <img className="auth-glow" src={asset('auth-imgEllipse1559.svg')} alt="" />
      <div className="auth-stack">
        <div className="auth-glass">
          <section className="auth-card" aria-labelledby="auth-heading">
            <header className="auth-heading">
              <Logo />
              <div>
                <h1 id="auth-heading">{title}</h1>
                <p>
                  {phase === 'activate'
                    ? 'Therapist accounts are invited by authorized management, not self-registered.'
                    : phase === 'otp'
                      ? 'Enter the six-digit code from WhatsApp for this sign-in request.'
                      : phase === 'reset'
                        ? 'Enter your six-digit WhatsApp reset code and your new password together.'
                        : 'Use your WhatsApp number with an explicit country code.'}
                </p>
              </div>
            </header>
            {phase === 'activate' && (
              <p className="live-auth-help">
                Invitations expire after 24 hours. If your invitation is missing or expired, contact
                authorized management for a replacement. Activation does not imply clinical
                approval.
              </p>
            )}
            {phase === 'otp' && challenge && (
              <div className="auth-notice live-auth-request">
                <p>{challenge.phone}</p>
                <p>Request reference: {challenge.request_reference}</p>
                <p>
                  Challenge expires at{' '}
                  <time dateTime={challenge.challenge_expires_at}>
                    {new Date(challenge.challenge_expires_at).toLocaleString()}
                  </time>
                  . Resending does not extend this expiry.
                </p>
              </div>
            )}
            <form onSubmit={submit} className="auth-form" aria-busy={busy}>
              {phase !== 'otp' && (
                <label>
                  WhatsApp number
                  <input
                    name="whatsapp_number"
                    type="tel"
                    autoComplete="tel"
                    aria-label="WhatsApp number"
                    aria-describedby="auth-phone-help"
                    placeholder="+491234567890"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={Object.hasOwn(fields, 'whatsapp_number')}
                    disabled={busy}
                    required
                  />
                  <span id="auth-phone-help" className="live-auth-help">
                    Include + or 00 and the country code; local numbers cannot be inferred.
                  </span>
                  {fieldError('whatsapp_number')}
                </label>
              )}
              {phase === 'activate' && (
                <label>
                  Invitation code
                  <input
                    name="code"
                    autoComplete="off"
                    value={activationCode}
                    onChange={(event) => setActivationCode(event.target.value)}
                    minLength={8}
                    maxLength={8}
                    pattern="[A-Za-z0-9]{8}"
                    placeholder="8 letters or digits"
                    aria-invalid={Object.hasOwn(fields, 'code')}
                    disabled={busy}
                    required
                  />
                  {fieldError('code')}
                </label>
              )}
              {(phase === 'otp' || phase === 'reset') && (
                <label>
                  {phase === 'reset' ? 'Reset code' : 'Verification code'}
                  <input
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    aria-invalid={Object.hasOwn(fields, 'otp')}
                    disabled={busy}
                    required
                  />
                  {fieldError('otp')}
                </label>
              )}
              {(phase === 'login' || phase === 'activate' || phase === 'reset') && (
                <label>
                  {phase === 'login' ? 'Password' : 'New password'}
                  <span className="password-field">
                    <input
                      name="password"
                      type={visible ? 'text' : 'password'}
                      autoComplete={phase === 'login' ? 'current-password' : 'new-password'}
                      minLength={phase === 'login' ? undefined : 8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-invalid={Object.hasOwn(fields, 'password')}
                      disabled={busy}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      <Icon name="auth-imgEye.svg" />
                    </button>
                  </span>
                  {fieldError('password')}
                </label>
              )}
              {(phase === 'activate' || phase === 'reset') && (
                <label>
                  Confirm password
                  <input
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    aria-invalid={Object.hasOwn(fields, 'password_confirmation')}
                    disabled={busy}
                    required
                  />
                  {fieldError('password_confirmation')}
                </label>
              )}
              {phase === 'login' && (
                <button type="button" className="forgot-link" onClick={() => changePhase('forgot')}>
                  Forgot Password
                </button>
              )}
              <button
                type="submit"
                className="primary-button"
                disabled={!valid || busy || retrySeconds > 0}
              >
                {busy ? 'Please wait…' : action}
              </button>
            </form>
            {error && <p className="live-auth-feedback" role="alert">{error}</p>}
            {retrySeconds > 0 && <p className="live-auth-feedback" role="status">Try again in {retrySeconds} seconds.</p>}
            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}
            {phase === 'reset' && (
              <p className="live-auth-help">Reset codes expire after five minutes. Request another if needed.</p>
            )}
          </section>
        </div>
        {(phase === 'otp' || phase === 'reset') && (
          <p className="auth-switch">
            Not receiving code?
            <button
              type="button"
              disabled={
                busy || resendSeconds > 0 || (phase === 'otp' ? !challengeValid : !normalizedPhone)
              }
              onClick={resend}
            >
              Resend
            </button>
            {resendSeconds > 0 && <span> Available in {resendSeconds} seconds.</span>}
          </p>
        )}
        <p className="auth-switch">
          {phase === 'login' ? (
            <>
              Have a management invitation?
              <a
                href="/activate"
                onClick={(event) => {
                  event.preventDefault()
                  cancel()
                  navigate('/activate')
                }}
              >
                Activate invitation
              </a>
            </>
          ) : (
            <button type="button" onClick={() => changePhase('login')}>
              Cancel and return to sign in
            </button>
          )}
        </p>
        <p className="auth-legal">
          This portal is for invited therapists. Google sign-in and public therapist registration
          are not available. Sign-in credentials are kept in memory only; reloading requires
          sign-in.
        </p>
      </div>
    </main>
  )
}
