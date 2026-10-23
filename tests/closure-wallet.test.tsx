import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { Wallet } from '../src/Wallet'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
const css = readFileSync('src/visual-wallet-closure.css', 'utf8').replace(/\s+/g, ' ')
beforeEach(() => window.history.replaceState({}, '', '/wallet'))
function mount(state: string) {
  window.history.replaceState({}, '', `/wallet?state=${state}`)
  return render(<Wallet navigate={vi.fn()} />)
}

describe('bounded demo wallet closure', () => {
  it('offers branded options, keyboard selection, native form compatibility and demo-only preview', () => {
    const { container } = mount('withdraw')
    const combo = screen.getByRole('combobox', { name: 'Payment method' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.keyDown(combo, { key: 'ArrowDown' })
    expect(combo).toHaveAttribute('aria-expanded', 'true')
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options).toHaveLength(2)
    options.forEach((option) => expect(option.querySelector('img')).not.toBeNull())
    fireEvent.keyDown(combo, { key: 'End' })
    fireEvent.keyDown(combo, { key: 'Enter' })
    expect(screen.getByLabelText('Shamcash Code')).toBeRequired()
    expect(screen.getByLabelText('Select payment method')).toHaveValue('shamcash')
    const form = container.querySelector('form')!
    expect(new FormData(form).get('method')).toBe('shamcash')
    fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '499' } })
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent('between 500 and 12,500')
    fireEvent.change(screen.getByLabelText('Withdrawal amount'), { target: { value: '500' } })
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the payment details')
    fireEvent.change(screen.getByLabelText('Shamcash Code'), { target: { value: 'demo-code' } })
    fireEvent.submit(form)
    expect(screen.getByRole('status')).toHaveTextContent(
      'No withdrawal request was sent and no money was moved',
    )
  })
  it('dismisses only the popup with Escape, Tab or outside pointer; switches method validation', () => {
    mount('withdraw')
    const combo = screen.getByRole('combobox', { name: 'Payment method' })
    fireEvent.click(combo)
    fireEvent.keyDown(combo, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(combo)
    fireEvent.keyDown(combo, { key: 'Tab' })
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(combo)
    fireEvent.pointerDown(screen.getByText('Available Balance: 12,500 SP'))
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(combo)
    fireEvent.click(screen.getByRole('option', { name: 'Al-Haram transfer' }))
    expect(screen.getByLabelText('Full name')).toBeRequired()
    expect(screen.getByLabelText('Phone number')).toBeRequired()
    expect(screen.queryByLabelText('Shamcash Code')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Select payment method'), {
      target: { value: 'shamcash' },
    })
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Shamcash Code')).toBeRequired()
  })
  it('keeps desktop chart order but supplies chronological abbreviated tablet bars and bounded tablet layouts', () => {
    const { container } = mount('overview')
    const tablet = container.querySelector('.tablet-wallet-bars')!
    expect(Array.from(tablet.querySelectorAll('small'), (item) => item.textContent)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
    ])
    expect(Array.from(tablet.querySelectorAll('strong'), (item) => item.textContent)).toEqual([
      '6200',
      '7800',
      '8500',
      '9200',
      '8400',
    ])
    expect(tablet.querySelector('.wallet-bar')).toHaveStyle({ height: '124px' })
    expect(container.querySelector('.desktop-wallet-bars small')).toHaveTextContent('May')
    expect(css).toContain('min-height: 940px')
    expect(css).toContain("content: 'Sakina Therapist Hub'")
    expect(css).toContain('.wallet-demo.wallet-overview .wallet-tabs { display: none; }')
  })
  it('renders five distinct earnings rows including both Omar amounts without duplicate keys', () => {
    const error = vi.spyOn(console, 'error')
    const { container } = mount('earnings')
    const rows = container.querySelectorAll('.wallet-transactions article')
    expect(rows).toHaveLength(5)
    expect(rows[3]).toHaveTextContent('Omar Youssef')
    expect(rows[3]).toHaveTextContent('+200 SP')
    expect(rows[4]).toHaveTextContent('+400 SP')
    const portraits = Array.from(rows, (row) => row.querySelector('img')!.getAttribute('src'))
    expect(new Set(portraits.slice(0, 4)).size).toBe(4)
    // Original 1:21198 has distinct native portraits for the 200 and 400 SP Omar rows.
    expect(portraits[3]).not.toBe(portraits[4])
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
  it('insets only the tall tablet wallet offline warning without dimming the banner', () => {
    mount('offline')
    expect(css).toContain(
      '@media (min-width: 601px) and (max-width: 1100px) and (min-height: 940px)',
    )
    expect(css).toContain(
      '.remaining-workspace.secondary-offline:has(.wallet-demo) .secondary-offline-banner { margin: 16px 40px 40px; }',
    )
    expect(css).not.toMatch(/secondary-offline-banner[^}]*opacity:/)
    expect(css).toContain(
      '.wallet-demo.wallet-withdrawals .wallet-total { min-height: 148px; height: 148px; }',
    )
    expect(css).toContain('.wallet-demo .wallet-total { min-height: 163px; height: 163px; }')
  })
  it('retains three operable sections with compact, equal phone columns and uncropped ledgers', () => {
    const { container } = mount('earnings')
    const tabs = screen.getByRole('navigation', { name: 'Wallet sections' })
    const sections = within(tabs).getAllByRole('button')
    expect(sections).toHaveLength(3)
    sections.forEach((section) => expect(section.querySelector('.remaining-icon')).not.toBeNull())
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('flex-wrap: nowrap')
    expect(css).toContain(
      'flex-direction: column; justify-content: center; min-width: 0; height: 50px',
    )
    expect(css).toContain('.wallet-demo .wallet-transactions article { padding: 7px 0; }')
    expect(css).toContain('.wallet-demo .wallet-transactions article { padding: 4px 0; }')
    expect(css).toContain('.wallet-demo .wallet-transactions article { padding: 7px 4px; }')
    expect(css).toContain('flex-direction: column-reverse')
    expect(css).toContain(
      '.wallet-demo:not(.wallet-overview) .wallet-phone-heading { margin-bottom: 8px; }',
    )
    expect(css).toContain(
      '.wallet-demo:not(.wallet-overview) .wallet-panel { margin-top: 8px; padding: 8px; }',
    )
    expect(css).toContain('.remaining-workspace:has(.wallet-demo) { min-height: 100svh; }')
    expect(css).not.toMatch(/\.wallet-demo \.wallet-transactions[^}]*overflow:\s*hidden/)
    expect(container.querySelector('.wallet-tablet-hero-heading')).toHaveTextContent(
      'All time Overview',
    )
    expect(container.querySelector('.phone-wallet-advisory')).toHaveTextContent('same terms apply')
    fireEvent.click(within(tabs).getByRole('button', { name: 'Overview' }))
    expect(container.querySelector('.phone-wallet-advisory')).toHaveTextContent('Min 500 Riyals.')
    fireEvent.click(within(tabs).getByRole('button', { name: 'Withdrawals' }))
    expect(container.querySelectorAll('.wallet-withdrawal-row')).toHaveLength(6)
    fireEvent.click(within(tabs).getByRole('button', { name: 'Earnings' }))
    expect(container.querySelectorAll('.wallet-transactions article')).toHaveLength(5)
  })
  it('keeps six desktop withdrawals and five independently labelled responsive ATM rows', () => {
    const { container } = mount('withdrawals')
    const rows = container.querySelectorAll('.wallet-withdrawal-row')
    expect(rows).toHaveLength(6)
    expect(
      container.querySelectorAll('.wallet-withdrawal-row:not(.wallet-desktop-only)'),
    ).toHaveLength(5)
    rows.forEach((row) =>
      expect(row.querySelector('.wallet-desktop-detail')).toHaveTextContent('Sarah Ali'),
    )
    expect(rows[2].querySelector('.wallet-responsive-detail.processing')).toHaveTextContent(
      'Processing',
    )
    expect(rows[4]).toHaveTextContent('-400 SP')
    const responsivePortraits = Array.from(rows, (row) =>
      row.querySelector('source')!.getAttribute('srcset'),
    )
    expect(new Set(responsivePortraits.slice(0, 4)).size).toBe(4)
    rows.forEach((row) => {
      expect(row.querySelector('source')).toHaveAttribute('media', '(max-width: 1100px)')
      expect(row.querySelector('img')).toHaveAttribute('src', '/assets/part3-walletAvatar.png')
    })
    expect(css).toContain('.wallet-demo .wallet-desktop-only { display: none; }')
    expect(css).toContain('.wallet-demo .wallet-phone-withdraw { width: 100%; }')
    fireEvent.click(container.querySelector('.wallet-phone-withdraw')!)
    expect(screen.getByRole('dialog')).toHaveTextContent('Withdrawal Request')
  })
})
