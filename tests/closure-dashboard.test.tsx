import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'

const css = () => readFileSync('src/visual-dashboard-clients.css', 'utf8')
beforeEach(() => {
  window.history.replaceState({}, '', '/dashboard')
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false })
})

describe('dashboard final bounded source repairs', () => {
  it('keeps the full meeting URL selectable and wrapping without implying a live meeting', () => {
    window.history.replaceState({}, '', '/dashboard?state=meeting')
    render(<Dashboard navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const url = within(dialog).getByRole('textbox', { name: 'Meeting URL' })
    expect(url.tagName).toBe('TEXTAREA')
    expect(url).toHaveAttribute('readonly')
    expect(url).toHaveValue('https://meet.google.com/kxx-eyzx-dew?author=0')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Join meeting' }))
    expect(within(dialog).getByRole('status')).toHaveTextContent('Demo only: no live meeting service is connected.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps relative times inline with their subjects, source branding, unread cues and close actions', () => {
    window.history.replaceState({}, '', '/dashboard?state=notifications')
    render(<Dashboard navigate={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'Notifications' })
    expect(within(panel).getAllByRole('article')).toHaveLength(6)
    expect(within(panel).getAllByLabelText('Unread')).toHaveLength(2)
    for (const time of panel.querySelectorAll('time')) {
      expect(time.parentElement?.tagName).toBe('P')
    }
    expect(panel.querySelector('footer .brand-wordmark')).toHaveAttribute('alt', 'Sakina')
    expect(panel.querySelector('.demo-notification-3 .notification-system-avatar')).toBeInTheDocument()
    expect(css()).toMatch(/\.visual-demo-dashboard \.notifications-panel\s*\{\s*width: 434px;\s*top: 40px;\s*right: 38px;/)
    fireEvent.click(within(panel).getByRole('button', { name: 'Decline' }))
    expect(within(panel).getAllByRole('article')).toHaveLength(5)
    fireEvent.click(within(panel).getByRole('button', { name: 'Close notifications' }))
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveFocus()
  })

  it('keeps inline phone search functional after narrowing the field and dismisses on Escape', () => {
    window.history.replaceState({}, '', '/dashboard?state=search')
    render(<Dashboard navigate={vi.fn()} />)
    const field = screen.getByRole('textbox', { name: 'Search patients' })
    expect(within(screen.getByLabelText('Search results')).getAllByRole('button')).toHaveLength(2)
    fireEvent.change(field, { target: { value: 'Fahad' } })
    fireEvent.click(within(screen.getByLabelText('Search results')).getByRole('button', { name: 'Fahad Al Ali' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Fahad Al Ali')
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.focus(field)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('Search results')).not.toBeInTheDocument()
    expect(css()).toMatch(/\.search-open \.search-field\s*\{\s*display: flex;\s*position: static;\s*width: min\(132px, calc\(100vw - 236px\)\);/)
    expect(css()).toMatch(/\.visual-demo-dashboard:has\(\.search-open\) \.next-session\s*\{ align-self: center;/)
  })

  it('bounds the demo navigation drawer and keeps backdrop, Escape and route actions usable', () => {
    const navigate = vi.fn()
    window.history.replaceState({}, '', '/dashboard?state=expanded')
    render(<Dashboard navigate={navigate} />)
    const root = screen.getByRole('main').parentElement!
    expect(root).toHaveClass('is-expanded')
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(root).not.toHaveClass('is-expanded')
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(root).not.toHaveClass('is-expanded')
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Patients' }))
    expect(navigate).toHaveBeenCalledWith('/clients')
    expect(css()).toMatch(/\.visual-demo-dashboard\.is-expanded \.sidebar\s*\{\s*inset: 0 auto auto 0;\s*height: min\(675px, 100svh\);\s*min-height: 0;/)
    expect(css()).toMatch(/\.visual-demo-dashboard\.is-expanded \.sidebar-backdrop\s*\{\s*background: #0009;\s*backdrop-filter: blur\(6px\);/)
  })

  it('preserves offline truthfulness while restoring warning and outlined phone chip geometry', () => {
    window.history.replaceState({}, '', '/dashboard?state=offline')
    render(<Dashboard navigate={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline. Some data may not be up to date.')
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
    expect(css()).toMatch(/\.visual-demo-dashboard \.offline-banner\s*\{\s*font-size: 14px;\s*padding: 10px 12px;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.hero-rating > span\s*\{\s*padding: 8px 12px;\s*font-size: 14px;\s*line-height: 20px;\s*box-shadow: inset 0 0 0 1px #ffffff26;/)
  })

  it('bounds meeting centers independently of tall inventory heights, without changing desktop or shared modals', () => {
    expect(css()).toMatch(/\.visual-demo-dashboard \.dashboard-meeting-modal\s*\{\s*top: min\(50svh, 448px\);/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.dashboard-meeting-modal\s*\{\s*top: min\(50svh, 471px\);/)
    expect(css()).toMatch(/\.meeting-url textarea\s*\{\s*height: 36\.4px;\s*line-height: 18\.2px;/)
  })
})
