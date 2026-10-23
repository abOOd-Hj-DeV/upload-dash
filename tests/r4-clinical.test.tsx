import { existsSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionDetails } from '../src/SessionDetails'

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('round 4 clinical icon parity (not browser visual acceptance)', () => {
  it.each(['actions', 'record', 'create', 'library', 'expanded'])(
    'renders only existing public assets in the %s state',
    (state) => {
      window.history.replaceState({}, '', `/sessions/upcoming?state=${state}`)
      const { baseElement, unmount } = render(<SessionDetails navigate={vi.fn()} />)
      const sources = [...baseElement.querySelectorAll('img')].map((img) => img.getAttribute('src'))
      expect(sources.length).toBeGreaterThan(0)
      for (const src of sources) {
        expect(src).toMatch(/^\/assets\/[\w.-]+$/)
        expect(existsSync(`public${src}`), String(src)).toBe(true)
      }
      unmount()
    },
  )

  it('uses Figma vectors instead of text glyphs for actions, add note and note chevron', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    render(<SessionDetails navigate={vi.fn()} />)
    const actions = screen.getByRole('button', { name: 'Session actions' })
    expect(actions.textContent).toBe('')
    expect(actions.querySelector('img')).toHaveAttribute('src', '/assets/r4-clinical-more.svg')
    const addNote = screen.getByRole('button', { name: 'Add Note' })
    expect(addNote.querySelector('img')).toHaveAttribute('src', '/assets/preview-client-profile-plus.svg')
    const previous = screen.getByRole('button', { name: /Therapy: One-on-One Session/ })
    expect(previous.textContent).not.toContain('›')
    expect(previous.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/preview-client-profile-chevron.svg',
    )
  })
})
