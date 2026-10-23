import { existsSync, readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClientProfile } from '../src/DemoClientProfile'

const ownedCss = ['src/visual-client-profile-preview.css', 'src/visual-client-profile.css'].map((file) => readFileSync(file, 'utf8'))

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients/profile?id=demo-client')
})

function imageSources(container: HTMLElement) {
  return [...container.querySelectorAll('img')].map((image) => image.getAttribute('src') ?? '')
}

function expectServedAssets(sources: string[]) {
  expect(sources.length).toBeGreaterThan(0)
  for (const src of sources) {
    expect(src, `icon src ${src}`).toMatch(/^\/assets\/[\w.-]+\.(svg|png)$/)
    expect(existsSync(`public${src}`), `missing public${src}`).toBe(true)
  }
}

describe('r4 client profile icon parity and normal-zoom fit', () => {
  it('renders only icon files that exist in public/assets across every tab, filter and note state', () => {
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    const seen = new Set(imageSources(container))
    const tabs = within(screen.getByRole('tablist', { name: 'Client profile sections' }))
    for (const name of ['Sessions', 'Notes', 'Custom Content', 'Overview']) {
      fireEvent.click(tabs.getByRole('tab', { name }))
      imageSources(container).forEach((src) => seen.add(src))
      if (name === 'Sessions') {
        for (const filter of ['Upcoming', 'Completed', 'Missed', 'All (6)']) {
          fireEvent.click(screen.getByRole('button', { name: filter }))
          imageSources(container).forEach((src) => seen.add(src))
        }
        fireEvent.click(screen.getByRole('button', { name: 'Reschedule Follow-up Session' }))
        expect(screen.getByRole('status')).toHaveTextContent('Demo only')
        imageSources(container).forEach((src) => seen.add(src))
      }
      if (name === 'Notes') {
        fireEvent.click(screen.getByRole('button', { name: 'Collapse Comprehensive Summary of Therapy Session' }))
        fireEvent.change(screen.getByLabelText('New Note'), { target: { value: 'Local icon parity note' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add Note' }))
        imageSources(container).forEach((src) => seen.add(src))
      }
    }
    expectServedAssets([...seen])
    for (const icon of ['overview', 'overview-inactive', 'sessions', 'sessions-active', 'notes', 'notes-active', 'stars', 'contact', 'schedule', 'call', 'summary', 'plus', 'calendar', 'calendar-missed', 'chevron'])
      expect(seen).toContain(`/assets/preview-client-profile-${icon}.svg`)
  })

  it('selects the active/inactive tab glyph per Figma state', () => {
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    const tabIcons = () => [...container.querySelectorAll('[role="tab"] img')].map((image) => image.getAttribute('src'))
    expect(tabIcons()).toEqual(['overview', 'sessions', 'notes', 'stars'].map((name) => `/assets/preview-client-profile-${name}.svg`))
    fireEvent.click(screen.getByRole('tab', { name: 'Sessions' }))
    expect(tabIcons()).toEqual(['overview-inactive', 'sessions-active', 'notes', 'stars'].map((name) => `/assets/preview-client-profile-${name}.svg`))
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(tabIcons()).toEqual(['overview-inactive', 'sessions', 'notes-active', 'stars'].map((name) => `/assets/preview-client-profile-${name}.svg`))
  })

  it('keeps the live profile icon asset served', () => {
    const live = readFileSync('src/ClientProfile.tsx', 'utf8')
    const names = [...live.matchAll(/DesignIcon name="([^"]+)"/g)].map((match) => `/assets/${match[1]}`)
    expectServedAssets(names)
  })

  it('never hides, clips or scales profile content to fit laptop viewports', () => {
    for (const css of ownedCss) {
      expect(css).not.toMatch(/\bzoom\s*:/)
      expect(css).not.toMatch(/transform:\s*scale/)
      expect(css).not.toMatch(/display:\s*none/)
      expect(css).not.toMatch(/@media[^{]*\b(min|max)-height/)
      expect(css).not.toMatch(/(?<![\w-])(max-height|height):\s*\d+(v|sv|dv)h/)
    }
  })
})
