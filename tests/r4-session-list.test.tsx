import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { Sessions } from '../src/Sessions'

const styles = readFileSync('src/visual-session-list-final.css', 'utf8')

function renderedAssetSources(container: HTMLElement) {
  const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
  const cssUrls = [...styles.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1])
  return [...new Set([...sources, ...cssUrls])]
}

beforeEach(() => {
  window.history.replaceState({}, '', '/sessions')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('r4 sessions list icon parity and normal-zoom fit', () => {
  it('renders only icon and portrait sources that exist in public/assets', () => {
    const { container } = render(<Sessions navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Schedule New/ }))
    const sources = renderedAssetSources(container.ownerDocument.body)
    expect(sources.length).toBeGreaterThan(10)
    for (const src of sources) {
      expect(src).toMatch(/^\/assets\/[^/]+$/)
      expect(existsSync(`public${src}`), src).toBe(true)
    }
  })

  it('uses the teal right arrow for desktop See all and keeps it in the DOM', () => {
    render(<Sessions navigate={vi.fn()} />)
    const seeAll = screen.getByRole('button', { name: 'See all' })
    expect(seeAll.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/r4-sessions-list-see-all-arrow.svg',
    )
    expect(readFileSync('public/assets/r4-sessions-list-see-all-arrow.svg', 'utf8')).toContain(
      '#1D919E',
    )
    const desktop = styles.slice(styles.indexOf('@media (min-width: 1101px)'))
    expect(desktop).toMatch(/\.final-session-list > header button\s*\{\s*display: flex;/)
  })

  it('fits the list panel inside short laptop viewports while keeping the 900px canonical budget', () => {
    const short = styles.slice(styles.indexOf('@media (min-width: 601px) and (max-height: 711px)'))
    expect(short).toMatch(
      /\.final-session-list \.sessions-list-scroll\s*\{\s*max-height: max\(240px, calc\(100svh - 212px\)\);/,
    )
    expect(styles).not.toMatch(/\bzoom\s*:|transform:\s*scale/)
  })
})
