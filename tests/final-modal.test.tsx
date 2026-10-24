import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { Modal } from '../src/ui'
import { Wallet } from '../src/Wallet'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

type Point = { clientX: number; clientY: number }
function rect(left = 516, top = 193, width = 408, height = 388): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}

// jsdom has no native PointerEvent; MouseEvent retains the real client coordinates.
function pointer(
  target: Element,
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  point: Point,
) {
  fireEvent(target, new MouseEvent(type, { bubbles: true, ...point, button: 0 }))
}

function clickAt(target: Element, point: Point) {
  pointer(target, 'pointerdown', point)
  pointer(target, 'pointerup', point)
  fireEvent.click(target, point)
}

function mountModal() {
  const close = vi.fn()
  render(
    <Modal title="Coordinate regression" onClose={close}>
      <button>Last control</button>
    </Modal>,
  )
  const dialog = screen.getByRole('dialog')
  const bounds = vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(rect())
  return { close, dialog, bounds }
}

beforeEach(() => window.history.replaceState({}, '', '/wallet?state=haram'))

describe('final modal coordinate hit testing', () => {
  it.each([
    ['top padding', 720, 201],
    ['bottom padding', 720, 573],
    ['left padding', 524, 387],
    ['right padding', 916, 387],
    ['left border', 516, 387],
    ['top border', 720, 193],
  ])('keeps the actual dialog surface open at %s', (_label, clientX, clientY) => {
    const { dialog, close } = mountModal()
    clickAt(dialog, { clientX, clientY })
    expect(close).not.toHaveBeenCalled()
  })

  it.each([
    ['above', 720, 180],
    ['below', 720, 595],
    ['left', 500, 387],
    ['right', 940, 387],
  ])('dismisses a genuine backdrop click %s the dialog', (_label, clientX, clientY) => {
    const { dialog, close } = mountModal()
    clickAt(dialog, { clientX, clientY })
    expect(close).toHaveBeenCalledOnce()
  })

  it('keeps a padding-origin gesture inside even when recentering exposes backdrop at release', () => {
    const { dialog, close, bounds } = mountModal()
    const point = { clientX: 720, clientY: 201 }
    pointer(dialog, 'pointerdown', point)
    bounds.mockReturnValue(rect(516, 233, 408, 308))
    pointer(dialog, 'pointerup', point)
    fireEvent.click(dialog, point)
    expect(close).not.toHaveBeenCalled()
    clickAt(dialog, { clientX: 500, clientY: 200 })
    expect(close).toHaveBeenCalledOnce()
  })

  it('does not dismiss a drag starting outside and ending on inner whitespace', () => {
    const { dialog, close } = mountModal()
    pointer(dialog, 'pointerdown', { clientX: 500, clientY: 387 })
    pointer(dialog, 'pointerup', { clientX: 524, clientY: 387 })
    fireEvent.click(dialog, { clientX: 524, clientY: 387 })
    expect(close).not.toHaveBeenCalled()
  })

  it('remembers an inside release when the dialog moves again before click dispatch', () => {
    const { dialog, close, bounds } = mountModal()
    pointer(dialog, 'pointerdown', { clientX: 500, clientY: 200 })
    pointer(dialog, 'pointerup', { clientX: 720, clientY: 201 })
    bounds.mockReturnValue(rect(516, 233, 408, 308))
    fireEvent.click(dialog, { clientX: 720, clientY: 201 })
    expect(close).not.toHaveBeenCalled()
  })

  it('preserves descendant-origin gestures when release is retargeted to the native dialog', () => {
    const { dialog, close } = mountModal()
    pointer(screen.getByRole('heading'), 'pointerdown', { clientX: 650, clientY: 220 })
    pointer(dialog, 'pointerup', { clientX: 500, clientY: 200 })
    fireEvent.click(dialog, { clientX: 500, clientY: 200 })
    expect(close).not.toHaveBeenCalled()
  })

  it('does not mistake overflowing descendants for the backdrop', () => {
    const { close } = mountModal()
    clickAt(screen.getByRole('button', { name: 'Last control' }), { clientX: 950, clientY: 600 })
    expect(close).not.toHaveBeenCalled()
  })

  it('clears a cancelled pointer origin before a later coordinate-only outside click', () => {
    const { dialog, close } = mountModal()
    pointer(dialog, 'pointerdown', { clientX: 524, clientY: 387 })
    pointer(dialog, 'pointercancel', { clientX: 524, clientY: 387 })
    fireEvent.click(dialog, { clientX: 500, clientY: 387 })
    expect(close).toHaveBeenCalledOnce()
  })

  it('checks coordinates even when a click arrives without pointer events', () => {
    const { dialog, close } = mountModal()
    fireEvent.click(dialog, { clientX: 524, clientY: 387 })
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(dialog, { clientX: 500, clientY: 387 })
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('withdrawal menu recentering with real dialog surface coordinates', () => {
  it.each([
    ['desktop', 1440, 774, 408],
    ['tall desktop', 1440, 950, 408],
    ['tablet', 770, 920, 408],
    ['phone', 370, 1028, 340],
    ['narrow phone', 320, 1028, 288],
  ])(
    'preserves entered Al-Haram fields after padding clicks on %s',
    (_label, width, height, dialogWidth) => {
      render(<Wallet navigate={vi.fn()} />)
      const dialog = screen.getByRole('dialog')
      const combo = screen.getByRole('combobox', { name: 'Payment method' })
      fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Synthetic Test' } })
      fireEvent.change(screen.getByLabelText('Phone number'), {
        target: { value: '+963999999999' },
      })
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Demo location' } })
      fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '750' } })
      const collapsed = rect((width - dialogWidth) / 2, (height - 388) / 2, dialogWidth, 388)
      const expanded = rect(collapsed.left, collapsed.top - 40, dialogWidth, 468)
      vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() =>
        combo.getAttribute('aria-expanded') === 'true' ? expanded : collapsed,
      )

      for (const point of [
        { clientX: width / 2, clientY: expanded.top + 8 },
        { clientX: width / 2, clientY: expanded.bottom - 8 },
        { clientX: expanded.left + 8, clientY: height / 2 },
        { clientX: expanded.right - 8, clientY: height / 2 },
      ]) {
        fireEvent.click(combo)
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        pointer(dialog, 'pointerdown', point)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        pointer(dialog, 'pointerup', point)
        fireEvent.click(dialog, point)
        expect(dialog).toBeInTheDocument()
        expect(screen.getByLabelText('Full name')).toHaveValue('Synthetic Test')
        expect(screen.getByLabelText('Phone number')).toHaveValue('+963999999999')
        expect(screen.getByLabelText('Location')).toHaveValue('Demo location')
        expect(screen.getByLabelText('Withdrawal amount')).toHaveValue(750)
      }
      fireEvent.click(combo)
      clickAt(dialog, { clientX: expanded.left - 10, clientY: height / 2 })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    },
  )

  it('consumes menu Escape without dismissing the modal; native cancel still dismisses', () => {
    render(<Wallet navigate={vi.fn()} />)
    const combo = screen.getByRole('combobox', { name: 'Payment method' })
    combo.focus()
    fireEvent.click(combo)
    expect(fireEvent.keyDown(combo, { key: 'Escape' })).toBe(false)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(combo).toHaveFocus()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('modal keyboard and focus behavior', () => {
  it('keeps Tab wraparound on the dialog controls', () => {
    mountModal()
    const first = screen.getByRole('button', { name: 'Close dialog' })
    const last = screen.getByRole('button', { name: 'Last control' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
  })

  it.each(['close button', 'native cancel', 'backdrop'])(
    'restores opener focus after %s dismissal',
    (method) => {
      function Example() {
        const [open, setOpen] = useState(false)
        return (
          <>
            <button onClick={() => setOpen(true)}>Open dialog</button>
            {open && (
              <Modal title="Focus regression" onClose={() => setOpen(false)}>
                Content
              </Modal>
            )}
          </>
        )
      }
      render(<Example />)
      const opener = screen.getByRole('button', { name: 'Open dialog' })
      opener.focus()
      fireEvent.click(opener)
      const dialog = screen.getByRole('dialog')
      vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(rect())
      screen.getByRole('button', { name: 'Close dialog' }).focus()
      if (method === 'close button')
        fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
      else if (method === 'native cancel')
        fireEvent(dialog, new Event('cancel', { cancelable: true }))
      else clickAt(dialog, { clientX: 500, clientY: 387 })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(opener).toHaveFocus()
    },
  )
})
