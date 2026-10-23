import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'

function open(path: string) {
  window.history.replaceState({}, '', path)
  return render(<App />)
}
function dialog() {
  return within(screen.getByRole('dialog'))
}
beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/profile')
  vi.restoreAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

describe('profile and settings', () => {
  it('renders the profile details and provided fixtures', () => {
    open('/profile?state=constructor')
    expect(screen.getByRole('heading', { name: 'Ahmed Mohamed' })).toBeInTheDocument()
    expect(screen.getAllByText('PSY-2024-1234')).toHaveLength(2)
    expect(screen.getByText('dr.khaled@example.com')).toBeInTheDocument()
  })
  it('navigates between the profile, settings and help routes', async () => {
    const user = userEvent.setup()
    open('/profile')
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/profile/settings')
    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(window.location.pathname).toBe('/profile/help')
    expect(screen.getByText('Need help so fast?')).toBeInTheDocument()
  })
  it('discards cancelled profile edits', async () => {
    const user = userEvent.setup()
    open('/profile')
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
    await user.clear(dialog().getByLabelText('Name'))
    await user.type(dialog().getByLabelText('Name'), 'Changed name')
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Ahmed Mohamed' })).toBeInTheDocument()
  })
  it('applies validated profile edits locally', async () => {
    const user = userEvent.setup()
    open('/profile?state=edit')
    await user.clear(dialog().getByLabelText('Name'))
    await user.type(dialog().getByLabelText('Name'), 'Dr. Sara')
    await user.click(dialog().getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('heading', { name: 'Dr. Sara' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No backend is connected')
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Profile' }))
    expect(screen.getByRole('heading', { name: 'Dr. Sara' })).toBeInTheDocument()
  })
  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=password')
    await user.type(dialog().getByLabelText('Current Password'), 'old-password')
    await user.type(dialog().getByLabelText('New Password'), 'new-password')
    await user.type(dialog().getByLabelText('Confirm New Password'), 'different-password')
    await user.click(dialog().getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('alert')).toHaveTextContent('must match')
  })
  it('does not claim to change a real password', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=password')
    await user.type(dialog().getByLabelText('Current Password'), 'old-password')
    await user.type(dialog().getByLabelText('New Password'), 'new-password')
    await user.type(dialog().getByLabelText('Confirm New Password'), 'new-password')
    await user.click(dialog().getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('status')).toHaveTextContent('password has not been changed')
  })
  it('saves preferences but discards cancelled changes', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=preferences')
    await user.click(dialog().getByRole('switch', { name: 'New client messages' }))
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(dialog().getByRole('switch', { name: 'New client messages' })).toBeChecked()
    await user.click(dialog().getByRole('switch', { name: 'New client messages' }))
    await user.click(dialog().getByRole('button', { name: 'Save Preferences' }))
    await user.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(dialog().getByRole('switch', { name: 'New client messages' })).not.toBeChecked()
  })
  it('rejects a working-hours end before the start', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=hours')
    fireEvent.change(dialog().getByLabelText('Saturday start time'), { target: { value: '17:00' } })
    fireEvent.change(dialog().getByLabelText('Saturday end time'), { target: { value: '09:00' } })
    await user.click(dialog().getByRole('button', { name: 'Save Preferences' }))
    expect(screen.getByRole('alert')).toHaveTextContent('after the start')
  })
  it('updates the working-day count after local save', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=hours')
    await user.click(dialog().getByRole('checkbox', { name: 'Saturday' }))
    await user.click(dialog().getByRole('button', { name: 'Save Preferences' }))
    expect(screen.getByRole('button', { name: /Manage Working Hours/ })).toHaveTextContent('5 days')
  })
  it('adds and removes local holidays', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=holidays')
    await user.type(dialog().getByLabelText('Reason'), 'Travel')
    fireEvent.change(dialog().getByLabelText('From'), { target: { value: '2026-11-01' } })
    fireEvent.change(dialog().getByLabelText('To'), { target: { value: '2026-11-05' } })
    await user.click(dialog().getByRole('button', { name: 'Add Holiday' }))
    expect(dialog().getByText('Travel')).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Remove Travel' }))
    expect(dialog().queryByText('Travel')).not.toBeInTheDocument()
  })
  it('renders FAQ content with disclosure controls', async () => {
    const user = userEvent.setup()
    open('/profile/help?state=faq')
    expect(dialog().getByText(/From the Clients page/)).toBeInTheDocument()
    await user.click(dialog().getByText('How are my earnings calculated?'))
    expect(
      dialog()
        .getByText(/Demo guidance: the Wallet/)
        .closest('details'),
    ).toHaveAttribute('open')
  })
  it('validates support fields without pretending to send email', async () => {
    const user = userEvent.setup()
    open('/profile/help?state=contact')
    await user.type(dialog().getByLabelText('Subject'), 'Help')
    await user.type(dialog().getByLabelText('Message'), 'Please help me')
    await user.click(dialog().getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('status')).toHaveTextContent('message was not sent')
  })
  it('supports cancel and confirm for frontend logout', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=logout')
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(window.location.pathname).toBe('/profile/settings')
    await user.click(screen.getByRole('button', { name: 'Log Out' }))
    await user.click(dialog().getByRole('button', { name: 'Log out' }))
    expect(window.location.pathname).toBe('/login')
  })
})

