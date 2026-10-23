import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Auth, type AuthPage } from '../src/Auth'
import { ApiClient, type ApiSession } from '../src/api'

const phone = '+491234567890'
const proof = 'a'.repeat(64)

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function session(role = 'therapist'): ApiSession {
  return {
    user: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Invited Therapist',
      email: 'therapist@example.test',
      whatsapp_number: phone,
      role,
      is_active: true,
      phone_verified_at: '2026-01-01T00:00:00Z',
      timezone: 'UTC',
    },
    access_token: 'test-access-token',
    refresh_token: 'r'.repeat(64),
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
}

function challenge() {
  return {
    requires_2fa: true,
    login_challenge: proof,
    challenge_expires_at: new Date(Date.now() + 300000).toISOString(),
    request_reference: 'a1b2c3d4',
  }
}

function setup(page: AuthPage = 'login') {
  const transport = vi.fn<typeof fetch>()
  const api = new ApiClient('https://api.example.test/api/v1', transport)
  const navigate = vi.fn()
  const onCreateAccount = vi.fn()
  const view = render(
    <Auth
      page={page}
      api={api}
      navigate={navigate}
      verificationEmail="unused@example.test"
      onCreateAccount={onCreateAccount}
    />,
  )
  return { transport, api, navigate, onCreateAccount, ...view }
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function login(password = 'x') {
  fill('WhatsApp number', phone)
  fill('Password', password)
  fireEvent.click(screen.getByRole('button', { name: 'Login' }))
}

function newPassword(password = 'new password') {
  fill('New password', password)
  fill('Confirm password', password)
}

function expectPublicRequest(
  transport: ReturnType<typeof vi.fn<typeof fetch>>,
  index: number,
  path: string,
  body: unknown,
) {
  const [url, options] = transport.mock.calls[index]
  expect(url).toBe(`https://api.example.test/api/v1${path}`)
  expect(options?.method).toBe('POST')
  expect(JSON.parse(options?.body as string)).toEqual(body)
  expect(new Headers(options?.headers).get('Authorization')).toBeNull()
  expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
  expect(new Headers(options?.headers).get('Accept')).toBe('application/json')
  expect(options?.credentials).toBe('omit')
  expect(options?.signal).toBeInstanceOf(AbortSignal)
}

beforeEach(() => window.history.replaceState({}, '', '/login'))
afterEach(() => vi.useRealTimers())

describe('live authentication public API integration', () => {
  it('preserves the original no-api demo login behavior in its isolated component', () => {
    vi.useFakeTimers()
    const navigate = vi.fn()
    render(
      <Auth
        page="login"
        navigate={navigate}
        verificationEmail="demo@example.test"
        onCreateAccount={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    fill('Email Address', 'demo@example.test')
    fill('Password', 'password123')
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(navigate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(600))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard')
  })

  it('logs in with international WhatsApp and an untrimmed password, only after API success', async () => {
    const { transport, api, navigate } = setup()
    const persisted = vi.spyOn(Storage.prototype, 'setItem')
    const establish = vi.spyOn(api, 'establish')
    let resolve!: (value: Response) => void
    transport.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    fill('WhatsApp number', '0049 (123) 456-7890')
    fill('Password', ' x ')
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(navigate).not.toHaveBeenCalled()
    expect(api.getUser()).toBeNull()
    expectPublicRequest(transport, 0, '/auth/login', { whatsapp_number: phone, password: ' x ' })
    const issued = session()
    await act(async () =>
      resolve(json({ ...issued, user: { ...issued.user, patient: { safety_flag: true } } })),
    )
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard')
    expect(establish.mock.calls[0][0].user).not.toHaveProperty('patient')
    expect(api.getUser()?.role).toBe('therapist')
    expect(persisted).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('does not impose the new-password minimum on login and does reject local phone guessing', () => {
    const { transport } = setup()
    fill('WhatsApp number', '01234567890')
    fill('Password', 'x')
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('minlength')
    fill('WhatsApp number', phone)
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
    expect(transport).not.toHaveBeenCalled()
  })

  it('sanitizes failed login field errors without navigating or installing a session', async () => {
    const { transport, api, navigate } = setup()
    transport.mockResolvedValue(
      json(
        {
          message: 'raw database exception',
          errors: { whatsapp_number: ['private server detail'] },
        },
        422,
      ),
    )
    login()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please check the submitted information.',
    )
    expect(screen.getByText('Please check this field.')).toBeInTheDocument()
    expect(
      screen.queryByText(/raw database exception|private server detail/),
    ).not.toBeInTheDocument()
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('removes Google/demo bypasses and fails closed for a directly opened verification route', () => {
    const { transport, navigate } = setup('verify')
    expect(screen.getByText(/No sign-in challenge is available/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Google|Explore|Verify/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Sign up/ })).not.toBeInTheDocument()
    expect(transport).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['signup', 'activate'] as const)(
    'treats %s as invitation activation, never patient registration',
    async (page) => {
      const { transport, navigate, onCreateAccount } = setup(page)
      transport.mockResolvedValue(json(session()))
      expect(screen.getByRole('heading', { name: 'Activate your invitation' })).toBeInTheDocument()
      fill('WhatsApp number', phone)
      fill('Invitation code', 'abc12!34')
      newPassword(' new password ')
      expect(screen.getByRole('button', { name: 'Activate account' })).toBeDisabled()
      fill('Invitation code', 'abc1234')
      expect(screen.getByRole('button', { name: 'Activate account' })).toBeDisabled()
      fill('Invitation code', 'abc12345')
      fill('Confirm password', 'not matching')
      expect(screen.getByRole('button', { name: 'Activate account' })).toBeDisabled()
      fill('Confirm password', ' new password ')
      fireEvent.click(screen.getByRole('button', { name: 'Activate account' }))
      await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard'))
      expectPublicRequest(transport, 0, '/auth/activate', {
        whatsapp_number: phone,
        code: 'ABC12345',
        password: ' new password ',
        password_confirmation: ' new password ',
      })
      expect(onCreateAccount).not.toHaveBeenCalled()
      expect(transport).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Invitation code')).toHaveValue('')
      expect(screen.getByLabelText('New password')).toHaveValue('')
    },
  )

  it('supports direct /activate entry when the router supplies its login default', () => {
    window.history.replaceState({}, '', '/activate')
    setup('login')
    expect(screen.getByRole('heading', { name: 'Activate your invitation' })).toBeInTheDocument()
  })

  it('rejects staff activation sessions cleanly and never masquerades as a therapist', async () => {
    const { transport, api, navigate } = setup('activate')
    transport
      .mockResolvedValueOnce(json(session('admin')))
      .mockResolvedValueOnce(json({ message: 'Logged out.' }))
    fill('WhatsApp number', phone)
    fill('Invitation code', 'ABC12345')
    newPassword()
    fireEvent.click(screen.getByRole('button', { name: 'Activate account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not permitted for your account')
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expect(transport.mock.calls[1][0]).toBe('https://api.example.test/api/v1/auth/logout')
    expect(new Headers(transport.mock.calls[1][1]?.headers).get('Authorization')).toBe(
      'Bearer test-access-token',
    )
  })

  it('requests a generic WhatsApp reset, then sends code and both passwords together without auto-login', async () => {
    const { transport, api, navigate } = setup()
    const clear = vi.spyOn(api, 'clear')
    transport
      .mockResolvedValueOnce(json({ message: 'server content must not be rendered' }))
      .mockResolvedValueOnce(json({ message: 'Password updated successfully.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Forgot Password' }))
    fill('WhatsApp number', phone)
    fireEvent.click(screen.getByRole('button', { name: 'Request reset code' }))
    await screen.findByRole('heading', { name: 'Reset your password' })
    expectPublicRequest(transport, 0, '/auth/forgot-password', { whatsapp_number: phone })
    expect(screen.getByText(/If this number is registered/)).toBeInTheDocument()
    expect(screen.queryByText('server content must not be rendered')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
    fill('Reset code', '001234')
    newPassword('replacement password')
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await screen.findByRole('heading', { name: 'log in to Sakina' })
    expectPublicRequest(transport, 1, '/auth/reset-password', {
      whatsapp_number: phone,
      otp: '001234',
      password: 'replacement password',
      password_confirmation: 'replacement password',
    })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login')
    expect(api.getUser()).toBeNull()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('enforces six reset digits and minimum/confirmed new passwords on direct reset entry', async () => {
    window.history.replaceState({}, '', '/reset-password')
    const { transport, navigate } = setup('login')
    transport.mockResolvedValue(json({ errors: { otp: ['private reset error'] } }, 422))
    fill('WhatsApp number', phone)
    fill('Reset code', '01234')
    newPassword()
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
    fill('Reset code', '012345')
    newPassword('short')
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
    newPassword()
    fill('Confirm password', 'different password')
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled()
    fill('Confirm password', 'new password')
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    await screen.findByRole('alert')
    expect(screen.queryByText('private reset error')).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('binds six-digit leading-zero OTP verification and resend to the returned proof, reference and expiry', async () => {
    vi.useFakeTimers()
    const { transport, api, navigate } = setup()
    const issued = challenge()
    transport
      .mockResolvedValueOnce(json(issued))
      .mockResolvedValueOnce(
        json({ message: 'If a staff sign-in is pending, a new code has been sent.' }),
      )
      .mockResolvedValueOnce(json({ errors: { otp: ['sensitive provider details'] } }, 422))
    await act(async () => login('staff password'))
    expect(screen.getByRole('heading', { name: 'Verify your WhatsApp code' })).toBeInTheDocument()
    expect(screen.getByText(/Request reference: a1b2c3d4/)).toBeInTheDocument()
    expect(document.querySelector('time')).toHaveAttribute('datetime', issued.challenge_expires_at)
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
    fill('Verification code', '00123')
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
    await act(async () => vi.advanceTimersByTime(60000))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resend' })))
    expectPublicRequest(transport, 1, '/auth/login/2fa/resend', {
      whatsapp_number: phone,
      login_challenge: proof,
    })
    expect(document.querySelector('time')).toHaveAttribute('datetime', issued.challenge_expires_at)
    expect(screen.getByLabelText('Verification code')).toHaveValue('')
    fill('Verification code', '001234')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verify' })))
    expectPublicRequest(transport, 2, '/auth/login/2fa', {
      whatsapp_number: phone,
      otp: '001234',
      login_challenge: proof,
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Please check the submitted information.')
    expect(screen.queryByText('sensitive provider details')).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(api.getUser()).toBeNull()
  })

  it('does not accept a malformed challenge response or fall back to a local verification success', async () => {
    const { transport, api, navigate } = setup()
    transport.mockResolvedValue(json({ ...challenge(), login_challenge: 'missing-proof' }))
    login()
    await screen.findByRole('alert')
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('drops unusable staff proof on server challenge error and demands fresh password login', async () => {
    const { transport, navigate } = setup()
    transport
      .mockResolvedValueOnce(json(challenge()))
      .mockResolvedValueOnce(json({ errors: { login_challenge: ['raw proof detail'] } }, 422))
    login()
    await screen.findByLabelText('Verification code')
    fill('Verification code', '000123')
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await screen.findByLabelText('Password')
    expect(screen.getByText(/challenge is no longer usable/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('rejects successfully verified staff sessions and clears their consumed OTP instead of opening the therapist dashboard', async () => {
    const { transport, api, navigate } = setup()
    transport
      .mockResolvedValueOnce(json(challenge()))
      .mockResolvedValueOnce(json(session('admin')))
      .mockResolvedValueOnce(json({ message: 'Logged out.' }))
    login('staff password')
    await screen.findByLabelText('Verification code')
    fill('Verification code', '012345')
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not permitted for your account')
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expectPublicRequest(transport, 1, '/auth/login/2fa', {
      whatsapp_number: phone,
      otp: '012345',
      login_challenge: proof,
    })
  })

  it('expires staff challenge locally without extending it or sending a verification request', async () => {
    vi.useFakeTimers()
    const { transport, navigate } = setup()
    transport.mockResolvedValueOnce(json(challenge()))
    await act(async () => login())
    fill('Verification code', '123456')
    await act(async () => vi.advanceTimersByTime(300000))
    expect(screen.getByRole('heading', { name: 'log in to Sakina' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('challenge has expired')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('resends reset codes only through forgot-password and honors the phone cooldown', async () => {
    vi.useFakeTimers()
    const { transport } = setup('forgot-password')
    transport.mockImplementation(async () => json({ message: 'generic reset confirmation' }))
    fill('WhatsApp number', phone)
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Request reset code' })),
    )
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
    fill('Reset code', '001234')
    await act(async () => vi.advanceTimersByTime(60000))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resend' })))
    expectPublicRequest(transport, 1, '/auth/forgot-password', { whatsapp_number: phone })
    expect(screen.getByLabelText('Reset code')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
  })

  it('respects Retry-After without automatically retrying login', async () => {
    vi.useFakeTimers()
    const { transport } = setup()
    transport.mockResolvedValue(
      json({ message: 'internal throttling details' }, 429, { 'Retry-After': '5' }),
    )
    await act(async () => login())
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
    expect(screen.getByText('Try again in 5 seconds.')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it.each(['unmount', 'clear', 'cancel'] as const)(
    'prevents late login from restoring a session after %s and locks duplicate submissions',
    async (reason) => {
      const { transport, api, navigate, unmount } = setup()
      const establish = vi.spyOn(api, 'establish')
      let resolve!: (value: Response) => void
      transport.mockImplementation(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      )
      fill('WhatsApp number', phone)
      fill('Password', 'x')
      const form = screen.getByRole('button', { name: 'Login' }).closest('form')!
      fireEvent.submit(form)
      fireEvent.submit(form)
      expect(transport).toHaveBeenCalledTimes(1)
      const signal = transport.mock.calls[0][1]?.signal
      if (reason === 'unmount') unmount()
      else if (reason === 'clear') act(() => api.clear())
      else fireEvent.click(screen.getByRole('button', { name: 'Forgot Password' }))
      expect(signal?.aborted).toBe(true)
      await act(async () => resolve(json(session())))
      expect(establish).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
      expect(api.getUser()).toBeNull()
      if (reason === 'clear') expect(screen.getByLabelText('Password')).toHaveValue('')
    },
  )
})
