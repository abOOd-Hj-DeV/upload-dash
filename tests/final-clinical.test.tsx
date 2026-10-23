import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionDetails } from '../src/SessionDetails'

const styles = readFileSync('src/visual-sessions-clinical.css', 'utf8')

beforeEach(() => {
  window.history.replaceState({}, '', '/sessions/upcoming?state=actions')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('final clinical repair contracts (not browser visual acceptance)', () => {
  it('keeps preparation selected and all preparation content reachable with actions open', () => {
    render(<SessionDetails navigate={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Before session' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Session record' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('button', { name: 'Session actions' })).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['Client Overview', 'Before You Begin', 'Quick Clinical Summary', 'Suggested Focus for This Session', 'Clinical Pathway']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    const latestResponse = screen.getByRole('checkbox', { name: "The client's latest response has not been reviewed yet" })
    fireEvent.click(latestResponse)
    expect(latestResponse).toBeChecked()
  })

  it('uses responsive individual preparation budgets instead of fixed-height cards', () => {
    expect(styles).toMatch(/@media \(min-width: 1101px\)\s*\{\s*\.demo-session-detail \.overview-card h3\s*\{\s*margin-bottom: 22px;/)
    expect(styles).toMatch(/\.demo-session-detail \.overview-card dl\s*\{\s*gap: 26px;/)
    expect(styles).toMatch(/\.demo-session-detail \.suggested-focus li\s*\{\s*font: 400 14px\/16px/)
    expect(styles).toMatch(/\.demo-session-detail \.clinical-pathway > div:first-of-type\s*\{\s*padding-top: 18px;/)
    expect(styles).toMatch(/\.demo-session-detail \.clinical-pathway > :last-child\s*\{\s*padding-bottom: 16px;/)
    expect(styles).toMatch(/\.demo-session-detail \.clinical-badge\s*\{\s*margin-top: 18px;/)
    expect(styles).toMatch(/\.demo-workspace:has\(\.demo-session-detail\) \.secondary-heading h1\s*\{\s*direction: rtl;\s*text-align: left;/)
  })

  it('renders the follow-up flag as a decorative vector with an unchanged checkbox name', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    const { container } = render(<SessionDetails navigate={vi.fn()} />)
    const flag = screen.getByRole('checkbox', { name: 'Clinical Follow-up Flag' })
    expect(flag).not.toBeChecked()
    const icon = container.querySelector('.clinical-flag-icon')!
    expect(icon.tagName.toLowerCase()).toBe('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('focusable', 'false')
    expect(icon.querySelector('path')).not.toBeNull()
    expect(container.querySelector('.clinical-flag')).not.toHaveTextContent('🚩')
    fireEvent.click(flag)
    fireEvent.click(screen.getByRole('button', { name: 'Save and Update Next Session' }))
    expect(flag).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('clinical flag selected, but no supervisor was notified')
    expect(screen.getByRole('status')).toHaveTextContent('No backend is connected')
  })

  it('keeps the record, full warning text and both footer actions in normal DOM flow', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    render(<SessionDetails navigate={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Session record' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Before session' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('Noticed clear progress in managing anxiety.')).toBeVisible()
    expect(screen.getByText('When activated, the clinical supervisor is alerted to review this case — used only when additional supervision is needed.')).toBeVisible()
    expect(screen.getByText('What you write in “Next Step” will automatically appear in the preparation for the next session.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to Summary' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save and Update Next Session' })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: 'Before session' }))
    expect(screen.getByRole('tab', { name: 'Before session' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Clinical Pathway' })).toBeInTheDocument()
  })

  it('uses responsive record typography and spacing without clipping the warnings or footer', () => {
    const clinicalRepairs = styles.slice(styles.indexOf('/* Repair two:'))
    expect(clinicalRepairs).toMatch(/\.demo-session-detail\.show-record \.detail-tabs\s*\{\s*margin-top: -16px;/)
    expect(clinicalRepairs).toMatch(/\.demo-session-detail \.clinical-flag p\s*\{\s*font: 400 12px\/16px 'Tajawal', sans-serif;\s*letter-spacing: -0\.1px;/)
    expect(clinicalRepairs).toMatch(/\.demo-session-detail \.continuity-info\s*\{\s*letter-spacing: -0\.1px;/)
    expect(clinicalRepairs).toMatch(/\.demo-session-detail \.previous-note p\s*\{\s*font-size: 12\.5px;/)
    expect(clinicalRepairs).not.toMatch(/(?:transform|zoom|max-height|overflow|text-overflow|white-space)\s*:/)
    expect(clinicalRepairs).not.toMatch(/\.demo-session-detail \.record-footer\s*\{[^}]*(?:height|position)\s*:/)
  })

  it('supports keyboard flag selection, local notes and saved continuity after returning to preparation', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    const user = userEvent.setup()
    render(<SessionDetails navigate={vi.fn()} />)
    await user.type(screen.getByLabelText('New Note'), 'Practiced grounding exercises')
    await user.click(screen.getByRole('button', { name: 'Add Note' }))
    expect(screen.getByText('Practiced grounding exercises')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Next Step / Continuity Note'), 'Discuss sleep next time')
    const flag = screen.getByRole('checkbox', { name: 'Clinical Follow-up Flag' })
    flag.focus()
    await user.keyboard('[Space]')
    expect(flag).toBeChecked()
    expect(flag).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Save and Update Next Session' }))
    expect(screen.getByRole('status')).toHaveTextContent('no supervisor was notified')
    await user.click(screen.getByRole('button', { name: 'Back to Summary' }))
    expect(screen.getByText('Discuss sleep next time')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Before session' })).toHaveAttribute('aria-selected', 'true')
  })
})
