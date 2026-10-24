import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Chats } from '../src/Chats'

const chatStyles = readFileSync('src/visual-chats.css', 'utf8')
const baseStyles = readFileSync('src/secondary.css', 'utf8')
const emptySelector = '.demo-chat-layout.is-offline.no-conversation .empty-conversation'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, offline }: { children: ReactNode; offline: boolean }) => (
    <main data-offline={offline}>{children}</main>
  ),
  DesignIcon: ({ name }: { name: string }) => <img alt="" data-design-icon={name} />,
}))

function rules(css: string) {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  const result = Array.from(style.sheet!.cssRules)
  style.remove()
  return result
}

function connectivity(online: boolean) {
  act(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

beforeEach(() => {
  window.history.replaceState({}, '', '/chats?state=empty')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// CSS/DOM contracts only; jsdom does not establish rendered pixel positions.
describe('final chats: offline empty-panel flow centering', () => {
  it('restores the removed offline height budget as padding only above phone width', () => {
    const wide = rules(chatStyles).find((rule) =>
      (rule as CSSMediaRule).conditionText === '(min-width: 601px)',
    ) as CSSMediaRule
    const correction = Array.from(wide.cssRules).find((rule) =>
      (rule as CSSStyleRule).selectorText === emptySelector,
    ) as CSSStyleRule | undefined
    expect(correction).toBeDefined()

    const base = rules(baseStyles) as CSSStyleRule[]
    const heightBudget = (selector: string) => {
      const height = base.find((rule) => rule.selectorText === selector)!.style.height
      return Number(height.match(/100svh - (\d+)px/)![1])
    }
    const removedBudget = heightBudget('.secondary-offline .chat-layout') - heightBudget('.chat-layout')
    expect(removedBudget).toBe(76)
    expect(correction!.style.getPropertyValue('padding-block-start')).toBe(`${removedBudget}px`)
    expect(correction!.style.getPropertyValue('transform')).toBe('')
    expect(correction!.style.getPropertyValue('position')).toBe('')

    const { container } = render(<Chats navigate={vi.fn()} />)
    const empty = screen.getByRole('region', { name: 'Select a conversation' })
    expect(empty.matches(emptySelector)).toBe(true)
    const layout = container.querySelector('.demo-chat-layout')!
    layout.classList.replace('demo-chat-layout', 'live-chat-layout')
    expect(empty.matches(emptySelector)).toBe(false)

    const phone = rules(chatStyles).find((rule) =>
      (rule as CSSMediaRule).conditionText === '(max-width: 600px)',
    ) as CSSMediaRule
    expect(Array.from(phone.cssRules).some((rule) =>
      (rule as CSSStyleRule).selectorText === emptySelector,
    )).toBe(false)
  })

  it('keeps Arabic instructions, no selected row and no SLA while offline, then restores online scope', () => {
    render(<Chats navigate={vi.fn()} />)
    const empty = screen.getByRole('region', { name: 'Select a conversation' })
    expect(within(empty).getByRole('heading', { name: 'اختر محادثة' })).toHaveAttribute('dir', 'rtl')
    expect(within(empty).getByText('اضغط على محادثة من القائمة لفتحها والرد على العميل')).toHaveAttribute('dir', 'rtl')
    expect(empty.querySelector('[data-design-icon="part2-20-imgMessageCircleLinesAlt1.svg"]')).not.toBeNull()
    expect(document.querySelectorAll('.conversation.selected')).toHaveLength(0)
    expect(screen.queryByText('Committed to responding within 8 hours')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()

    connectivity(true)
    expect(empty.matches(emptySelector)).toBe(false)
    expect(screen.getByText('Committed to responding within 8 hours')).toBeInTheDocument()
    connectivity(false)
    expect(empty.matches(emptySelector)).toBe(true)
    expect(screen.queryByText('Committed to responding within 8 hours')).not.toBeInTheDocument()
  })

  it.each([1440, 770, 370, 320])('preserves keyboard selection and disabled offline composer at %ipx', async (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    const user = userEvent.setup()
    const { container } = render(<Chats navigate={vi.fn()} />)
    const sara = screen.getByRole('button', { name: /^Sara Khaled/ })
    sara.focus()
    await user.keyboard('{Enter}')
    const thread = screen.getByRole('region', { name: 'Conversation with Sara Khaled' })
    expect(container.querySelector('.demo-chat-layout')).toHaveClass('is-offline', 'has-conversation')
    expect(thread.matches(emptySelector)).toBe(false)
    expect(within(thread).getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(within(thread).getByRole('button', { name: 'Attach a file' })).toBeDisabled()
    expect(within(thread).getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expect(screen.queryByText('Committed to responding within 8 hours')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Select a conversation' }).matches(emptySelector)).toBe(true)
    expect(container.querySelector('.demo-chat-layout')).toHaveClass('no-conversation')
  })
})
