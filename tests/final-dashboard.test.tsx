import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'

const css = () => readFileSync('src/visual-dashboard-clients.css', 'utf8')

beforeEach(() => {
  window.history.replaceState({}, '', '/dashboard')
})

describe('dashboard closure notification flow', () => {
  it('gives inline desktop timestamps the source row width without changing unread rows', () => {
    window.history.replaceState({}, '', '/dashboard?state=notifications')
    render(<Dashboard navigate={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'Notifications' })
    const invite = within(panel).getAllByRole('article')[4]
    expect(invite.querySelector('.notification-title p time')).toHaveTextContent('25 min ago')
    expect(within(invite).getByRole('button', { name: 'Accept' })).toBeEnabled()
    expect(css()).toMatch(/@media \(min-width: 1101px\)\s*\{\s*\.visual-demo-dashboard \.notification-item:not\(:has\(\.demo-unread-dot\)\)\s*\{\s*padding-inline-end: 0;/)
    fireEvent.click(within(invite).getByRole('button', { name: 'Decline' }))
    expect(within(panel).getAllByRole('article')).toHaveLength(5)
    expect(panel.querySelector('footer')).toHaveTextContent('Powered by')
  })

  it('uses the narrower phone composition and keeps the footer reachable on short screens', () => {
    window.history.replaceState({}, '', '/dashboard?state=notifications')
    render(<Dashboard navigate={vi.fn()} />)
    const panel = screen.getByRole('region', { name: 'Notifications' })
    expect(within(panel).getAllByRole('article')).toHaveLength(6)
    expect(css()).toMatch(/\.visual-demo-dashboard \.notifications-panel\s*\{\s*right: 16px;\s*width: calc\(100% - 32px\);/)
    expect(css()).toMatch(/max-height: calc\(100svh - 78px\);/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.notifications-list\s*\{\s*min-height: 0;\s*max-height: none;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.notification-title p > :is\(span, strong\)\s*\{\s*display: inline-block;\s*max-width: 100%;/)
    fireEvent.click(within(panel).getByRole('button', { name: 'Close notifications' }))
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveFocus()
  })
})

describe('dashboard closure tablet statistics', () => {
  it('retains the source now line on the active-users card and stretches peer cards equally', () => {
    window.history.replaceState({}, '', '/dashboard?state=offline')
    render(<Dashboard navigate={vi.fn()} />)
    const metrics = screen.getByRole('region', { name: 'Practice statistics' })
    expect(within(metrics).getAllByRole('article')).toHaveLength(4)
    const active = within(metrics).getAllByRole('heading')[3]
    expect(active).toHaveTextContent('Active users now')
    expect(active.querySelector('.metric-current')).toHaveTextContent('now')
    expect(css()).toMatch(/\.visual-demo-dashboard \.metrics\s*\{\s*align-items: stretch;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.metric-data h2\s*\{\s*min-height: 40px;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.metric-current\s*\{\s*display: block;/)
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.')
  })
})

describe('dashboard closure phone vertical flow', () => {
  it.each(['', 'offline', 'search', 'notifications'])('keeps every session in natural table flow for %s', (state) => {
    window.history.replaceState({}, '', `/dashboard${state ? `?state=${state}` : ''}`)
    render(<Dashboard navigate={vi.fn()} />)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(8)
    const finalRow = within(table).getAllByRole('row')[7]
    expect(finalRow).toHaveTextContent('Fahad Al Ali')
    expect(finalRow).toHaveTextContent('Private Session')
    expect(finalRow).toHaveTextContent('20 Apr 2026, 13:30')
    expect(within(finalRow).getByRole('button', { name: /Fahad Al Ali/ })).toBeEnabled()
    expect(css()).toMatch(/\.visual-demo-dashboard \.topbar\s*\{\s*height: 60px;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.metric\s*\{\s*border: 0;\s*box-shadow: inset 0 0 0 1px var\(--border\);/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.next-session\s*\{\s*border: 0;\s*box-shadow: inset 0 0 0 1px #ffffff40;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.sessions-card \.patient-cell\s*\{\s*gap: 6px;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.sessions-card \.patient-name\s*\{\s*line-height: 16px;/)
    expect(css()).toMatch(/\.visual-demo-dashboard \.sessions-card td\s*\{\s*height: 80px;/)
    expect(css()).not.toMatch(/(?:zoom\s*:|scale\(\s*0\.|1911px|1979px)/)
  })
})
