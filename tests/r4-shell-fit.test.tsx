import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'
import { Workspace } from '../src/Workspace'

const styles = readFileSync('src/visual-r4-shell-fit.css', 'utf8')
const desktop = styles.slice(styles.indexOf('@media (min-width: 1101px)'))

function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = desktop.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  expect(match, selector).not.toBeNull()
  return match![1]
}

function expectShellStructure(container: HTMLElement) {
  const sidebar = container.querySelector('.workspace > aside.sidebar')
  expect(sidebar).not.toBeNull()
  expect(sidebar!.querySelector(':scope > div:first-child > .navigation')).not.toBeNull()
  const footer = sidebar!.querySelector(':scope > .sidebar-footer')
  expect(footer).not.toBeNull()
  expect(footer!.querySelector('.client-reminder')).not.toBeNull()
  expect(footer!.querySelector('.compact-reminder')).not.toBeNull()
  expect(footer!.querySelector('.profile-card')).not.toBeNull()
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('R4 desktop shell fit (CSS contract, not a rendered pixel comparison)', () => {
  it('loads once, after the shared base styles', () => {
    const main = readFileSync('src/main.tsx', 'utf8')
    const imports = [...main.matchAll(/^import '\.\/([^']+)'$/gm)].map((m) => m[1])
    expect(imports).toEqual([
      'styles.css',
      'secondary.css',
      'remaining.css',
      'visual-r4-shell-fit.css',
      'visual-r4-rail.css',
      'visual-r4-nav.css',
    ])
  })

  it('scopes the fit to desktop so tablet rail and phone drawer rules stay untouched', () => {
    expect(styles.match(/@media/g)).toHaveLength(1)
    expect(styles.slice(0, styles.indexOf('@media')).replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\{/)
    expect(styles.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/zoom|scale\(|!important|display:\s*none|visibility/)
  })

  it('keeps every expanded or collapsed desktop sidebar exactly one viewport tall and sticky', () => {
    const sidebar = rule('.workspace > aside.sidebar')
    expect(sidebar).toMatch(/position: sticky;/)
    expect(sidebar).toMatch(/top: 0;/)
    expect(sidebar).toMatch(/align-self: flex-start;/)
    expect(sidebar).toMatch(/height: 100svh;/)
    expect(sidebar).toMatch(/min-height: 0;/)
    expect(sidebar).toMatch(/max-height: 100svh;/)
    expect(sidebar).toMatch(/overflow-y: auto;/)
  })

  it('shrinks and scrolls only the navigation while the footer keeps its size', () => {
    expect(rule('.workspace > aside.sidebar > div:first-child')).toMatch(
      /display: flex;[^}]*flex-direction: column;[^}]*flex: 1 1 auto;[^}]*min-height: 0;/,
    )
    expect(rule('.workspace > aside.sidebar .navigation')).toMatch(
      /flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/,
    )
    expect(rule('.workspace > aside.sidebar > .sidebar-footer')).toMatch(/flex-shrink: 0;/)
  })

  it('matches the demo Dashboard shell markup', () => {
    window.history.replaceState({}, '', '/dashboard')
    const { container } = render(<Dashboard navigate={vi.fn()} />)
    expect(container.querySelector('.workspace')).toHaveClass('visual-demo-dashboard')
    expectShellStructure(container)
  })

  it.each(['Messages', 'Clients', 'Profile', 'Wallet', 'Sessions'] as const)(
    'matches the shared Workspace shell markup for %s',
    (active) => {
      window.history.replaceState({}, '', '/')
      const { container } = render(
        <Workspace title={active} active={active} navigate={vi.fn()}>
          <p>Content</p>
        </Workspace>,
      )
      expectShellStructure(container)
    },
  )
})
