import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Modal } from '../src/ui'
import { Wallet } from '../src/Wallet'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

beforeEach(() => window.history.replaceState({}, '', '/wallet?state=withdraw'))

describe('dialog dismissal pointer origin', () => {
  it('does not dismiss a dialog when a click started inside before content recentered', () => {
    const close = vi.fn()
    render(<Modal title="Example" onClose={close}>Content</Modal>)
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Example' }))
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(close).not.toHaveBeenCalled()
    fireEvent.pointerDown(dialog)
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(close).toHaveBeenCalledOnce()
  })

  it('preserves Al-Haram fields and amount when dismissing the recentering payment popup', () => {
    render(<Wallet navigate={vi.fn()} />)
    const combo = screen.getByRole('combobox', { name: 'Payment method' })
    fireEvent.click(combo)
    fireEvent.click(screen.getByRole('option', { name: 'Al-Haram transfer' }))
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Demo Person' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+963999999999' } })
    fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '750' } })
    fireEvent.click(combo)
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Withdrawal Request' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveValue('Demo Person')
    expect(screen.getByLabelText('Phone number')).toHaveValue('+963999999999')
    expect(screen.getByLabelText('Withdrawal amount')).toHaveValue(750)
    fireEvent.pointerDown(dialog)
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps close-button and native cancel dismissal working', () => {
    const close = vi.fn()
    render(<Modal title="Example" onClose={close}>Content</Modal>)
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(close).toHaveBeenCalledOnce()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(close).toHaveBeenCalledTimes(2)
  })
})