describe('wallet and integration', () => {
  it('renders overview, earnings and withdrawals', async () => {
    const user = userEvent.setup()
    open('/wallet')
    expect(screen.getByRole('img', { name: /Monthly earnings: January/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Earnings' }))
    expect(screen.getByText('Sarah Ali')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Withdrawals' }))
    expect(screen.getAllByText('SA** **** **** 1234 · 2024-05-01')).toHaveLength(6)
  })
  it('previews Shamcash without moving money', async () => {
    const user = userEvent.setup()
    open('/wallet?state=shamcash')
    await user.type(dialog().getByLabelText('Withdrawal amount'), '750')
    await user.type(dialog().getByLabelText('Shamcash Code'), 'demo-code')
    await user.click(dialog().getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status')).toHaveTextContent('750 SP via Shamcash')
    expect(screen.getByRole('status')).toHaveTextContent('no money was moved')
  })
  it('enforces withdrawal amount limits', () => {
    open('/wallet?state=shamcash')
    const amount = dialog().getByLabelText('Withdrawal amount') as HTMLInputElement
    fireEvent.change(amount, { target: { value: '499' } })
    expect(amount.validity.rangeUnderflow).toBe(true)
    fireEvent.change(amount, { target: { value: '12501' } })
    expect(amount.validity.rangeOverflow).toBe(true)
  })
  it('switches method-specific payment fields', async () => {
    const user = userEvent.setup()
    open('/wallet?state=shamcash')
    await user.selectOptions(dialog().getByLabelText('Select payment method'), 'haram')
    expect(dialog().queryByLabelText('Shamcash Code')).not.toBeInTheDocument()
    await user.type(dialog().getByLabelText('Full name'), 'Demo User')
    await user.type(dialog().getByLabelText('Phone number'), '+963 999')
    await user.type(dialog().getByLabelText('Location'), 'Damascus')
    await user.type(dialog().getByLabelText('Withdrawal amount'), '1000')
    await user.click(dialog().getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status')).toHaveTextContent('via Al-Haram')
  })
  it('shows offline feedback on new routes', () => {
    open('/wallet')
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    fireEvent(window, new Event('offline'))
    expect(screen.getByText(/You.re offline/)).toBeInTheDocument()
    online.mockReturnValue(true)
    fireEvent(window, new Event('online'))
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
  })
  it('opens wallet from the original dashboard', async () => {
    const user = userEvent.setup()
    open('/dashboard')
    await user.click(
      within(screen.getByRole('complementary', { name: 'Main navigation' })).getByRole('button', {
        name: 'Wallet',
      }),
    )
    expect(window.location.pathname).toBe('/wallet')
    expect(screen.getByRole('region', { name: 'Wallet details' })).toBeInTheDocument()
  })
  it('opens the supplied profile from the chat workspace', async () => {
    const user = userEvent.setup()
    open('/chats')
    await user.click(screen.getByRole('button', { name: 'Open profile' }))
    expect(window.location.pathname).toBe('/profile')
    expect(screen.getByRole('heading', { name: 'Ahmed Mohamed' })).toBeInTheDocument()
  })
})
