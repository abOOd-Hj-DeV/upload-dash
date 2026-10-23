import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Workspace } from '../src/Workspace'

const styles = readFileSync('src/visual-r4-nav.css', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')

function renderShell() {
  return render(
    <>
      <Workspace title="Sessions" active="Sessions" navigate={vi.fn()}>
        Sessions
      </Workspace>
    </>,
  )
}

beforeEach(() => {
  window.history.replaceState({}, '', '/sessions')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 770 })
  document.body.style.overflow = ''
})

describe('r4 responsive navigation popup', () => {
  it('opens as a popup with the minimize glyph, scroll lock and focus inside', async () => {
    const { container } = renderShell()
    const opener = screen.getByRole('button', { name: 'Open navigation' })
    await userEvent.click(opener)
    expect(container.querySelector('.workspace')).toHaveClass('is-expanded')
    expect(document.body.style.overflow).toBe('hidden')
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' })
    expect(sidebar).toHaveFocus()
    const toggle = sidebar.querySelector('.collapse-button img')
    expect(toggle).toHaveAttribute('src', expect.stringContaining('r4-nav-popup-minimize.svg'))
    expect(container.querySelector('.sidebar-backdrop')).toHaveAccessibleName('Close navigation')
  })

  it('traps Tab inside the popup and returns focus on Escape', async () => {
    renderShell()
    const opener = screen.getByRole('button', { name: 'Open navigation' })
    opener.focus()
    await userEvent.click(opener)
    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' })
    const profile = screen.getByRole('button', { name: 'Open profile' })
    profile.focus()
    await userEvent.tab()
    expect(sidebar.contains(document.activeElement)).toBe(true)
    await userEvent.tab({ shift: true })
    expect(sidebar.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
    expect(opener).toHaveFocus()
  })

  it('closes from the backdrop and releases the scroll lock', async () => {
    const { container } = renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    await userEvent.click(container.querySelector('.sidebar-backdrop')!)
    expect(container.querySelector('.workspace')).not.toHaveClass('is-expanded')
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the closed toggle glyph and leaves desktop expansion unlocked', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    window.history.replaceState({}, '', '/sessions?state=expanded')
    renderShell()
    expect(document.body.style.overflow).toBe('')
  })

  it('applies Figma popup geometry to every phone/tablet expanded shell', () => {
    expect(main.indexOf("import './visual-r4-nav.css'")).toBeGreaterThan(
      main.indexOf("import './remaining.css'"),
    )
    const block = styles.slice(styles.indexOf('@media (max-width: 1100px)'))
    expect(block).toMatch(/:is\(\.secondary-workspace, \.visual-demo-dashboard\)\.is-expanded \.sidebar \{[^}]*position: fixed;[^}]*width: 264px;[^}]*height: min\(675px, 100svh\);[^}]*border-radius: 0 0 24px 0;[^}]*overflow-y: auto;/)
    expect(block).toMatch(/\.is-expanded \.sidebar-backdrop \{[^}]*background: #0009;[^}]*backdrop-filter: blur\(6px\);/)
    expect(styles).not.toMatch(/zoom|scale\(/)
  })
})
