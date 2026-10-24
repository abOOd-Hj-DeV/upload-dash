import { existsSync, readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClients } from '../src/DemoClients'

const css = readFileSync('src/visual-client-list-preview.css', 'utf8')
const desktop = css.slice(css.indexOf('@media (min-width: 1101px)'), css.indexOf('@media (max-width: 1100px)'))

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients')
})

function renderedIconSources(container: HTMLElement) {
  return [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
}

describe('r4 clients-list normal-zoom fit and icon parity', () => {
  it.each(['', '?state=offline', '?state=collapsed', '?state=expanded', '?density=compact', '?density=spacious'])(
    'every icon/image rendered by /clients%s exists in public/assets',
    async (query) => {
      window.history.replaceState({}, '', `/clients${query}`)
      const user = userEvent.setup()
      const { container } = render(<DemoClients navigate={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Filter by Compliance' }))
      const sources = renderedIconSources(container)
      expect(sources.length).toBeGreaterThan(10)
      for (const src of sources) {
        expect(src).toMatch(/^\/assets\/[^/]+$/)
        expect(existsSync(`public${src}`), src).toBe(true)
      }
      for (const name of ['client-6934-imgIcon1.svg', 'preview-client-list-calendar.svg', 'preview-client-list-change.svg', 'preview-client-list-clock.svg']) {
        expect(sources).toContain(`/assets/${name}`)
      }
    },
  )

  it('does not force a 942px page height at laptop viewports', () => {
    expect(css).toMatch(/\.demo-client-list > \.workspace \{\s*min-height: 100svh;\s*\}/)
    expect(css).not.toMatch(/942px/)
  })

  it('reflows expanded desktop cards into responsive columns instead of right-stranded fixed cards', () => {
    expect(desktop).toMatch(
      /\.secondary-workspace:not\(\.is-collapsed\) \.demo-client-list-grid \{\s*display: grid;\s*grid-template-columns: repeat\(auto-fill, minmax\(340px, 1fr\)\);\s*align-items: stretch;/,
    )
    expect(desktop).toMatch(/\.secondary-workspace:not\(\.is-collapsed\) \.demo-client-list-card-footer,\s*\.demo-client-list \.secondary-workspace\.is-collapsed \.demo-client-list-card-footer \{\s*flex-direction: column;/)
    expect(css).not.toMatch(/zoom:|transform:\s*scale/)
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(within(screen.getByRole('region', { name: 'Demo clients' })).getAllByRole('button')).toHaveLength(6)
    expect(container.querySelectorAll('.demo-client-list-next-session')).toHaveLength(6)
  })
})
