import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClients } from '../src/DemoClients'

const css = readFileSync('src/visual-client-list-preview.css', 'utf8')

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients')
})

// DOM behavior and source-derived CSS contracts, not rendered UI acceptance.
describe('final client-list source-state regressions', () => {
  it('applies the compact desktop rhythm only while the compliance menu is open', async () => {
    const user = userEvent.setup()
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    const root = container.querySelector('.demo-client-list')!
    const toggle = screen.getByRole('button', { name: 'Filter by Compliance' })
    expect(root).toHaveAttribute('data-compliance-open', 'false')
    await user.click(toggle)
    expect(root).toHaveAttribute('data-compliance-open', 'true')
    expect(screen.getByRole('region', { name: 'Compliance design options' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(root).toHaveAttribute('data-compliance-open', 'false')
    expect(toggle).toHaveFocus()
    expect(within(screen.getByRole('region', { name: 'Demo clients' })).getAllByRole('button')).toHaveLength(6)
    const desktop = css.slice(css.indexOf('@media (min-width: 1101px)'), css.indexOf('@media (max-width: 1100px)'))
    expect(desktop).toMatch(/\.demo-client-list\[data-compliance-open='true'\],\s*\.demo-client-list \.secondary-workspace\.is-collapsed \{\s*--demo-client-list-card-gap: 16px;/)
    expect(css).toMatch(/\.demo-client-list \{\s*--demo-client-list-card-gap: 20px;/)
  })

  it('retains all six two-row footers in the compact collapsed desktop state', () => {
    window.history.replaceState({}, '', '/clients?state=collapsed')
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container.querySelector('.secondary-workspace')).toHaveClass('is-collapsed')
    const cards = within(screen.getByRole('region', { name: 'Demo clients' })).getAllByRole('button')
    expect(cards).toHaveLength(6)
    for (const card of cards) {
      expect(card.querySelector('.demo-client-list-card-footer')?.children).toHaveLength(2)
      expect(card.querySelector('.demo-client-list-next-session')).toHaveTextContent(/AM|PM/)
    }
  })

  it('lets phone filters share the available width instead of clipping the compliance button', () => {
    render(<DemoClients navigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'All (6)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active (5)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inactive (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter by Compliance' })).toBeEnabled()
    const phone = css.slice(css.indexOf('@media (max-width: 600px)'))
    expect(phone).toMatch(/\.demo-client-list-filters \{\s*flex: 1;\s*min-width: 0;\s*justify-content: space-between;\s*gap: 0;/)
    expect(phone).toMatch(/\.demo-client-list-filters button \{\s*padding-inline: 8px;/)
    expect(css).not.toMatch(/\.secondary-main\s*\{[^}]*overflow:\s*(clip|hidden)/)
  })

  it('wraps narrow-phone identities, status and footer text without hiding clinical labels', () => {
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    const ethan = screen.getByRole('button', { name: 'Open Ethan Clarke demo reference profile' })
    expect(within(ethan).getByText('Missed previous session')).toBeInTheDocument()
    expect(within(ethan).getByText('2 fewer than last month')).toBeInTheDocument()
    expect(container.querySelectorAll('.demo-client-list-next-session')).toHaveLength(6)
    const narrow = css.slice(css.indexOf('@media (max-width: 359px)'))
    expect(narrow).toMatch(/\.demo-client-list-card-header \{[^}]*height: auto;[^}]*flex-wrap: wrap;/)
    expect(narrow).toMatch(/\.demo-client-list-person \{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/)
    expect(narrow).toMatch(/\.demo-client-list-status \{[^}]*max-width: 100%;[^}]*white-space: normal;/)
    expect(narrow).toMatch(/\.demo-client-list-pill \{[^}]*max-width: 100%;[^}]*flex-wrap: wrap;/)
    expect(narrow).toMatch(/\.demo-client-list-change \{[^}]*height: auto;[^}]*white-space: normal;/)
  })
})
