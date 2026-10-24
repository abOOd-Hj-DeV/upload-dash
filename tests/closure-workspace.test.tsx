import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ApiClient } from '../src/api'
import { Workspace } from '../src/Workspace'

beforeEach(() => {
  window.history.replaceState({}, '', '/chats')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('workspace offline presentation and connectivity', () => {
  it('scopes source offline dimming to demo content and leaves the warning vivid', () => {
    const { container, rerender } = render(<Workspace title="Chats" active="Messages" offline navigate={vi.fn()}>Content</Workspace>)
    expect(container.querySelector('.workspace')).toHaveClass('demo-workspace', 'secondary-offline')
    const styles = readFileSync('src/visual-workspace-closure.css', 'utf8')
    const rule = styles.match(/\.secondary-workspace\.demo-workspace\.secondary-offline :is\(([^)]+)\)\s*\{([^}]+)\}/)
    expect(rule?.[1]).toContain('.chat-layout')
    expect(rule?.[1]).toContain('.profile-layout')
    expect(rule?.[1]).toContain('.wallet-layout')
    expect(rule?.[1]).not.toContain('banner')
    expect(rule?.[2]).toMatch(/opacity:\s*\.5;/)
    rerender(<Workspace title="Chats" active="Messages" offline api={new ApiClient('http://localhost/api/v1')} navigate={vi.fn()}>Content</Workspace>)
    expect(container.querySelector('.workspace')).not.toHaveClass('demo-workspace')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('budgets desktop/tablet rails to the viewport with scrollable overflow rather than hiding the footer', () => {
    const styles = readFileSync('src/visual-workspace-closure.css', 'utf8')
    const desktop = styles.slice(styles.indexOf('@media (min-width: 601px)'))
    expect(desktop).toMatch(/\.secondary-workspace \.sidebar\s*\{[^}]*height:\s*100svh;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/)
    expect(desktop).toMatch(/secondary-offline:has\(\.profile-layout\) \.secondary-topbar\s*\{[^}]*height:\s*69px;/)
  })

  it('uses an accessible text status and decorative 18px wifi-slash, not a warning glyph', () => {
    render(<Workspace title="Chats" active="Messages" offline navigate={vi.fn()}>Content</Workspace>)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent("You're offline. Some data may not be up to date.")
    expect(banner).not.toHaveTextContent('⚠')
    expect(banner.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(banner.querySelector('svg')).toHaveAttribute('width', '18')
    expect(banner.querySelector('svg')).toHaveAttribute('height', '18')
  })

  it('responds to actual browser connection changes without hiding page content', () => {
    render(<Workspace title="Chats" active="Messages" navigate={vi.fn()}>Content</Workspace>)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
