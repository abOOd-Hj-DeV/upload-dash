import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workspace } from '../src/Workspace'
import { ApiClient } from '../src/api'
import { Auth, type AuthPage } from '../src/Auth'
import { readFileSync } from 'node:fs'

const repairStyles = readFileSync('src/visual-auth-shell.css', 'utf8')

beforeEach(() => window.history.replaceState({}, '', '/login'))

const style = document.createElement('style')
beforeEach(() => {
  style.textContent = repairStyles
  document.head.append(style)
})
afterEach(() => style.remove())

function shell(active: 'Clients' | 'Messages' | 'Profile', live = true) {
  const navigate = vi.fn()
  const api = live ? new ApiClient('https://api.example.test/api/v1', vi.fn()) : undefined
  const view = render(
    <Workspace active={active} title={active} navigate={navigate} api={api}>
      <p>Supported page content</p>
    </Workspace>,
  )
  return { navigate, ...view }
}

function sidebar() {
  return within(screen.getByRole('complementary', { name: 'Main navigation' }))
}

function liveAuth(page: AuthPage = 'login') {
  const transport = vi.fn<typeof fetch>()
  const api = new ApiClient('https://api.example.test/api/v1', transport)
  const view = render(<Auth page={page} api={api} navigate={vi.fn()} verificationEmail="unused@example.test" onCreateAccount={vi.fn()} />)
  return { transport, ...view }
}

