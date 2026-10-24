import { existsSync, readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { Workspace } from '../src/Workspace'
import { menu } from '../src/data'

const main = readFileSync('src/main.tsx', 'utf8')

function renderShell(active: 'Sessions' | 'Messages' | 'Additional Content' = 'Additional Content') {
  const navigate = vi.fn()
  const view = render(
    <Workspace title="Homework Library" active={active} navigate={navigate}>
      Content
    </Workspace>,
  )
  return { navigate, ...view }
}

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/homework')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  document.body.style.overflow = ''
})

describe('r5 homework navigation wiring', () => {
  it('keeps the Figma order with Additional Content between Messages and Wallet', () => {
    expect(menu.map((item) => item.label)).toEqual([
      'Dashboard',
      'Patients',
      'Sessions',
      'Messages',
      'Additional Content',
      'Wallet',
    ])
    renderShell()
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' })
    const labels = Array.from(sidebar.querySelectorAll('.nav-item')).map((item) =>
      item.getAttribute('aria-label'),
    )
    expect(labels).toEqual([
      'Dashboard',
      'Patients',
      'Sessions',
      'Messages',
      'Additional Content',
      'Wallet',
    ])
  })

  it('uses the supplied stars icon for the Additional Content entry', () => {
    renderShell()
    const item = screen.getByRole('button', { name: 'Additional Content' })
    expect(item.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('part2-03-imgStars.svg'),
    )
    expect(existsSync('public/assets/part2-03-imgStars.svg')).toBe(true)
    expect(existsSync('public/assets/part2-06-imgStars.svg')).toBe(true)
  })

  it('navigates to /homework from the sidebar entry and marks it current', async () => {
    const { navigate } = renderShell('Sessions')
    const item = screen.getByRole('button', { name: 'Additional Content' })
    expect(item).not.toHaveAttribute('aria-current')
    await userEvent.click(item)
    expect(navigate).toHaveBeenCalledWith('/homework')
  })

  it('marks Additional Content as the current page on the homework shell', () => {
    renderShell('Additional Content')
    const item = screen.getByRole('button', { name: 'Additional Content' })
    expect(item).toHaveClass('active')
    expect(item).toHaveAttribute('aria-current', 'page')
  })

  it('reaches /homework from the phone popup drawer and closes it', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const { navigate, container } = renderShell('Additional Content')
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(container.querySelector('.workspace')).toHaveClass('is-expanded')
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' })
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Additional Content' }))
    expect(navigate).toHaveBeenCalledWith('/homework')
    expect(container.querySelector('.workspace')).not.toHaveClass('is-expanded')
  })

  it('keeps Additional Content in the mobile bottom bar with the stars glyph', async () => {
    const { navigate } = renderShell('Messages')
    const bottom = screen.getByRole('navigation', { name: 'Mobile navigation' })
    const buttons = within(bottom).getAllByRole('button')
    expect(buttons).toHaveLength(menu.length + 1)
    const item = within(bottom).getByRole('button', { name: 'Additional Content' })
    expect(item.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('part2-06-imgStars.svg'),
    )
    await userEvent.click(item)
    expect(navigate).toHaveBeenCalledWith('/homework')
  })

  it.each([
    ['/homework', 'Homework Library', '.r5-homework'],
    ['/homework/create', 'Add new content', '.homework-wizard'],
    ['/homework/insert', 'Assign Homework', '.care-plan-insertion'],
  ])('resolves %s through App routes', (route, title, marker) => {
    window.history.replaceState({}, '', route)
    render(<App />)
    expect(screen.getByRole('complementary', { name: 'Main navigation' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Additional Content' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(document.querySelector(marker)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument()
  })

  it('does not resolve unknown homework subpaths', () => {
    window.history.replaceState({}, '', '/homework/details')
    render(<App />)
    expect(screen.queryByRole('complementary', { name: 'Main navigation' })).not.toBeInTheDocument()
  })

  it('keeps reserved shell state params working on homework routes', () => {
    window.history.replaceState({}, '', '/homework?state=collapsed')
    const { container, unmount } = render(<App />)
    expect(container.querySelector('.workspace')).toHaveClass('is-collapsed')
    unmount()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 770 })
    window.history.replaceState({}, '', '/homework?state=expanded')
    const view = render(<App />)
    expect(view.container.querySelector('.workspace')).toHaveClass('is-expanded')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it('shows the offline state on homework routes without touching the toggle', () => {
    window.history.replaceState({}, '', '/homework?state=offline')
    render(<App />)
    expect(screen.getByText(/You.re offline\. Some data may not be up to date\./)).toBeInTheDocument()
  })

  it('protects /homework from fixture fallback in live mode', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    window.history.replaceState({}, '', '/homework')
    render(<App />)
    expect(document.querySelector('input[name="password"]')).toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', { name: 'Main navigation' }),
    ).not.toBeInTheDocument()
  })

  it('loads the round-5 nav stylesheet once after the round-4 sheets', () => {
    expect(main.match(/visual-r5-nav\.css/g)).toHaveLength(1)
    expect(main.indexOf("import './visual-r5-nav.css'")).toBeGreaterThan(
      main.indexOf("import './visual-r4-nav.css'"),
    )
  })
})
