import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Chats } from '../src/Chats'
import { readFileSync } from 'node:fs'

const chatStyles = readFileSync('src/visual-chats.css', 'utf8')
function stylesheetRules() {
  const style = document.createElement('style')
  style.textContent = chatStyles
  document.head.append(style)
  const rules = Array.from(style.sheet!.cssRules)
  style.remove()
  return rules
}
function tabletRule(selector: string) {
  const media = stylesheetRules().find((rule) =>
    (rule as CSSMediaRule).conditionText === '(min-width: 601px) and (max-width: 1100px)',
  ) as CSSMediaRule
  return Array.from(media.cssRules).find((rule) =>
    (rule as CSSStyleRule).selectorText === selector,
  ) as CSSStyleRule
}

// Isolated DOM/state contracts, not browser layout or visual acceptance.
vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, offline }: { children: ReactNode; offline: boolean }) => (
    <main data-offline={offline}>{children}</main>
  ),
  DesignIcon: ({ name }: { name: string }) => <img alt="" data-design-icon={name} />,
}))

const shortSla = 'Committed to responding within 8 hours'

function connectivity(online: boolean) {
  act(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

beforeEach(() => {
  window.history.replaceState({}, '', '/chats')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('closure round one: demo offline no-selection SLA', () => {
  it('keeps the offline desktop reply warning within the history budget without shrinking or clipping it', () => {
    const rules = stylesheetRules()
    const media = rules.find((rule) =>
      (rule as CSSMediaRule).conditionText === '(min-width: 1101px)',
    ) as CSSMediaRule
    const history = Array.from(media.cssRules).find((rule) =>
      (rule as CSSStyleRule).selectorText === '.demo-chat-layout.is-offline .message-history',
    ) as CSSStyleRule
    expect(history.style.getPropertyValue('padding-top')).toBe('24px')
    const warning = rules.find((rule) =>
      (rule as CSSStyleRule).selectorText === '.demo-chat-layout .reply-reminder',
    ) as CSSStyleRule
    expect(warning.style.getPropertyValue('flex-shrink')).toBe('0')
    expect(warning.style.getPropertyValue('overflow')).toBe('')
  })

  it('adds the reference desktop/tablet offline offset without changing phone panel budgets', () => {
    const media = stylesheetRules().find((rule) =>
      (rule as CSSMediaRule).conditionText === '(min-width: 601px)',
    ) as CSSMediaRule
    const rule = Array.from(media.cssRules).find((rule) =>
      (rule as CSSStyleRule).selectorText === '.chat-workspace.demo-workspace.secondary-offline .secondary-offline-banner',
    ) as CSSStyleRule
    expect(rule.style.getPropertyValue('margin-bottom')).toBe('32px')
    expect(rule.selectorText).toContain('.demo-workspace')
  })

  it('removes only the list SLA on actual offline events and restores it online', () => {
    window.history.replaceState({}, '', '/chats?state=empty')
    render(<Chats navigate={vi.fn()} />)
    expect(screen.getByText(shortSla)).toBeInTheDocument()
    connectivity(false)
    expect(screen.queryByText(shortSla)).not.toBeInTheDocument()
    const search = screen.getByRole('textbox', { name: 'Search conversations' }).closest('label')!
    const spacingRule = stylesheetRules().find((rule) =>
      (rule as CSSStyleRule).selectorText === '.demo-chat-layout.is-offline.no-conversation .chat-search',
    ) as CSSStyleRule
    expect(search.matches(spacingRule.selectorText)).toBe(true)
    expect(spacingRule.style.getPropertyValue('margin-bottom')).toBe('10px')
    expect(screen.getByRole('region', { name: 'Select a conversation' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(4)
    connectivity(true)
    expect(screen.getByText(shortSla)).toBeInTheDocument()
  })

  it('preserves the selected offline desktop list SLA and hides it after back', () => {
    window.history.replaceState({}, '', '/chats?state=offline')
    const { container } = render(<Chats navigate={vi.fn()} />)
    expect(screen.getByText(shortSla)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expect(screen.queryByText(shortSla)).not.toBeInTheDocument()
    expect(container.querySelector('main')).toHaveAttribute('data-offline', 'true')
    fireEvent.click(screen.getByRole('button', { name: /^Sara Khaled/ }))
    expect(screen.getByText(shortSla)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
  })

  it('scopes the offline tablet card relocation to demo state and 601–1100px', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 770 })
    window.history.replaceState({}, '', '/chats?state=offline')
    const { container } = render(<Chats navigate={vi.fn()} />)
    const list = container.querySelector('.list-promise')!
    const thread = container.querySelector('.thread-promise')!
    const listRule = tabletRule('.demo-chat-layout.is-offline .list-promise')
    const threadRule = tabletRule('.demo-chat-layout.is-offline .thread-promise')
    expect(list.matches(listRule.selectorText)).toBe(true)
    expect(listRule.style.display).toBe('none')
    expect(thread.matches(threadRule.selectorText)).toBe(true)
    expect(threadRule.style.display).toBe('flex')
    expect(thread.parentElement).toHaveClass('message-history')
    expect(thread.textContent).toContain('8 business hours (Sat–Thu, 9 AM–5 PM)')
    expect(tabletRule('.demo-chat-layout.is-offline .chat-search').style.getPropertyValue('margin-bottom')).toBe('10px')
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
  })

  it('leaves online tablet on the short list SLA and removes offline scope after reconnection', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 770 })
    window.history.replaceState({}, '', '/chats?state=thread')
    const { container } = render(<Chats navigate={vi.fn()} />)
    const layout = container.querySelector('.demo-chat-layout')!
    expect(layout).not.toHaveClass('is-offline')
    expect(screen.getByText(shortSla)).toBeInTheDocument()
    connectivity(false)
    expect(layout).toHaveClass('is-offline')
    connectivity(true)
    expect(layout).not.toHaveClass('is-offline')
    expect(screen.getByRole('textbox', { name: 'Message' })).not.toBeDisabled()
  })

  it('reserves the 92px offline phone alert without changing the composer or live scope', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 370 })
    window.history.replaceState({}, '', '/chats?state=offline')
    const { container } = render(<Chats navigate={vi.fn()} />)
    const phone = stylesheetRules().find((rule) =>
      (rule as CSSMediaRule).conditionText === '(max-width: 600px)',
    ) as CSSMediaRule
    const rules = Array.from(phone.cssRules) as CSSStyleRule[]
    const layout = rules.find((rule) => rule.selectorText === '.chat-layout.demo-chat-layout.is-offline')!
    const list = rules.find((rule) => rule.selectorText === '.chat-layout.demo-chat-layout.is-offline .chat-list')!
    const thread = rules.find((rule) => rule.selectorText === '.chat-layout.demo-chat-layout.is-offline .chat-thread')!
    expect(container.querySelector('.chat-layout')!.matches(layout.selectorText)).toBe(true)
    expect(layout.style.height).toBe('auto')
    expect(layout.style.getPropertyValue('min-height')).toBe('calc(100svh - 164px)')
    expect(list.style.getPropertyValue('min-height')).toBe('max(calc(100svh - 164px), 719px)')
    expect(thread.style.getPropertyValue('min-height')).toBe('max(calc(100svh - 180px), 787.6px)')
    // The 72px nav + 92px alert (+16px thread inset) are reserved once.
    expect(883 - 164).toBe(719)
    expect(967.6 - 180).toBeCloseTo(787.6)
    const live = document.createElement('div')
    live.className = 'chat-layout live-chat-layout'
    expect(live.matches(layout.selectorText)).toBe(false)
    const composer = screen.getByRole('textbox', { name: 'Message' })
    const composerRule = stylesheetRules().find((rule) =>
      (rule as CSSStyleRule).selectorText === '.chat-layout .message-composer textarea',
    ) as CSSStyleRule
    expect(composer.matches(composerRule.selectorText)).toBe(true)
    expect(composerRule.style.height).toBe('41.2px')
    expect(composer).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expect(container.querySelector('.chat-list')!.matches(list.selectorText)).toBe(true)
    expect(screen.queryByText(shortSla)).not.toBeInTheDocument()
  })
})