describe('live auth responsive styling contracts (not a rendered pixel comparison)', () => {
  it.each(['login', 'activate', 'forgot-password', 'reset-password'] as AuthPage[])(
    'wraps required copy in %s without inheriting demo signup geometry',
    (page) => {
      const { container } = liveAuth(page)
      const root = container.querySelector('main')!
      expect(root).toHaveClass('live-auth')
      expect(root).not.toHaveClass('signup-page')
      const subtitle = container.querySelector('.auth-heading p')!
      expect(getComputedStyle(subtitle).whiteSpace).toBe('normal')
      expect(getComputedStyle(subtitle).overflowWrap).toBe('anywhere')
      expect(getComputedStyle(container.querySelector('.auth-switch')!).flexWrap).toBe('wrap')
      expect(getComputedStyle(screen.getByText(/local numbers cannot be inferred/)).fontSize).toBe('12px')
      expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
      expect(screen.getByText(/credentials are kept in memory only/)).toBeInTheDocument()
    },
  )

  it('retains a six-digit proof-bound WhatsApp challenge and wraps request metadata', async () => {
    const { transport, container } = liveAuth()
    transport.mockResolvedValueOnce(new Response(JSON.stringify({
      requires_2fa: true,
      login_challenge: 'a'.repeat(64),
      challenge_expires_at: new Date(Date.now() + 300000).toISOString(),
      request_reference: 'a1b2c3d4',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '+491234567890' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'untrimmed password ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    const code = await screen.findByLabelText('Verification code')
    expect(code).toHaveAttribute('maxLength', '6')
    expect(code).toHaveAttribute('pattern', '[0-9]{6}')
    const request = container.querySelector('.live-auth-request')!
    expect(request).toHaveTextContent('Request reference: a1b2c3d4')
    expect(request).toHaveTextContent('Resending does not extend this expiry.')
    expect(getComputedStyle(request).overflowWrap).toBe('anywhere')
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
  })

  it('keeps direct verification unavailable without a server challenge', () => {
    liveAuth('verify')
    expect(screen.getByRole('status')).toHaveTextContent('No sign-in challenge is available.')
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument()
  })
})

describe('cached R1 auth and R2 shell declarations (not pixel verification)', () => {
  it('does not apply the cached grain alpha twice or change live form padding', () => {
    expect(repairStyles).toMatch(/\.auth-page\.visual-auth::before\s*\{[^}]*opacity:\s*1;/)
    expect(repairStyles).toMatch(/\.auth-page\.visual-auth\.demo-auth\s*\{[^}]*padding-inline:\s*2px;/)
    expect(repairStyles).toMatch(/\.auth-page\.visual-auth\.demo-auth \.auth-card\s*\{[^}]*padding:\s*15px;/)
  })

  it.each(['login', 'signup'] as AuthPage[])('groups %s controls with the original outer CTA spacing', (page) => {
    const navigate = vi.fn()
    const { container } = render(
      <Auth page={page} navigate={navigate} verificationEmail="demo@example.test" onCreateAccount={vi.fn()} />,
    )
    const root = container.querySelector('main')!
    const card = container.querySelector('.auth-card')!
    const content = container.querySelector('.auth-card-content')!
    const intro = container.querySelector('.auth-intro')!
    const form = container.querySelector('.auth-form')!
    const cta = screen.getByRole('button', { name: page === 'signup' ? 'Create' : 'Login' })
    expect(card.children[0]).toBe(content)
    expect(card.children[1]).toBe(cta)
    expect(content.children[0]).toBe(intro)
    expect(content.children[2]).toBe(form)
    expect(cta).toHaveAttribute('form', 'demo-auth-form')
    expect(getComputedStyle(intro).gap).toBe('20px')
    expect(getComputedStyle(card).gap).toBe(page === 'login' ? '24px' : '')
    if (page === 'signup') {
      expect(root).toHaveClass('signup-page')
      expect(getComputedStyle(container.querySelector('.name-fields')!).gridTemplateColumns).toBe('minmax(0, 1fr)')
      expect(getComputedStyle(container.querySelector('.auth-heading h1')!).fontFamily).toContain('Inter')
      expect(getComputedStyle(content).gap).toBe('20px')
    } else {
      expect(getComputedStyle(content).gap).toBe('16px')
      expect(getComputedStyle(container.querySelector('.forgot-link')!).fontWeight).toBe('600')
      expect(getComputedStyle(cta).textTransform).toBe('lowercase')
      expect(getComputedStyle(container.querySelector('.auth-legal')!).width).toBe('345px')
    }
    expect(getComputedStyle(container.querySelector('.brand-symbol')!).borderWidth).toBe('0px')
  })

  it('uses Inter for the R2 chat sidebar without changing the R3 profile sidebar', () => {
    const { unmount, container } = shell('Messages')
    expect(getComputedStyle(container.querySelector('.nav-item')!).fontFamily).toContain('Inter')
    unmount()
    const profile = shell('Profile')
    expect(getComputedStyle(profile.container.querySelector('.nav-item')!).fontFamily).not.toContain('Inter')
  })
})

describe('visual auth-shell route semantics', () => {
  it('keeps Patients as the label and selects it for the supported live Clients route', () => {
    const { navigate } = shell('Clients')
    const patients = sidebar().getByRole('button', { name: 'Patients' })
    expect(patients).toHaveClass('active')
    expect(patients).toHaveAttribute('aria-current', 'page')
    fireEvent.click(patients)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/clients')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('selects Messages consistently in the sidebar and mobile navigation, never Patients', () => {
    const { navigate } = shell('Messages')
    expect(sidebar().getByRole('button', { name: 'Patients' })).not.toHaveClass('active')
    expect(sidebar().getByRole('button', { name: 'Messages' })).toHaveClass('active')
    const mobile = within(screen.getByRole('navigation', { name: 'Mobile navigation' }))
    expect(mobile.getByRole('button', { name: 'Messages' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(mobile.getByRole('button', { name: 'Patients' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/clients')
  })

  it('selects the actual Profile control without falsely selecting Patients', () => {
    shell('Profile')
    expect(sidebar().getByRole('button', { name: 'Patients' })).not.toHaveClass('active')
    expect(sidebar().getByRole('button', { name: 'Patients' })).not.toHaveAttribute('aria-current')
    expect(sidebar().getByRole('button', { name: 'Open profile' })).toHaveClass('active')
    expect(sidebar().getByRole('button', { name: 'Open profile' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not invent a demo patient list or fake live search', () => {
    const { navigate } = shell('Profile', false)
    expect(screen.getByRole('textbox', { name: 'Search unavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open search' })).toBeDisabled()
    fireEvent.click(sidebar().getByRole('button', { name: 'Patients' }))
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('No backend is connected.')
  })

  it('keeps supported search callbacks operational', () => {
    const onSearch = vi.fn()
    render(<Workspace active="Messages" title="Chats" navigate={vi.fn()} onSearch={onSearch}><p>Chats</p></Workspace>)
    const search = screen.getByRole('textbox', { name: 'Search patients' })
    expect(search).toBeEnabled()
    fireEvent.change(search, { target: { value: 'assigned client' } })
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('assigned client')
  })
})
