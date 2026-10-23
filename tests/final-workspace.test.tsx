import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../src/api'
import { Workspace } from '../src/Workspace'

const styles = readFileSync('src/visual-workspace-closure.css', 'utf8')

beforeEach(() => {
  window.history.replaceState({}, '', '/profile/help')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('final Help phone shell', () => {
  it('keeps the source inline search honest and supplies accessible bottom navigation', async () => {
    const navigate = vi.fn()
    const { container } = render(
      <Workspace title="Profile" active="Profile" navigate={navigate}>Help content</Workspace>,
    )
    expect(container.querySelector('.workspace')).toHaveClass('profile-help-workspace')
    expect(screen.getByPlaceholderText('Search...')).toBeDisabled()
    expect(screen.getByPlaceholderText('Search...')).toHaveAccessibleName('Search unavailable')
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(7)
    expect(within(navigation).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(navigation).getByRole('button', { name: 'Wallet' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/wallet')
  })

  it('uses flexible inline search and hides only Help phone hamburger/search toggles', () => {
    const phoneStyles = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phoneStyles).toMatch(/\.profile-help-workspace :is\(\.secondary-mobile-menu, \.secondary-mobile-search\)\s*\{\s*display: none !important;/)
    expect(phoneStyles).toMatch(/\.profile-help-workspace \.secondary-search\s*\{[^}]*display: flex;[^}]*flex: 1;[^}]*min-width: 0;[^}]*width: auto;[^}]*position: static;/)
    expect(phoneStyles).toMatch(/\.profile-help-workspace \.secondary-actions\s*\{[^}]*min-width: 0;/)
    expect(phoneStyles).toMatch(/\.profile-help-workspace \.mobile-bottom-nav\s*\{\s*position: static;/)
  })

  it('keeps live Help search unavailable rather than inventing an API-backed operation', () => {
    render(
      <Workspace title="Profile" active="Profile" navigate={vi.fn()} api={new ApiClient('http://localhost/api/v1')}>
        Live help
      </Workspace>,
    )
    expect(screen.getByRole('textbox', { name: 'Search unavailable' })).toBeDisabled()
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
  })

  it.each(['/profile', '/profile/settings', '/profile/helpful'])('leaves %s shell behavior unchanged', (path) => {
    window.history.replaceState({}, '', path)
    const { container } = render(
      <Workspace title="Profile" active="Profile" navigate={vi.fn()}>Content</Workspace>,
    )
    expect(container.querySelector('.workspace')).not.toHaveClass('profile-help-workspace')
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument()
  })

  it('preserves other routes and working search callbacks', async () => {
    window.history.replaceState({}, '', '/sessions')
    const onSearch = vi.fn()
    const { container } = render(
      <Workspace title="Sessions" active="Sessions" navigate={vi.fn()} onSearch={onSearch}>Sessions</Workspace>,
    )
    expect(container.querySelector('.workspace')).not.toHaveClass('profile-help-workspace')
    await userEvent.type(screen.getByRole('textbox', { name: 'Search patients' }), 'Ali')
    expect(onSearch).toHaveBeenLastCalledWith('Ali')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument()
  })
})

describe('final wallet phone drawer', () => {
  it('uses the shorter overview reference without changing earnings or live drawer budgets', () => {
    const phoneStyles = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phoneStyles).toMatch(/\.wallet-workspace\.is-expanded:has\(\.wallet-demo\.wallet-overview\) \.sidebar\s*\{\s*height: 675px;/)
    expect(phoneStyles).not.toMatch(/\.wallet-live[^}]*height: 675px;/)
  })

  it('budgets the original 703px drawer with a smaller-viewport scroll fallback, not clipped content', () => {
    const phoneStyles = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phoneStyles).toMatch(/\.wallet-workspace\.is-expanded \.sidebar\s*\{[^}]*height: 703px;[^}]*max-height: 100svh;[^}]*overflow-y: auto;/)
    expect(phoneStyles).toMatch(/\.wallet-workspace\.is-expanded \.navigation\s*\{[^}]*padding-top: 12px;[^}]*gap: 2px;/)
    expect(phoneStyles).toMatch(/\.wallet-workspace\.is-expanded \.sidebar-footer\s*\{[^}]*padding-right: 8px;/)
    expect(phoneStyles).not.toMatch(/\.secondary-workspace\.is-expanded \.sidebar\s*\{/)
  })

  it('keeps drawer content, keyboard dismissal and route actions available', async () => {
    window.history.replaceState({}, '', '/wallet?state=expanded')
    const navigate = vi.fn()
    const { container } = render(
      <Workspace title="Wallet" active="Wallet" navigate={navigate}>Earnings</Workspace>,
    )
    const root = container.querySelector('.workspace')!
    expect(root).toHaveClass('wallet-workspace', 'is-expanded')
    const drawer = screen.getByRole('complementary', { name: 'Main navigation' })
    const reminder = drawer.querySelector<HTMLElement>('.client-reminder')!
    expect(within(reminder).getByRole('button', { name: 'Client review' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Open profile' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Wallet' })).toHaveAttribute('aria-current', 'page')
    expect(drawer.querySelector('.wallet-drawer-collapse')).toHaveAttribute('aria-hidden', 'true')
    await userEvent.keyboard('{Escape}')
    expect(root).not.toHaveClass('is-expanded')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Sessions' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/sessions')
  })

  it('does not add the wallet drawer variant to Sessions, Profile or Chats', () => {
    window.history.replaceState({}, '', '/sessions?state=expanded')
    const { container } = render(
      <Workspace title="Sessions" active="Sessions" navigate={vi.fn()}>Sessions</Workspace>,
    )
    expect(container.querySelector('.workspace')).not.toHaveClass('wallet-workspace')
    expect(container.querySelector('.wallet-drawer-collapse')).not.toBeInTheDocument()
  })
})

describe('final offline shell spacing', () => {
  it('restores the desktop offline Wallet warning at the 69px header boundary without moving other routes', () => {
    const desktopStyles = styles.slice(styles.indexOf('@media (min-width: 1101px)'), styles.indexOf('@media (min-width: 601px)'))
    expect(desktopStyles).toMatch(/\.wallet-workspace\.demo-workspace\.secondary-offline \.secondary-topbar\s*\{[^}]*height: 69px;[^}]*padding: 16px;/)
    expect(desktopStyles).not.toMatch(/\.remaining-workspace|\.secondary-workspace \.secondary-topbar/)
    window.history.replaceState({}, '', '/wallet?state=offline')
    const { container } = render(
      <Workspace title="Dashboard" active="Wallet" navigate={vi.fn()}>Wallet overview</Workspace>,
    )
    expect(container.querySelector('.workspace')).toHaveClass('wallet-workspace', 'demo-workspace', 'secondary-offline')
    expect(screen.getByRole('status')).toHaveTextContent("You're offline. Some data may not be up to date.")
    expect(screen.getByText('Wallet overview')).toBeInTheDocument()
  })
})
