import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Auth } from '../src/Auth'
import { SessionDetails } from '../src/SessionDetails'
import { Sessions } from '../src/Sessions'

beforeEach(() => {
  window.history.replaceState({}, '', '/sessions')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('closure sessions/auth static state setup contracts (not visual acceptance)', () => {
  it('restores desktop/tablet signup field rhythm without altering phone spacing or validation', () => {
    const styles = readFileSync('src/visual-auth-shell.css', 'utf8')
    expect(styles).toMatch(/@media \(min-width: 601px\)\s*\{\s*\.auth-page\.visual-auth\.signup-page \.auth-form > label\s*\{\s*margin-top:\s*8px;/)
    const { container } = render(<Auth page="signup" navigate={vi.fn()} verificationEmail="" onCreateAccount={vi.fn()} />)
    const labels = container.querySelectorAll('.auth-page.visual-auth.signup-page .auth-form > label')
    expect(Array.from(labels, (label) => label.textContent)).toEqual(['Work Email', 'Password'])
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(screen.getByLabelText('Work Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password', { selector: 'input' })).toHaveAttribute('minlength', '8')
  })

  it('stacks phone demo portraits and keeps the original readable list typography without changing live rows', () => {
    const styles = readFileSync('src/visual-sessions-clinical.css', 'utf8')
    const phone = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phone).toMatch(/\.demo-all-sessions \.all-sessions-table \.patient-cell\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*flex-start;/)
    expect(phone).toMatch(/\.demo-all-sessions \.patient-name\s*\{[^}]*font-size:\s*14px;/)
    expect(phone).toMatch(/\.demo-all-sessions \.all-sessions-table \.session-date\s*\{[^}]*font-size:\s*14px;/)
    expect(phone).toMatch(/\.demo-all-sessions \.all-sessions-table \.patient-cell small\s*\{[^}]*font-size:\s*12px;/)
    expect(phone).toMatch(/\.demo-all-sessions \.session-status\s*\{[^}]*font-size:\s*12px;/)
  })
  it.each(['', '?state=collapsed', '?state=expanded'])(
    'keeps the sessions list and its navigation composition reachable with %s',
    (query) => {
      window.history.replaceState({}, '', `/sessions${query}`)
      const { container } = render(<Sessions navigate={vi.fn()} />)
      expect(screen.getByRole('tab', { name: 'All (16)' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('region', { name: 'All Sessions' })).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      if (query.includes('collapsed')) expect(container.querySelector('.workspace')).toHaveClass('is-collapsed')
      if (query.includes('expanded')) {
        expect(container.querySelector('.workspace')).toHaveClass('is-expanded')
        expect(container.querySelector('.sidebar-backdrop')).toHaveAttribute('aria-label', 'Close navigation')
      }
    },
  )

  it('initializes the empty schedule dialog without needing a new business route', () => {
    window.history.replaceState({}, '', '/sessions?state=schedule')
    render(<Sessions navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Schedule a new session' })
    for (const field of ['Patient', 'Time', 'Dated', 'Duration']) {
      expect(within(dialog).getByLabelText(field)).toHaveValue('')
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reconstructs record plus open actions through the supported extra click', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    render(<SessionDetails navigate={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Session record' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }))
    expect(screen.getByRole('button', { name: 'Session actions' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'New Note' })).toHaveValue('')
  })

  it('keeps record content editable and locally saved after compacting individual card budgets', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    const { container } = render(<SessionDetails navigate={vi.fn()} />)
    expect(container.querySelector('.session-detail')).toHaveClass('demo-session-detail')
    const note = screen.getByRole('textbox', { name: 'New Note' })
    fireEvent.change(note, { target: { value: 'A longer locally entered clinical note remains readable.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }))
    expect(screen.getByText('A longer locally entered clinical note remains readable.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No clinical record was saved to a server')
    expect(note).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Next Step / Continuity Note'), { target: { value: 'Review practical obstacles next time.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and Update Next Session' }))
    expect(screen.getByRole('status')).toHaveTextContent('No backend is connected')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Summary' }))
    expect(screen.getByRole('tab', { name: 'Before session' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Review practical obstacles next time.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'New Note' })).not.toBeInTheDocument()
  })

  it('uses source row and typography budgets without fixing card heights or clipping record content', () => {
    const styles = readFileSync('src/visual-sessions-clinical.css', 'utf8')
    const budgets = styles.slice(styles.indexOf('/* Repair two: individual source card budgets'), styles.indexOf('/* Original action dropdown'))
    expect(budgets).toMatch(/\.demo-session-detail \.overview-card dl > div\s*\{[^}]*padding:\s*0;[^}]*14px\/16px/)
    expect(budgets).toMatch(/\.demo-session-detail :is\(\.notes-card, \.homework-card\)\s*\{[^}]*padding:\s*16px;/)
    expect(budgets).toMatch(/\.demo-session-detail \.previous-note-heading\s*\{[^}]*flex-wrap:\s*wrap;/)
    expect(budgets).toMatch(/\.demo-session-detail \.notes-card > \.teal-button\s*\{[^}]*width:\s*fit-content;/)
    expect(budgets).not.toMatch(/overflow:\s*(hidden|clip)|transform:|zoom:|max-height:/)
  })

  it('can retain preparation actions when navigation is expanded', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=expanded')
    const { container } = render(<SessionDetails navigate={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Before session' })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('.workspace')).toHaveClass('is-expanded')
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }))
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument()
  })

  it.each([
    ['create', '/homework/create'],
    ['library', '/homework'],
  ] as const)(
    'redirects the removed %s homework composition to %s while keeping the record tab',
    (state, route) => {
      window.history.replaceState({}, '', `/sessions/upcoming?state=${state}`)
      const navigate = vi.fn()
      render(<SessionDetails navigate={navigate} />)
      expect(navigate).toHaveBeenCalledWith(route)
      expect(screen.getByRole('tab', { name: 'Session record' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(
        screen.queryByRole('dialog', { name: 'Assign homework to Ahmed Mohamed' }),
      ).not.toBeInTheDocument()
    },
  )

  it('sends the record homework actions to the /homework routes rather than the removed modal', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    const navigate = vi.fn()
    render(<SessionDetails navigate={navigate} />)
    expect(
      screen.queryByRole('dialog', { name: 'Assign homework to Ahmed Mohamed' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('No new assignments yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Add New Homework' }))
    expect(navigate).toHaveBeenCalledWith('/homework/create')
  })

  it('reaches the filled visible-password design through ordinary form interaction', () => {
    render(<Auth page="login" navigate={vi.fn()} verificationEmail="" onCreateAccount={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'Saad@gmail.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
  })

  it('keeps complete demo verification usable rather than disabling it for a grey reference CTA', () => {
    const navigate = vi.fn()
    render(<Auth page="verify" navigate={navigate} verificationEmail="henryford@Sakina.com" onCreateAccount={vi.fn()} />)
    const verify = screen.getByRole('button', { name: 'Verify' })
    expect(verify).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Code digit 1'), { target: { value: '34512' } })
    for (const [index, digit] of [...'34512'].entries()) expect(screen.getByLabelText(`Code digit ${index + 1}`)).toHaveValue(digit)
    expect(verify).toBeEnabled()
    fireEvent.click(verify)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard')
  })
})
