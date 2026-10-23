import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profile } from '../src/Profile'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const css = readFileSync('src/visual-help-final.css', 'utf8')

beforeEach(() => window.history.replaceState({}, '', '/profile/help'))

describe('final Help responsive contracts (not browser visual acceptance)', () => {
  it('loads Help-only styles from RemainingUI without affecting Profile or Wallet selectors', () => {
    expect(readFileSync('src/RemainingUI.tsx', 'utf8')).toContain("import './visual-help-final.css'")
    const stylesheet = document.createElement('style')
    stylesheet.textContent = css
    document.head.append(stylesheet)
    function selectors(rules: CSSRuleList): string[] {
      return Array.from(rules).flatMap((rule) =>
        'cssRules' in rule
          ? selectors((rule as CSSMediaRule).cssRules)
          : [(rule as CSSStyleRule).selectorText],
      )
    }
    const rules = selectors(stylesheet.sheet!.cssRules)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.every((selector) => selector.split(',').every((part) =>
      /^(?:\.is-collapsed )?\.profile-help /.test(part.trim()),
    ))).toBe(true)
    stylesheet.remove()
  })

  it('stacks tablet Help, version and support in natural DOM flow through phone widths', () => {
    const { container } = render(<Profile page="help" navigate={vi.fn()} />)
    const grid = container.querySelector('.profile-help .profile-help-grid')!
    expect(Array.from(grid.children).map((section) => section.className)).toEqual([
      'help-live', 'help-links',
    ])
    expect(grid.querySelector('.help-live')?.lastElementChild).toHaveTextContent('App version v1.0.0')
    expect(css).toMatch(/@media \(max-width: 1100px\)\s*\{\s*\.profile-help \.profile-help-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\);\s*gap: 28px;\s*padding-top: 38px;/)
    expect(css).toMatch(/\.profile-help \.help-links\s*\{\s*padding-bottom: 0;/)
    expect(css).not.toMatch(/(?:^|[;\s])(?:max-|min-)?height:\s*\d+px;[\s\S]*?overflow:\s*hidden/)
  })

  it('caps the desktop help column while allowing the support column to grow on collapse', () => {
    expect(css).toMatch(/\.profile-help \.profile-help-grid\s*\{\s*grid-template-columns: minmax\(0, min\(340px, 44%\)\) minmax\(0, 1fr\);/)
    expect(css).toMatch(/\.profile-help \.help-live p\s*\{\s*max-width: 300px;\s*font-size: 13px;/)
    expect(css).toMatch(/\.profile-help \.help-live button\s*\{\s*min-height: 44px;/)
    expect(css).toMatch(/\.profile-help \.help-links \.setting-row-copy strong\s*\{\s*font-size: 14px;\s*font-weight: 600;\s*line-height: 20px;/)
    expect(css).toMatch(/\.profile-help \.help-links \.setting-row-copy small\s*\{\s*line-height: 18px;\s*overflow-wrap: anywhere;/)
  })

  it('centers only Help phone counts with a 67px minimum that can grow for live labels', () => {
    expect(css).toMatch(/@media \(max-width: 600px\)\s*\{\s*\.profile-help \.profile-summary \.profile-counts > div\s*\{\s*align-items: center;\s*justify-content: center;\s*min-height: 67px;\s*height: auto;\s*padding: 4px 12px;/)
    expect(css).not.toMatch(/(?:transform|zoom|clip-path|background-image)\s*:/)
  })

  it('supports the Profile-owned responsive labels without generating replacement text in CSS', () => {
    expect(css).toMatch(/\.profile-help \.help-compact-chat,\s*\.is-collapsed \.profile-help \.help-desktop-call\s*\{\s*display: none;/)
    expect(css).toMatch(/\.is-collapsed \.profile-help \.help-compact-chat\s*\{\s*display: inline;/)
    expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.profile-help \.help-desktop-call\s*\{\s*display: none;/)
    expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*?\.profile-help \.help-compact-chat\s*\{\s*display: inline;/)
    expect(css).not.toMatch(/(?:^|[;{])\s*content\s*:/)
  })

  it('keeps the invitation demo-only without issuing a call or chat request', () => {
    const fetch = vi.spyOn(window, 'fetch')
    const { container } = render(<Profile page="help" navigate={vi.fn()} />)
    const help = container.querySelector('.help-live')! as HTMLElement
    fireEvent.click(within(help).getByRole('button'))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only: live chat and phone support are not connected.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['FAQs', 'Frequently Asked Questions'],
    ['Email us', 'Contact support'],
  ])('keeps %s keyboard reachable and opens its existing accessible dialog', async (label, title) => {
    const user = userEvent.setup()
    render(<Profile page="help" navigate={vi.fn()} />)
    const button = screen.getByRole('button', { name: new RegExp(label) })
    button.focus()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: title })
    expect(dialog).toBeInTheDocument()
    if (label === 'FAQs') {
      expect(within(dialog).getByText('How do I add a new client?').closest('details')).toHaveAttribute('open')
    } else {
      expect(within(dialog).getByLabelText('Subject')).toBeEnabled()
      expect(within(dialog).getByLabelText('Message')).toBeEnabled()
    }
    within(dialog).getByRole('button', { name: 'Close dialog' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it.each(['faq', 'contact'])('keeps the responsive Help background present behind the tablet %s dialog', (state) => {
    window.history.replaceState({}, '', `/profile/help?state=${state}`)
    const { container } = render(<Profile page="help" navigate={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(container.querySelector('.profile-help .help-live')).toHaveTextContent('Need help so fast?')
    expect(container.querySelector('.profile-help .help-links')).toHaveTextContent('Support & Help')
  })
})
