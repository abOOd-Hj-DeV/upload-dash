import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClientProfile } from '../src/DemoClientProfile'

const css = readFileSync('src/visual-client-profile-preview.css', 'utf8')

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients/profile?id=demo-client')
})

// Static layout contracts and jsdom behavior, not browser visual acceptance.
describe('final client profile closure', () => {
  it('retains source indicator spacing and readable metadata without changing fixture values', () => {
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    const indicators = within(screen.getByRole('region', { name: 'Clinical indicators — design fixtures only' }))
    expect(indicators.getByText('4/10')).toBeInTheDocument()
    expect(indicators.getByText('7/10')).toBeInTheDocument()
    expect(indicators.getByText('8/10')).toBeInTheDocument()
    expect(container.querySelectorAll('.dcp-indicator')).toHaveLength(3)
    expect(indicators.getByText(/The client shows significant improvement/)).toHaveTextContent('Consistent exercise contributes to positive results.')
    expect(css).toMatch(/\.dcp-metadata h3 \{[^}]*line-height: 1\.3;/)
    expect(css).toContain('.dcp-indicator + .dcp-indicator { margin-top: 20px; }')
    expect(css).toContain('.dcp-indicator:nth-child(3) { margin-top: 24px; }')
    expect(css).toMatch(/\.dcp-summary \{[^}]*min-height: 40px;[^}]*margin-top: 24px;/)
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }))
    expect(screen.queryByRole('region', { name: 'Clinical indicators — design fixtures only' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('article')).toHaveLength(7)
  })

  it('limits compact tablet tab alignment to Overview and preserves truthful keyboard-selected panels', () => {
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    const layout = container.querySelector('.dcp-layout')!
    expect(layout).toHaveClass('dcp-layout-overview')
    const tablet = css.slice(css.indexOf('@media (min-width: 740px)'), css.indexOf('@media (min-width: 601px) and (max-width: 739px)'))
    expect(tablet).toContain('.dcp-layout-overview .dcp-tabs { justify-content: start; gap: 0; }')
    expect(css).toContain('.dcp-tabs { justify-content: space-between; gap: 32px; }')
    for (const name of ['Sessions', 'Notes']) {
      const current = screen.getByRole('tab', { selected: true })
      fireEvent.keyDown(current, { key: 'ArrowRight' })
      const selected = screen.getByRole('tab', { name, selected: true })
      expect(selected).toHaveFocus()
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', selected.id)
      expect(layout).not.toHaveClass('dcp-layout-overview')
    }
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toHaveFocus()
    expect(layout).toHaveClass('dcp-layout-overview')
  })

  it('allows narrow-phone labels, dates and session descriptions to wrap instead of clipping content', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 369px)'))
    expect(narrow).toMatch(/\.dcp-tabs button \{[^}]*height: auto;[^}]*min-height: 48px;[^}]*white-space: normal;/)
    expect(narrow).toContain('.dcp-tabs .design-icon { flex-shrink: 0; }')
    expect(narrow).toMatch(/\.dcp-stats span,\s*\.demo-client-profile \.dcp-date \{ white-space: normal; overflow-wrap: anywhere; \}/)
    expect(narrow).toContain('.dcp-session-copy > p { white-space: normal; overflow: visible; overflow-wrap: anywhere; }')
    render(<DemoClientProfile navigate={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Custom Content' })).toHaveTextContent('Custom Content')
    expect(screen.getByText('Completed Sessions')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }))
    const missed = screen.getByRole('article', { name: 'Individual Session: Missed' })
    expect(within(missed).getByText('Patient did not attend — not rescheduled at the time')).toBeInTheDocument()
    expect(within(missed).getByText('Apr 27, 2024 · 60 minutes')).toBeInTheDocument()
  })
})
