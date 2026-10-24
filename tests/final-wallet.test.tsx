import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { Wallet } from '../src/Wallet'
import { closurePortraitAssets } from '../src/closure-portrait-assets'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

const css = readFileSync('src/visual-wallet-closure.css', 'utf8').replace(/\s+/g, ' ')

beforeEach(() => window.history.replaceState({}, '', '/wallet'))

function mount(state: string) {
  window.history.replaceState({}, '', `/wallet?state=${state}`)
  return render(<Wallet navigate={vi.fn()} />)
}

describe('final wallet-owned closure regressions', () => {
  it('wires all five original earnings identities without adding borders to masked artwork', () => {
    const { container } = mount('earnings')
    const rows = container.querySelectorAll('.wallet-transactions article')
    closurePortraitAssets.wallet.earnings.forEach((portrait, index) => {
      expect(rows[index]).toHaveTextContent(portrait.target.name)
      expect(rows[index]).toHaveTextContent(`+${portrait.target.amount} SP`)
      expect(rows[index]).toHaveTextContent(portrait.target.date!)
      expect(rows[index].querySelector('img')).toHaveAttribute('src', `/assets/${portrait.image}`)
      expect(rows[index].querySelector('img')).toHaveAttribute('data-artwork', portrait.artwork)
    })
    expect(css).toContain(
      ".wallet-demo .wallet-transactions img[data-artwork='masked-avatar'] { width: 42px; height: 44px; border: 0; border-radius: 0; }",
    )
  })

  it('uses the responsive ATM portraits while retaining every desktop Sarah portrait', () => {
    const { container } = mount('withdrawals')
    const rows = container.querySelectorAll('.wallet-withdrawal-row')
    expect(rows).toHaveLength(6)
    closurePortraitAssets.wallet.responsiveWithdrawals.forEach((portrait, index) => {
      expect(rows[index].querySelector('source')).toHaveAttribute(
        'srcset',
        `/assets/${portrait.image}`,
      )
      expect(rows[index].querySelector('source')).toHaveAttribute('media', '(max-width: 1100px)')
      expect(rows[index].querySelector('img')).toHaveAttribute(
        'data-responsive-artwork',
        portrait.artwork,
      )
      expect(rows[index]).toHaveTextContent(`-${portrait.target.amount} SP`)
    })
    rows.forEach((row) =>
      expect(row.querySelector('img')).toHaveAttribute('src', '/assets/part3-walletAvatar.png'),
    )
    expect(rows[5]).toHaveClass('wallet-desktop-only')
    const responsiveCss = css.slice(css.indexOf('@media (max-width: 1100px)'))
    expect(responsiveCss).toContain(
      ".wallet-demo .wallet-transactions img[data-responsive-artwork='masked-avatar'] { width: 42px; height: 44px; border: 0; border-radius: 0; }",
    )
  })

  it.each(['withdraw', 'shamcash', 'haram'])(
    'keeps Withdrawals truthful under the %s payment preview',
    (state) => {
      const { container } = mount(state)
      const sections = within(screen.getByRole('navigation', { name: 'Wallet sections' }))
      expect(sections.getByRole('button', { name: 'Withdrawals' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(sections.getByRole('button', { name: 'Earnings' })).not.toHaveAttribute('aria-current')
      expect(container.querySelector('.wallet-layout')).toHaveClass('wallet-withdrawals')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(sections.getByRole('button', { name: 'Withdrawals' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    },
  )

  it('retains five earnings rows and the complete advisory with compact desktop row rhythm', () => {
    const { container } = mount('earnings')
    expect(container.querySelectorAll('.wallet-transactions article')).toHaveLength(5)
    expect(container.querySelector('.phone-wallet-advisory')).toHaveTextContent(
      'same terms apply as stated above the withdraw button.',
    )
    expect(css).toContain('.wallet-demo .wallet-transactions { padding: 14px 0 18px; }')
    expect(css).toContain('.wallet-demo .wallet-transactions article { padding-block: 4px; }')
    expect(css).toContain("400 14px/20px 'IBM Plex Sans Arabic'")
    expect(css).toContain("400 12px/16px 'IBM Plex Sans Arabic'")
    expect(css).toContain("400 14px/21px 'IBM Plex Sans Arabic'")
    expect(css).toContain(
      '.wallet-demo:not(.wallet-overview) .wallet-advisory .remaining-icon { margin-top: 0; }',
    )
    expect(css).not.toMatch(/\.wallet-demo \.wallet-transactions[^}]*overflow:\s*hidden/)
  })

  it('scopes the original offline geometry to desktop and phone payment anchors to responsive units', () => {
    expect(css).toContain('@media (min-width: 1101px)')
    expect(css).toContain(
      '.remaining-workspace.secondary-offline:has(.wallet-demo) .secondary-offline-banner { margin-top: 0; }',
    )
    expect(css).toContain(
      '.remaining-workspace.secondary-offline .wallet-demo .wallet-panel { margin-top: -16px; }',
    )
    expect(css).toContain('.wallet-demo .wallet-stat-grid { row-gap: 10px; }')
    expect(css).toContain('.wallet-demo .wallet-stat-grid p { margin-bottom: 12px; }')
    expect(css).toContain(
      '.wallet-demo-modal { top: 35svh; bottom: auto; margin-block: 0; max-height: calc(65svh - 16px); }',
    )
    expect(css).not.toMatch(/(?:scale|zoom)\s*[:(]/)
  })

  it('keeps the full phone advisory at its reference text size without clipping', () => {
    const phoneCss = css.slice(css.indexOf('@media (max-width: 600px)'))
    expect(phoneCss).toContain(
      '.wallet-demo:not(.wallet-overview) .wallet-advisory { font-size: 12px; }',
    )
    expect(phoneCss).toContain('.wallet-demo .wallet-transactions { padding: 8px 0 12px; }')
    expect(phoneCss).toContain(
      '.wallet-demo.wallet-withdrawals .wallet-stat-grid article { padding-block: 13px; }',
    )
    expect(phoneCss).not.toMatch(/\.wallet-demo[^}]*\.wallet-advisory[^}]*(?:overflow:\s*hidden|line-clamp|max-height)/)
    mount('earnings')
    expect(document.querySelector('.phone-wallet-advisory')).toHaveTextContent(
      'Withdrawals are processed within 3-5 business days, with a minimum withdrawal amount of 500 Riyals — same terms apply as stated above the withdraw button.',
    )
  })

  it('announces the selected method, tracks keyboard focus and leaves browser shortcuts alone', () => {
    mount('withdraw')
    const combo = screen.getByRole('combobox', { name: 'Payment method' })
    combo.focus()
    expect(combo).toHaveAccessibleDescription('Select payment method')
    fireEvent.keyDown(combo, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(combo, { key: 's', metaKey: true })
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    fireEvent.keyDown(combo, { key: 's' })
    const shamcash = screen.getByRole('option', { name: 'Shamcash Transfer' })
    expect(combo).toHaveAttribute('aria-activedescendant', shamcash.id)
    expect(document.activeElement).toBe(combo)
    fireEvent.keyDown(combo, { key: 'Enter' })
    expect(combo).toHaveAccessibleDescription('Shamcash Transfer')
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    expect(combo).not.toHaveAttribute('aria-activedescendant')
    expect(screen.getByLabelText('Shamcash Code')).toBeRequired()
    fireEvent.keyDown(combo, { key: 'Home' })
    fireEvent.keyDown(combo, { key: ' ' })
    expect(combo).toHaveAccessibleDescription('Al-Haram Transfer')
    expect(document.activeElement).toBe(combo)
    expect(screen.queryByLabelText('Shamcash Code')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Select payment method')).toHaveValue('haram')
  })

  it('keeps honest Al-Haram fields and an unsent preview after dismissing only the payment popup', () => {
    const { container } = mount('haram')
    const form = container.querySelector('form')!
    expect(form.querySelectorAll('input')).toHaveLength(4)
    const amount = screen.getByLabelText('Withdrawal amount')
    fireEvent.change(amount, { target: { value: '500' } })
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the payment details')
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Synthetic Recipient' },
    })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0000000000' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Demo Location' } })
    const combo = screen.getByRole('combobox', { name: 'Payment method' })
    fireEvent.click(combo)
    fireEvent.pointerDown(form)
    fireEvent.click(form)
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveValue('Synthetic Recipient')
    fireEvent.submit(form)
    expect(screen.getByRole('status')).toHaveTextContent('500 SP via Al-Haram')
    expect(screen.getByRole('status')).toHaveTextContent('No withdrawal request was sent')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
