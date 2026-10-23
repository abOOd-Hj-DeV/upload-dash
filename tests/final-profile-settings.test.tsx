import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Profile } from '../src/Profile'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const css = readFileSync('src/visual-profile-closure.css', 'utf8')

function show(state = '') {
  window.history.replaceState({}, '', `/profile/settings${state ? `?state=${state}` : ''}`)
  const navigate = vi.fn()
  const result = render(<Profile page="settings" navigate={navigate} />)
  return { ...result, navigate }
}

beforeEach(() => window.history.replaceState({}, '', '/profile/settings'))

describe('final profile settings repairs (DOM and CSS contracts, not UI acceptance)', () => {
  it('removes switch margins that inflated row pitch while retaining conventional checked states and local save/cancel', () => {
    show('preferences')
    const dialog = within(screen.getByRole('dialog', { name: 'Notification Settings' }))
    expect(dialog.getAllByRole('switch')).toHaveLength(5)
    const payment = dialog.getByRole('switch', { name: 'Payment & withdrawal notifications' })
    expect(payment.previousElementSibling).toHaveTextContent('Payment & withdrawal notifications')
    expect(payment).toBeChecked()
    fireEvent.click(payment)
    expect(payment).not.toBeChecked()
    fireEvent.click(dialog.getByRole('button', { name: 'Save Preferences' }))
    expect(screen.getByRole('status')).toHaveTextContent('Notification preferences saved locally for this demo. No backend is connected.')
    fireEvent.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(screen.getByRole('switch', { name: 'Payment & withdrawal notifications' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('switch', { name: 'Payment & withdrawal notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(screen.getByRole('switch', { name: 'Payment & withdrawal notifications' })).not.toBeChecked()
    expect(css).toMatch(/\.preferences-list input\[role='switch'\]\s*\{\s*margin: 0;/)
    expect(css).toMatch(/\.remaining-modal\.preferences-modal \.preferences-list label\s*\{\s*gap: 8px;/)
    expect(css).toMatch(/@media \(min-width: 1101px\)[\s\S]*?\.remaining-modal\.preferences-modal\s*\{\s*inset-inline-start: -72px;/)
    expect(css).toMatch(/\.remaining-modal\.preferences-modal \.modal-heading\s*\{\s*margin-bottom: 24px;/)
    expect(css).toMatch(/\.remaining-modal\.preferences-modal \.remaining-form-actions\s*\{\s*margin-top: 24px;/)
  })

  it('fits the confirmation using text metrics without removing or clipping the separate local-only notice', () => {
    const { navigate } = show('logout')
    const element = screen.getByRole('dialog', { name: 'Log out' })
    const dialog = within(element)
    expect(element.querySelectorAll(':scope > p')).toHaveLength(2)
    expect(dialog.getByText('Are you sure you want to log out of your account?')).toBeInTheDocument()
    expect(dialog.getByText('Demo only: no authenticated server session exists.')).toBeInTheDocument()
    expect(css).toMatch(/\.remaining-modal\.logout-modal > p:first-of-type\s*\{[^}]*font: 400 14px\/20px Arimo, Arial, sans-serif;[^}]*letter-spacing: -0.25px;/)
    expect(css).not.toMatch(/\.remaining-modal\.logout-modal[^}]*overflow:\s*hidden/)
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Log Out' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Log out' }))
    expect(navigate).toHaveBeenCalledWith('/login')
  })

  it('anchors the seven-day demo editor without converting native time inputs or permitting backwards intervals', () => {
    show('hours')
    const element = screen.getByRole('dialog', { name: 'Work Hours Management' })
    const dialog = within(element)
    expect(dialog.getAllByRole('checkbox')).toHaveLength(7)
    expect(dialog.getByRole('checkbox', { name: 'Friday' })).not.toBeChecked()
    expect(element.querySelectorAll('input[type="time"]')).toHaveLength(12)
    expect(css).toMatch(/\.remaining-modal\.hours-modal\s*\{\s*inset-inline-start: -84px;/)
    expect(css).toMatch(/\.remaining-modal\.hours-modal:has\(\.demo-hours-list\)\s*\{[^}]*width: 348px;[^}]*max-width: calc\(100vw - 22px\);[^}]*max-height: calc\(100svh - 48px\);[^}]*inset-block: 32px auto;[^}]*margin-block: 0;/)
    expect(css).toMatch(/\.hours-modal \.demo-hours-list input\[type='checkbox'\]\s*\{\s*margin: 0;/)
    fireEvent.change(dialog.getByLabelText('Saturday start time'), { target: { value: '17:00' } })
    fireEvent.change(dialog.getByLabelText('Saturday end time'), { target: { value: '09:00' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Preferences' }))
    expect(dialog.getByRole('alert')).toHaveTextContent('Enter an end time after the start time for Saturday.')
    fireEvent.change(dialog.getByLabelText('Saturday end time'), { target: { value: '18:00' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Preferences' }))
    expect(screen.getByRole('status')).toHaveTextContent('Working hours saved locally for this demo')
    fireEvent.click(screen.getByRole('button', { name: /Manage Working Hours/ }))
    expect(screen.getByLabelText('Saturday start time')).toHaveValue('17:00')
    expect(screen.getByLabelText('Saturday end time')).toHaveValue('18:00')
  })

  it('centers only the settings summary on phones and gives Job Title its own narrower editable field', () => {
    show('edit')
    const element = screen.getByRole('dialog', { name: 'Edit Profile' })
    const dialog = within(element)
    expect(document.querySelector('.profile-settings .profile-counts')).toHaveTextContent('89Clients45Sessions')
    expect(css).toMatch(/\.profile-settings \.profile-summary \.profile-counts > div\s*\{\s*align-items: center;\s*text-align: center;/)
    const title = dialog.getByRole('textbox', { name: 'Job Title' })
    expect(title.closest('label')).toHaveClass('profile-field-title')
    expect(css).toMatch(/\.remaining-modal\.edit-modal \.profile-field-title\s*\{\s*width: min\(100%, 256px\);/)
    expect(css).toMatch(/\.remaining-modal\.edit-modal \.remaining-field\s*\{\s*line-height: 20px;\s*margin-bottom: 12px;/)
    expect(dialog.getByLabelText('Mobile Number')).toHaveAttribute('type', 'tel')
    expect(dialog.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect((dialog.getByLabelText('General View') as HTMLTextAreaElement).value).toContain('Eight years of experience')
    fireEvent.change(title, { target: { value: '   ' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }))
    expect(dialog.getByRole('alert')).toHaveTextContent('Complete all profile fields')
    fireEvent.change(title, { target: { value: '  Updated title  ' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('status')).toHaveTextContent('Profile updated locally for this demo')
    expect(screen.getByText(/Updated title, Anxiety/)).toBeInTheDocument()
  })

  it('keeps native modal cancellation wired to dismissal', () => {
    show('edit')
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('provides both requested help labels inside one honest, non-submitting demo action', () => {
    render(<Profile page="help" navigate={vi.fn()} />)
    const desktop = screen.getByText('Give Me A Call')
    const compact = screen.getByText('Start Live Chat')
    expect(desktop).toHaveClass('help-desktop-call')
    expect(compact).toHaveClass('help-compact-chat')
    expect(desktop.closest('button')).toBe(compact.closest('button'))
    fireEvent.click(compact)
    expect(screen.getByRole('status')).toHaveTextContent('Demo only: live chat and phone support are not connected.')
  })
})
