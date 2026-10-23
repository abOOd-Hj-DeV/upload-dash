import { existsSync, readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Profile } from '../src/Profile'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const css = readFileSync('src/visual-profile-closure.css', 'utf8')
const pages = [
  ['profile', '/profile'],
  ['settings', '/profile/settings'],
  ['help', '/profile/help'],
] as const
const states = ['edit', 'password', 'preferences', 'hours', 'holidays', 'logout', 'faq', 'contact']

function renderedIconSources(container: HTMLElement) {
  return [
    ...[...container.ownerDocument.querySelectorAll('img')].map((img) => img.getAttribute('src')),
    ...[...container.ownerDocument.querySelectorAll('source')].map((source) =>
      source.getAttribute('srcset'),
    ),
  ]
}

describe('r4 profile settings icon parity and normal-zoom fit', () => {
  it('only renders icon sources that exist in public/assets on every page and dialog state', () => {
    const sources = new Set<string | null>()
    for (const [page, path] of pages) {
      for (const state of ['', ...states]) {
        window.history.replaceState({}, '', state ? `${path}?state=${state}` : path)
        const { container, unmount } = render(<Profile page={page} navigate={vi.fn()} />)
        renderedIconSources(container).forEach((source) => sources.add(source))
        unmount()
      }
    }
    expect(sources.size).toBeGreaterThan(20)
    for (const source of sources) {
      expect(source).toMatch(/^\/assets\/[\w.-]+$/)
      expect(existsSync(`public${source}`), `${source} exists`).toBe(true)
    }
  })

  it('uses the muted bare Figma cross for removing a holiday while keeping the accessible button', () => {
    window.history.replaceState({}, '', '/profile/settings?state=holidays')
    render(<Profile page="settings" navigate={vi.fn()} />)
    const dialog = within(screen.getByRole('dialog', { name: 'Work Hours Management' }))
    const remove = dialog.getByRole('button', { name: 'Remove Annual Leave' })
    expect(remove.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/r4-profile-settings-holiday-remove.svg',
    )
    expect(readFileSync('public/assets/r4-profile-settings-holiday-remove.svg', 'utf8')).toContain(
      'fill="#99A1AF"',
    )
    expect(css).toMatch(
      /\.holidays-modal \.holiday-list \.holiday-remove \{[^}]*width: 32px;[^}]*border: 0;[^}]*background: transparent;/,
    )
    expect(css).toMatch(
      /\.holidays-modal \.remaining-form-actions \.remaining-primary::after \{[^}]*content: '';[^}]*url\('\/assets\/r4-profile-settings-plus\.svg'\)/,
    )
    expect(existsSync('public/assets/r4-profile-settings-plus.svg')).toBe(true)
    fireEvent.click(remove)
    expect(dialog.queryByText('Annual Leave')).not.toBeInTheDocument()
  })

  it('does not hide profile content with height/width media queries or scale hacks', () => {
    expect(css).not.toMatch(/\(\s*(max|min)-height/)
    expect(css).not.toMatch(/\bzoom\s*:|transform:\s*scale/)
    expect(css).not.toMatch(/display:\s*none/)
  })
})
