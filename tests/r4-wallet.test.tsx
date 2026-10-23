import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { existsSync, readFileSync } from 'node:fs'
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

function renderedSources(container: HTMLElement) {
  return [
    ...[...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? ''),
    ...[...container.querySelectorAll('source')].map(
      (source) => source.getAttribute('srcset') ?? '',
    ),
  ]
}

function expectAssetsExist(sources: string[]) {
  expect(sources.length).toBeGreaterThan(0)
  for (const src of sources) {
    expect(src).toMatch(/^\/assets\/[^/]+$/)
    expect(existsSync(`public${src}`), src).toBe(true)
  }
}

describe('r4 wallet icon parity', () => {
  it.each(['overview', 'earnings', 'withdrawals', 'offline'])(
    'every icon/image rendered in the %s state exists in public/assets',
    (state) => {
      const { container } = mount(state)
      expectAssetsExist(renderedSources(container))
    },
  )

  it('every icon/image in the withdrawal dialog and payment menu exists in public/assets', () => {
    const { container } = mount('withdrawals')
    fireEvent.click(container.querySelector('.wallet-withdraw-button')!)
    fireEvent.click(screen.getByRole('combobox', { name: 'Payment method' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelectorAll('[role="option"] img')).toHaveLength(2)
    expectAssetsExist(renderedSources(document.body))
    fireEvent.click(screen.getByRole('option', { name: /Shamcash/ }))
    expectAssetsExist(renderedSources(document.body))
  })

  it('renders the Figma bold arrow glyph as a real icon in both Withdraw buttons', () => {
    const { container } = mount('withdrawals')
    for (const selector of ['.wallet-withdraw-button', '.wallet-phone-withdraw']) {
      const button = container.querySelector(selector)!
      expect(button).toHaveTextContent(/^Withdraw$/)
      expect(button.querySelector('img.wallet-withdraw-arrow')).toHaveAttribute(
        'src',
        '/assets/r4-wallet-arrow-right.svg',
      )
    }
    expect(css).not.toContain("content: ' →'")
    expect(css).toContain(
      '.wallet-demo .wallet-withdraw-arrow { display: inline-block; width: 16px; height: 16px; margin-left: 8px; vertical-align: top; }',
    )
    expect(css).toContain(
      '.wallet-demo .wallet-mobile-list-heading > .wallet-phone-withdraw { font-size: 14px; }',
    )
    const svg = readFileSync('public/assets/r4-wallet-arrow-right.svg', 'utf8')
    expect(svg).toContain('stroke="white"')
    expect(svg).toContain('stroke-width="2"')
  })

  it('uses the light outline advisory glyph on list tabs and the dark phone glyph only on overview', () => {
    const list = mount('earnings').container.querySelector('.wallet-advisory .remaining-icon')!
    expect(list.querySelector('source')).toBeNull()
    expect(list.querySelector('img')).toHaveAttribute('src', '/assets/part3-withdrawalInfo.svg')
    document.body.innerHTML = ''
    const overview = mount('overview').container.querySelector('.wallet-advisory .remaining-icon')!
    expect(overview.querySelector('source')).toHaveAttribute(
      'srcset',
      '/assets/part3-withdrawalInfoMobile.svg',
    )
  })
})
