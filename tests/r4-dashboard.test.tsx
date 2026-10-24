import { existsSync, readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'

const states = ['', 'collapsed', 'search', 'notifications', 'offline', 'meeting', 'expanded']
const assetPath = (src: string) => `public${src}`

function renderState(state: string) {
  window.history.replaceState({}, '', state ? `/dashboard?state=${state}` : '/dashboard')
  return render(<Dashboard navigate={vi.fn()} />)
}

describe('r4 dashboard icon parity', () => {
  it.each(states)('every image the %s dashboard state renders exists in public/assets', (state) => {
    const { container, unmount } = renderState(state)
    const sources = [...document.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
    expect(sources.length).toBeGreaterThan(10)
    for (const src of sources) {
      expect(src).toMatch(/^\/assets\/[\w.-]+$/)
      expect(existsSync(assetPath(src)), src).toBe(true)
    }
    expect(container).toBeTruthy()
    unmount()
  })

  it('every asset referenced by the dashboard stylesheet exists', () => {
    const urls = [...readFileSync('src/visual-dashboard-clients.css', 'utf8').matchAll(/url\('([^']+)'\)/g)]
    expect(urls.length).toBeGreaterThan(0)
    for (const [, url] of urls) expect(existsSync(assetPath(url)), url).toBe(true)
  })

  it('uses the Figma glyphs for the collapsed reminder and phone drawer collapse button', () => {
    renderState('collapsed')
    const reminder = document.querySelector('.compact-reminder img')
    expect(reminder).toHaveAttribute('src', '/assets/part2-10-imgMaterialSymbolsLightEmergencyHome.svg')
    const collapse = document.querySelector('.collapse-button .dashboard-drawer-collapse')
    expect(collapse).toHaveAttribute('src', '/assets/r4-dashboard-arrows-in.svg')
    const css = readFileSync('src/visual-dashboard-clients.css', 'utf8')
    expect(css).toMatch(/\.is-collapsed \.dashboard-active-icon \{ background: #1d919e; \}/)
    expect(css).toMatch(/\.notification-button \.icon \{\s*width: 14\.25px;\s*height: 16\.5px;/)
    expect(css).toMatch(/\.mobile-menu \.icon \{\s*width: 24px;\s*height: 24px;/)
  })

  it('renders the notification close glyph at the Figma 15px scale', () => {
    renderState('notifications')
    const svg = document.querySelector('[aria-label="Close notifications"] svg')
    expect(svg).toHaveAttribute('width', '30')
    expect(svg).toHaveAttribute('viewBox', '0 0 20 20')
  })
})
