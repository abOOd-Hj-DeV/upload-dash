import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClients } from '../src/DemoClients'
import { DemoClientProfile } from '../src/DemoClientProfile'

const css = readFileSync('src/visual-client-list-preview.css', 'utf8')
const profileCss = readFileSync('src/visual-client-profile-preview.css', 'utf8')

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients')
})

// jsdom behavior + CSS contract checks only; these are not rendered visual acceptance.
describe('client-list bounded closure repairs', () => {
  it('preserves the offline warning while scoping amber styling and non-banner dimming to the demo list', () => {
    window.history.replaceState({}, '', '/clients?state=offline')
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container.querySelector('.secondary-workspace')).toHaveClass('secondary-offline')
    expect(screen.getByRole('status')).toHaveTextContent("You're offline. Some data may not be up to date.")
    expect(container.querySelector('.demo-client-list')).toHaveAttribute('data-density', 'spacious')
    expect(css).toMatch(/\.demo-client-list \.secondary-offline :is\(\.sidebar, \.secondary-topbar, \.demo-client-list-toolbar, \.demo-client-list-grid, \.demo-client-list-add-row\) \{\s*opacity: \.5;/)
    expect(css).toMatch(/\.demo-client-list \.secondary-offline-banner \{[^}]*border: 1px solid #ffb900;[^}]*background: #fff4cc;[^}]*color: #fa7800;/)
  })
  it('adds the expanded-phone toolbar affordance without enabling creation or navigation', () => {
    window.history.replaceState({}, '', '/clients?state=expanded')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const navigate = vi.fn()
    const { container } = render(<DemoClients navigate={navigate} />)
    expect(container.querySelector('.secondary-workspace')).toHaveClass('is-expanded')
    const add = screen.getByRole('button', { name: 'Add Client' })
    expect(add).toBeDisabled()
    expect(add).toHaveAccessibleDescription('Client creation is unavailable in this local design preview. No client will be created.')
    fireEvent.click(add)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(css).toContain('.demo-client-list .demo-client-list-add-row {\n  display: none;')
    expect(css.slice(css.indexOf('@media (max-width: 600px)'))).toMatch(/\.secondary-workspace\.is-expanded \.demo-client-list-add-row \{\s*display: block;\s*padding: 16px 16px 0;/)
    expect(css).toMatch(/\.demo-client-list-add \{[^}]*height: 38px;/)
  })
  it.each([
    ['/clients?density=compact', 'compact'],
    ['/clients?density=spacious', 'spacious'],
    ['/clients?density=unknown', 'responsive'],
    ['/clients?state=offline', 'spacious'],
    ['/clients?state=expanded', 'spacious'],
    ['/clients?state=offline&density=compact', 'compact'],
  ])('selects only finite local density states for %s', (path, density) => {
    window.history.replaceState({}, '', path)
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container.querySelector('.demo-client-list')).toHaveAttribute('data-density', density)
    expect(within(screen.getByRole('region', { name: 'Demo clients' })).getAllByRole('button')).toHaveLength(6)
    expect(css).toContain(".demo-client-list[data-density='compact'] {\n  --demo-client-list-card-gap: 16px;")
    expect(css).toContain(".demo-client-list[data-density='spacious'] {\n  --demo-client-list-card-gap: 20px;")
    expect(css).toContain('gap: var(--demo-client-list-card-gap);')
  })
  it.each([['DEV', false], ['VITE_DEMO_MODE', 'false']] as const)('keeps presentation queries gated when %s is disabled', (key, value) => {
    window.history.replaceState({}, '', '/clients?density=spacious&state=expanded')
    vi.stubEnv(key, value)
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('expands only the collapsed desktop grid into three equal available columns', () => {
    window.history.replaceState({}, '', '/clients?state=collapsed')
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container.querySelector('.secondary-workspace')).toHaveClass('is-collapsed')
    expect(within(screen.getByRole('region', { name: 'Demo clients' })).getAllByRole('button')).toHaveLength(6)
    expect(css).toMatch(/@media \(min-width: 1101px\) \{\s*\.demo-client-list \.secondary-workspace\.is-collapsed \.demo-client-list-grid \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);\s*gap: 16px;/)
  })
  it('keeps every collapsed-desktop card date on a second footer row while stretching equal grid rows', () => {
    window.history.replaceState({}, '', '/clients?state=collapsed')
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    const footers = container.querySelectorAll('.demo-client-list-card-footer')
    expect(footers).toHaveLength(6)
    for (const footer of footers) {
      expect(footer.children).toHaveLength(2)
      expect(footer.firstElementChild).toHaveClass('demo-client-list-pill')
      expect(footer.lastElementChild).toHaveClass('demo-client-list-next-session')
    }
    const desktop = css.slice(css.indexOf('@media (min-width: 1101px)'), css.indexOf('@media (max-width: 1100px)'))
    expect(desktop).toMatch(/\.secondary-workspace\.is-collapsed \.demo-client-list-grid \{[^}]*align-items: stretch;/)
    expect(desktop).toMatch(/\.secondary-workspace\.is-collapsed \.demo-client-list-card-footer \{\s*flex-direction: column;\s*flex-wrap: nowrap;\s*align-items: flex-start;/)
    expect(css.slice(css.indexOf('@media (max-width: 1100px)'))).not.toContain('flex-direction: column;')
  })
  it('anchors the compliance popover rightward on desktop, contains it on phone, and highlights All at rest', () => {
    render(<DemoClients navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter by Compliance' }))
    const menu = within(screen.getByRole('region', { name: 'Compliance design options' }))
    expect(menu.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(menu.getByRole('button', { name: 'High Compliance (80%+)' })).toBeDisabled()
    expect(menu.getByRole('button', { name: 'Low Compliance (Below 80%)' })).toBeDisabled()
    expect(css).toMatch(/\.demo-client-list-compliance \{[^}]*top: calc\(100% \+ 2px\); left: -10px;/)
    expect(css.slice(css.indexOf('@media (max-width: 600px)'))).toMatch(/\.demo-client-list \.demo-client-list-compliance \{\s*left: auto;\s*right: 0;/)
    expect(css).toMatch(/\.demo-client-list-compliance button\[aria-pressed='true'\] \{ background: #f5f5f6;/)
  })
})

// Layout contracts are static assertions; only the testing agent can accept visuals.
describe('client profile repair round two', () => {
  it('wraps tablet upcoming date text inside its column without changing Notes or phone headings', () => {
    render(<DemoClientProfile navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }))
    const upcoming = within(screen.getByRole('region', { name: 'Upcoming sessions' }))
    const first = upcoming.getByRole('article', { name: 'Follow-up Session: Upcoming' })
    expect(first.querySelector('.dcp-row-heading')?.children).toHaveLength(2)
    expect(within(first).getByText('May 22, 2024 · 10:00 AM · 60 minutes')).toHaveClass('dcp-date')
    const tablet = profileCss.slice(profileCss.indexOf('@media (min-width: 601px) and (max-width: 1100px)'), profileCss.indexOf('@media (min-width: 740px)'))
    expect(tablet).toMatch(/\.dcp-session-upcoming \.dcp-row-heading \{ flex-wrap: nowrap; \}/)
    expect(tablet).toMatch(/\.dcp-session-upcoming \.dcp-row-heading h3 \{ flex-shrink: 0; \}/)
    expect(tablet).toMatch(/\.dcp-session-upcoming \.dcp-date \{ min-width: 0; white-space: normal; \}/)
    const phone = profileCss.slice(profileCss.indexOf('@media (max-width: 600px)'))
    expect(phone).toContain('.dcp-row-heading { flex-direction: column; align-items: start; gap: 6px; }')
    expect(phone).not.toContain('.dcp-session-upcoming .dcp-date')
  })

  it('keeps only the short historical Follow-up title/date inline and retains all rows and honest disclosures', () => {
    const navigate = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { container } = render(<DemoClientProfile navigate={navigate} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }))
    const panel = within(screen.getByRole('tabpanel'))
    expect(panel.getAllByRole('article')).toHaveLength(7)
    const inline = container.querySelectorAll('.dcp-row-heading-inline')
    expect(inline).toHaveLength(1)
    expect(inline[0]).toHaveTextContent('Follow-upMay 1, 2024 · 45 minutes')
    expect(inline[0].closest('article')).toHaveAccessibleName('Follow-up: Completed')
    const phone = profileCss.slice(profileCss.indexOf('@media (max-width: 600px)'))
    expect(phone).toContain('.dcp-row-heading-inline { flex-direction: row; flex-wrap: wrap; align-items: center; }')
    expect(panel.getByText('Continued commitment to exercises')).toBeInTheDocument()
    expect(panel.getByText('Patient did not attend — not rescheduled at the time')).toBeInTheDocument()
    expect(screen.getByText(/Development design reference only/)).toHaveTextContent('No backend is connected. New notes are local only')
    fireEvent.click(panel.getByRole('button', { name: 'Reschedule Follow-up Session' }))
    expect(screen.getByRole('status')).toHaveTextContent('No call, booking, or server change has been made.')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
