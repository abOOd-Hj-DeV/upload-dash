import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { DemoNetworkToggle, nextOfflineSearch } from '../src/DemoNetworkToggle'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/dashboard')
  setOnline(true)
})

describe('offline URL helper', () => {
  it('sets only state=offline and keeps other parameters', () => {
    expect(nextOfflineSearch('', true)).toEqual({ search: '?state=offline', previousState: null })
    expect(nextOfflineSearch('?density=compact&tab=notes', true).search).toBe(
      '?density=compact&tab=notes&state=offline',
    )
    expect(nextOfflineSearch('?state=collapsed&tab=notes', true)).toEqual({
      search: '?state=offline&tab=notes',
      previousState: 'collapsed',
    })
  })

  it('restores the prior design state or removes offline when going back online', () => {
    expect(nextOfflineSearch('?state=offline&tab=notes', false, 'collapsed').search).toBe(
      '?state=collapsed&tab=notes',
    )
    expect(nextOfflineSearch('?tab=notes&state=offline', false).search).toBe('?tab=notes')
    expect(nextOfflineSearch('?state=offline', false).search).toBe('')
    expect(nextOfflineSearch('?state=search', false).search).toBe('?state=search')
  })
})

describe('DemoNetworkToggle', () => {
  it('renders nothing in live mode and renders in production demo deployments', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const { container, rerender } = render(<DemoNetworkToggle />)
    expect(container).toBeEmptyDOMElement()
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.stubEnv('DEV', false)
    rerender(<DemoNetworkToggle key="production" />)
    expect(container).not.toBeEmptyDOMElement()
  })

  it('toggles ?state=offline through history with aria-pressed and notifies routing', async () => {
    const user = userEvent.setup()
    const onPopState = vi.fn()
    window.addEventListener('popstate', onPopState)
    window.history.replaceState({}, '', '/wallet?tab=x#top')
    render(<DemoNetworkToggle />)
    const toggle = screen.getByRole('button', { name: 'Simulate offline' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAccessibleDescription(/Network requests are not changed/)
    const length = window.history.length
    await user.click(toggle)
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/wallet?tab=x&state=offline#top',
    )
    expect(window.history.length).toBe(length + 1)
    expect(onPopState).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back online' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Back online' }))
    expect(window.location.search).toBe('?tab=x')
    window.removeEventListener('popstate', onPopState)
  })

  it('is operable from the keyboard and restores a previous design state', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/sessions?state=collapsed')
    render(<DemoNetworkToggle />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Simulate offline' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(window.location.search).toBe('?state=offline')
    expect(screen.getByRole('button', { name: 'Back online' })).toHaveFocus()
    await user.keyboard(' ')
    expect(window.location.search).toBe('?state=collapsed')
  })

  it('follows browser back/forward navigation', async () => {
    const user = userEvent.setup()
    render(<DemoNetworkToggle />)
    await user.click(screen.getByRole('button', { name: 'Simulate offline' }))
    act(() => {
      window.history.replaceState({}, '', '/dashboard')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByRole('button', { name: 'Simulate offline' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('never claims to restore a real offline browser connection', () => {
    setOnline(false)
    render(<DemoNetworkToggle />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Browser is offline')
    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByRole('button', { name: 'Simulate offline' })).toBeInTheDocument()
  })

  it.each(['/dashboard', '/chats', '/clients', '/profile', '/wallet'])(
    'switches the existing offline presentation of %s without remounting',
    async (route) => {
      const user = userEvent.setup()
      window.history.replaceState({}, '', route)
      // The shells (DemoDashboard and Workspace) render the toggle themselves.
      render(<App />)
      const offlineText = /You.re offline\. Some data may not be up to date\./
      expect(screen.queryByText(offlineText)).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Simulate offline' }))
      await waitFor(() => expect(screen.getAllByText(offlineText).length).toBeGreaterThan(0))
      expect(window.location.pathname).toBe(route)
      await user.click(screen.getByRole('button', { name: 'Back online' }))
      await waitFor(() => expect(screen.queryByText(offlineText)).not.toBeInTheDocument())
    },
  )

  it('keeps the floating pill compact, above content layers and clear of phone navigation', () => {
    const css = readFileSync('src/visual-r4-network-toggle.css', 'utf8')
    expect(css).toMatch(/\.demo-network-toggle\s*\{[^}]*position:\s*fixed;[^}]*height:\s*32px;/)
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/)
    expect(css).toMatch(/body:has\(\.mobile-bottom-nav\) \.demo-network-toggle\s*\{[^}]*bottom:\s*calc\(84px/)
  })
})
