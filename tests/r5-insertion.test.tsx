import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CarePlanInsertion } from '../src/CarePlanInsertion'

const styles = readFileSync('src/visual-care-plan.css', 'utf8')
const main = readFileSync('src/main.tsx', 'utf8')
const source = readFileSync('src/CarePlanInsertion.tsx', 'utf8')

function renderPage() {
  return render(<CarePlanInsertion navigate={vi.fn()} />)
}

beforeEach(() => {
  window.history.replaceState({}, '', '/homework/insert')
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
})

describe('r5 care plan insertion point (refs r5-102..r5-112)', () => {
  it('is wired into the bundled stylesheet list', () => {
    expect(main).toContain("import './visual-care-plan.css'")
  })

  it('renders the numbered stage list with the Figma statuses and identities', () => {
    renderPage()
    const list = screen.getByRole('list', { name: 'Care plan stages' })
    const items = within(list).getAllByRole('listitem')
    // 9 stages + 8 insert slots + 1 target-gap callout
    expect(items).toHaveLength(18)
    expect(screen.getByText('تقييم الحالة')).toBeInTheDocument()
    expect(screen.getByText('ماذا فقدت من حياتك؟')).toBeInTheDocument()
    expect(screen.getByText('نشاط صغير يوميًا')).toBeInTheDocument()
    expect(screen.getByText('سلّم النشاط')).toBeInTheDocument()
    expect(screen.getByText('جدولة الأنشطة الأسبوعية')).toBeInTheDocument()
    expect(screen.getByText('مواجهة الانسحاب الاجتماعي')).toBeInTheDocument()
    expect(screen.getByText('التعامل مع النكسات')).toBeInTheDocument()
    expect(screen.getByText('بناء روتين طويل المدى')).toBeInTheDocument()
    expect(screen.getAllByText(/Completed · responses preserved/)).toHaveLength(2)
    expect(screen.getByText('Current · in progress')).toBeInTheDocument()
    expect(screen.getByText('Locked · completes after stage 3')).toBeInTheDocument()
    expect(screen.getByText('Stable identity · ba-assess')).toBeInTheDocument()
    expect(screen.getByText('Stable identity · ba-ladder')).toBeInTheDocument()
    expect(screen.getByText('Stable identity · ba-week')).toBeInTheDocument()
  })

  it('shows the target-gap callout after current stage 3 with the pending proposal', () => {
    renderPage()
    const callout = screen.getByRole('listitem', { name: /Target gap · after current stage 3/ })
    expect(within(callout).getByRole('heading', { name: 'Target gap · after current stage 3' })).toBeInTheDocument()
    expect(within(callout).getByText(/Before “سلّم النشاط” · proposed new stage 4 of 10/)).toBeInTheDocument()
    expect(within(callout).getByText('Thought record · سجل الأفكار')).toBeInTheDocument()
    expect(within(callout).getByText(/Published v2 · 4 long-text fields · Not inserted yet/)).toBeInTheDocument()
    expect(within(callout).getByRole('button', { name: /Choose content/ })).toBeInTheDocument()
    expect(within(callout).getByRole('button', { name: 'Reposition' })).toBeInTheDocument()
  })

  it('renders the contact card exactly like the reference fixture', () => {
    renderPage()
    const card = screen.getByRole('complementary', { name: 'Design fixture patient contact' })
    expect(within(card).getByRole('button', { name: 'Contact patient' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Schedule' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Call' })).toBeInTheDocument()
    expect(within(card).getByText('Contact Information')).toBeInTheDocument()
    expect(within(card).getByText('+966 50 123 4567')).toBeInTheDocument()
    expect(within(card).getByText('ahmed@example.com')).toBeInTheDocument()
    expect(within(card).getByText('8-Week Package')).toBeInTheDocument()
    expect(within(card).getByText('2024-01-15')).toBeInTheDocument()
    expect(within(card).getByText('Today 10:00 AM')).toBeInTheDocument()
  })

  it('moves the proposed gap when a different insert slot is chosen', async () => {
    renderPage()
    const slot = screen.getByRole('button', { name: /Insert between stages: after جدولة الأنشطة الأسبوعية, before مواجهة الانسحاب الاجتماعي/ })
    await userEvent.click(slot)
    expect(screen.getByRole('listitem', { name: /Target gap · after stage 5/ })).toBeInTheDocument()
    expect(screen.getByText(/proposed new stage 6 of 10/)).toBeInTheDocument()
  })

  it('keeps Choose content and Reposition honest demo notices', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Choose content/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reposition' }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only')
  })

  it('exposes every insert slot as a labelled button', () => {
    renderPage()
    const slots = screen.getAllByRole('button', { name: /Insert between stages/ })
    expect(slots).toHaveLength(8)
  })

  it('uses teal, tint and hairline values measured from the references', () => {
    expect(styles).toContain('#1d919e')
    expect(styles).toContain('#e9f4f4')
    expect(styles).toContain('#f0f1f1')
    expect(styles).toContain('dashed')
  })

  it.each([['DEV', false], ['VITE_DEMO_MODE', 'false']] as const)(
    'stays honest without fixtures when %s is disabled',
    (key, value) => {
      vi.stubEnv(key, value)
      renderPage()
      expect(screen.queryByText('سلّم النشاط')).not.toBeInTheDocument()
      expect(screen.getByText(/not connected/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Why is this empty?' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Why is this empty?' }))
      expect(screen.getByRole('status')).toHaveTextContent(/not available/)
    },
  )

  it('does not import api clients or persist state in demo mode', () => {
    expect(source).not.toContain('localStorage')
    expect(source).not.toContain('sessionStorage')
    expect(source).not.toContain('fetch(')
  })
})
