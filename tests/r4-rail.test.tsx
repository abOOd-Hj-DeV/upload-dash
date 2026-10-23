import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'
import { Workspace } from '../src/Workspace'

const styles = readFileSync('src/visual-r4-rail.css', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const desktop = styles.slice(styles.indexOf('@media (min-width: 1101px)'), styles.indexOf('@media (min-width: 601px)'))
const tablet = styles.slice(styles.indexOf('@media (min-width: 601px) and (max-width: 1100px)'))

function rule(block: string, selector: string) {
  const start = block.indexOf(`${selector} {`)
  expect(start, selector).toBeGreaterThan(-1)
  return block.slice(start, block.indexOf('}', start))
}

function mountRoot() {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
  return root
}

beforeEach(() => window.history.replaceState({}, '', '/sessions?state=collapsed'))

describe('R4 collapsed rail', () => {
  it('loads once after remaining.css', () => {
    expect(main.indexOf("import './visual-r4-rail.css'")).toBeGreaterThan(
      main.indexOf("import './remaining.css'"),
    )
    expect(main.match(/visual-r4-rail\.css/g)).toHaveLength(1)
  })

  it.each([
    ['desktop collapsed', desktop, '#root .workspace.is-collapsed:not(.is-expanded)'],
    ['tablet automatic rail', tablet, '#root .workspace:not(.is-expanded)'],
  ])('restores Figma 1:29593 geometry for the %s', (_name, block, prefix) => {
    expect(rule(block, `${prefix} .sidebar-header`)).toMatch(/height: 104px;[\s\S]*gap: 8px;[\s\S]*padding: 16px 0 0;/)
    expect(rule(block, `${prefix} .sidebar-header .brand-symbol`)).toMatch(/width: 40px;\s*height: 40px;/)
    expect(rule(block, `${prefix} .collapse-button`)).toMatch(/width: 40px;\s*height: 40px;/)
    expect(rule(block, `${prefix} .navigation`)).toMatch(/gap: 8px;\s*padding: 16px 18px 0;/)
    expect(rule(block, `${prefix} .nav-item`)).toMatch(/width: 44px;\s*height: 44px;[\s\S]*margin: 0;\s*padding: 0;\s*border-radius: 10px;/)
    expect(rule(block, `${prefix} .nav-badge`)).toMatch(/top: 3px;\s*right: 7px;/)
    expect(rule(block, `${prefix} .sidebar-footer`)).toMatch(/gap: 9px;\s*padding: 0 16px;/)
    expect(rule(block, `${prefix} .compact-reminder`)).toMatch(/width: 48px;\s*height: 44px;/)
    expect(rule(block, `${prefix} .compact-reminder > img`)).toContain("content: url('/assets/part2-10-imgMaterialSymbolsLightEmergencyHome.svg');")
    expect(block).toContain(`${prefix} .compact-reminder:not(:has(> i))::after`)
    expect(rule(block, `${prefix} .profile-card`)).toMatch(/width: 48px;\s*height: 48px;[\s\S]*border: 2px solid #1d919e;/)
  })

  it('never touches phone layouts, expanded drawers or focus outlines', () => {
    expect(styles).not.toMatch(/max-width: 600px|is-expanded \.|outline|!important|zoom|scale\(/)
  })

  it('keeps accessible names and tooltips on the collapsed Workspace rail', () => {
    const { container } = render(
      <Workspace title="Sessions" active="Sessions" navigate={vi.fn()}>Content</Workspace>,
      { container: mountRoot() },
    )
    expect(container.querySelector('.workspace')).toHaveClass('is-collapsed')
    const rail = within(screen.getByRole('complementary', { name: 'Main navigation' }))
    expect(rail.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    for (const label of ['Dashboard', 'Patients', 'Sessions', 'Messages', 'Additional Content', 'Wallet'])
      expect(rail.getByRole('button', { name: label })).toHaveAttribute('title', label)
    expect(rail.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
    expect(container.querySelector('.compact-reminder[aria-label="Client review"] img')).toHaveAttribute(
      'src',
      expect.stringContaining('part2-10-imgMaterialSymbolsLightEmergencyHome.svg'),
    )
    expect(rail.getByRole('button', { name: 'Open profile' })).toBeInTheDocument()
  })

  it('keeps the Dashboard rail reminder dot element and accessible names', () => {
    window.history.replaceState({}, '', '/dashboard?state=collapsed')
    const { container } = render(<Dashboard navigate={vi.fn()} />, { container: mountRoot() })
    expect(container.querySelector('.workspace')).toHaveClass('is-collapsed')
    const rail = within(screen.getByRole('complementary', { name: 'Main navigation' }))
    expect(rail.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(rail.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(container.querySelector('.compact-reminder[aria-label="Client review"] > i')).toBeInTheDocument()
  })
})
