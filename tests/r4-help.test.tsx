import { existsSync, readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Profile } from '../src/Profile'
import { remainingAssets } from '../src/remaining-assets'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const css = readFileSync('src/visual-help-final.css', 'utf8')

function renderedIconSources(root: ParentNode) {
  const sources = [
    ...Array.from(root.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? ''),
    ...Array.from(root.querySelectorAll('source')).map(
      (source) => source.getAttribute('srcset') ?? '',
    ),
  ]
  return [...new Set(sources)]
}

beforeEach(() => window.history.replaceState({}, '', '/profile/help'))

describe('R4 Help icon parity and normal-zoom fit', () => {
  it.each(['', '?state=faq', '?state=contact', '?state=collapsed'])(
    'renders only icons that exist in public/assets for /profile/help%s',
    (query) => {
      window.history.replaceState({}, '', `/profile/help${query}`)
      render(<Profile page="help" navigate={vi.fn()} />)
      const sources = renderedIconSources(document.body)
      expect(sources.length).toBeGreaterThan(0)
      for (const src of sources) {
        expect(src).toMatch(/^\/assets\/[\w.-]+$/)
        expect(existsSync(`public${src}`), src).toBe(true)
      }
    },
  )

  it('keeps every RemainingIcon asset name backed by a real file', () => {
    for (const file of Object.values(remainingAssets)) {
      expect(existsSync(`public/assets/${file}`), file).toBe(true)
    }
  })

  it('uses the Figma right-pointing #B7BAC2 chevron at full opacity for FAQ and Email rows', () => {
    const { container } = render(<Profile page="help" navigate={vi.fn()} />)
    const chevrons = container.querySelectorAll(
      '.help-links .remaining-icon[data-icon="helpArrow"] img',
    )
    expect(chevrons).toHaveLength(2)
    chevrons.forEach((img) =>
      expect(img).toHaveAttribute('src', '/assets/r4-help-chevron-right.svg'),
    )
    const svg = readFileSync('public/assets/r4-help-chevron-right.svg', 'utf8')
    expect(svg).toContain('d="M6 4L10 8L6 12"')
    expect(svg).toContain('stroke="#B7BAC2"')
    expect(css).toMatch(
      /\.profile-help \.help-links \.remaining-setting-row > \.remaining-icon\[data-icon='helpArrow'\]\s*\{\s*width: 16px;\s*opacity: 1;/,
    )
  })

  it('matches Figma row rhythm without hiding, clipping or scaling Help content', () => {
    expect(css).toMatch(/\.profile-help \.help-links \.remaining-setting-row\s*\{\s*gap: 12px;/)
    expect(css).toMatch(/\.profile-help \.help-links h3\s*\{\s*margin-bottom: 6px;/)
    expect(css).toMatch(
      /@media \(max-width: 1100px\)\s*\{\s*\.profile-help \.help-links h3\s*\{\s*margin-top: 0;/,
    )
    expect(css).not.toMatch(/(?:transform|zoom|clip-path)\s*:/)
    expect(css).not.toMatch(/@media[^{]*height/)
    expect(css).not.toMatch(/overflow:\s*hidden/)
  })
})
