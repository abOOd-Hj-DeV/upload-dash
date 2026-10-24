import { act, fireEvent, render, screen } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Chats } from '../src/Chats'

const chatStyles = readFileSync('src/visual-chats.css', 'utf8')

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

function iconSources(container: HTMLElement) {
  return Array.from(container.querySelectorAll('img'))
    .map((image) => image.getAttribute('src') ?? '')
    .filter(Boolean)
}

function expectAssetsExist(sources: string[]) {
  expect(sources.length).toBeGreaterThan(0)
  for (const source of sources) {
    expect(source).toMatch(/^\/assets\/[\w.-]+$/)
    expect(existsSync(`public${source}`), source).toBe(true)
  }
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('r4 chats icon parity', () => {
  it.each([
    ['thread', 1440],
    ['offline', 1440],
    ['empty', 1440],
    ['thread', 770],
    ['offline', 770],
    ['thread', 370],
    ['offline', 370],
    ['list', 370],
  ])('every image rendered in state %s at %ipx exists in public/assets', (state, width) => {
    window.history.replaceState({}, '', `/chats?state=${state}`)
    setViewport(width)
    const { container } = render(<Chats navigate={() => {}} />)
    expectAssetsExist(iconSources(container))
  })

  it('also covers icons after going back to the list and opening another conversation', () => {
    window.history.replaceState({}, '', '/chats?state=thread')
    setViewport(370)
    const { container } = render(<Chats navigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expectAssetsExist(iconSources(container))
    fireEvent.click(screen.getByRole('button', { name: /Ahmed Mohamed/ }))
    expectAssetsExist(iconSources(container))
  })

  it('ships a complete user-alt glyph with head and body for the phone profile tab', () => {
    const svg = readFileSync('public/assets/r4-chats-user-alt.svg', 'utf8')
    expect(svg.match(/<path /g)).toHaveLength(2)
    expect(svg).toContain('viewBox="0 0 24 24"')
  })
})

describe('r4 chats normal-zoom fit', () => {
  it('lets desktop and tablet chats fit short laptop viewports without hiding panels', () => {
    const block = chatStyles.slice(chatStyles.lastIndexOf('@media (min-width: 601px) {'))
    expect(block).toContain('.secondary-workspace.chat-workspace {\n    min-height: 100svh;')
    expect(block).toContain('height: max(calc(100svh - 69px), 420px);')
    expect(block).toContain('height: max(calc(100svh - 145px), 380px);')
    expect(chatStyles).not.toMatch(/zoom\s*:|scale\(/)
    expect(chatStyles).not.toMatch(/max-height:\s*\d+px\)\s*{[^}]*display:\s*none/)
  })

  it('keeps the phone and offline tablet header subtitle on one clipped line', () => {
    expect(chatStyles).toMatch(
      /@media \(max-width: 600px\) \{\s*\.chat-layout \.chat-thread-header p \{\s*white-space: nowrap;/,
    )
    expect(chatStyles).toMatch(
      /\.demo-chat-layout\.is-offline \.chat-thread-header p \{\s*white-space: nowrap;/,
    )
  })

  it('opens a conversation scrolled to its latest message inside the history panel', () => {
    window.history.replaceState({}, '', '/chats?state=thread')
    setViewport(1440)
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(550)
    render(<Chats navigate={() => {}} />)
    const history = document.querySelector('.message-history') as HTMLElement
    expect(history.scrollTop).toBe(550)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Jack watson/ }))
    })
    expect((document.querySelector('.message-history') as HTMLElement).scrollTop).toBe(550)
    expect(scrollHeight).toHaveBeenCalled()
  })
})
