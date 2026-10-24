import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClientProfile } from '../src/DemoClientProfile'

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients/profile')
})
afterEach(() => vi.unstubAllGlobals())

function renderPreview() {
  const navigate = vi.fn()
  const user = userEvent.setup()
  const { unmount } = render(<DemoClientProfile navigate={navigate} />)
  return { navigate, user, unmount }
}

function panel() { return within(screen.getByRole('tabpanel')) }

// These are jsdom behavior/content checks, not visual or pixel-fidelity claims.
describe('development-only client profile Figma reference', () => {
  it('does not expose fixtures unless demo mode is explicitly enabled', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders the exact identity, subscription and Overview fixtures without a backend', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    renderPreview()
    expect(screen.getByRole('heading', { name: 'Manage Clients / Profiles' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Manage Clients / Profile' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    for (const text of ['Ahmed Mohamed', 'Age 28 · Male', '+966 50 123 4567', 'ahmed@example.com', '8-Week Package', '2024-01-15', 'Today 10:00 AM']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(panel().getByText('8')).toBeInTheDocument()
    expect(panel().getByText('7')).toBeInTheDocument()
    expect(panel().getByText('85%')).toBeInTheDocument()
    expect(panel().getByText('21')).toBeInTheDocument()
    for (const text of ['Total Sessions', 'Completed Sessions', 'Adherence Rate', 'Days in Program', '4/10', '7/10 previously', '5/10 previously', '6/10 previously', 'Anxiety level', 'Sleep quality', 'Daily performance']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.getByText('The client shows significant improvement across all key indicators. Consistent exercise contributes to positive results.')).toBeInTheDocument()
    expect(screen.getByText(/Development design reference only/)).toHaveTextContent('Figma fixture, not a real patient record')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders nothing when the demo variable is unset', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('switches all tabs, including an honest missing Custom Content reference', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    expect(panel().getByRole('group', { name: 'Filter sessions' })).toBeInTheDocument()
    expect(screen.queryByText('Anxiety level')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().getByRole('textbox', { name: 'New Note' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Custom Content' }))
    expect(panel().getByRole('heading', { name: 'Custom Content reference unavailable' })).toBeInTheDocument()
    expect(panel().getByText(/1:11772 contains Notes/)).toBeInTheDocument()
    expect(panel().queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(panel().getByText('Total Sessions')).toBeInTheDocument()
    for (const tab of screen.getAllByRole('tab')) {
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { selected: true }).id)
      expect(tab).toHaveAttribute('aria-controls')
    }
  })

  it('supports keyboard tab navigation and roving focus', async () => {
    const { user } = renderPreview()
    screen.getByRole('tab', { name: 'Overview' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Custom Content' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Custom Content' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
  })

  it('preserves all seven supplied session rows and the literal All (6) source label', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    expect(panel().getByRole('button', { name: 'All (6)' })).toHaveAttribute('aria-pressed', 'true')
    expect(panel().getAllByRole('article')).toHaveLength(7)
    const upcoming = within(panel().getByRole('region', { name: 'Upcoming sessions' }))
    expect(upcoming.getAllByRole('article')).toHaveLength(2)
    expect(upcoming.getByText('May 22, 2024 · 10:00 AM · 60 minutes')).toBeInTheDocument()
    expect(upcoming.getByText('Scheduled monthly review')).toBeInTheDocument()
    const historical = within(panel().getByRole('region', { name: 'Completed sessions' }))
    expect(historical.getAllByRole('article')).toHaveLength(5)
    expect(historical.getByText('Patient did not attend — not rescheduled at the time')).toBeInTheDocument()
    expect(historical.getByText('Discussed goals and challenges')).toBeInTheDocument()
  })

  it('filters Upcoming, Completed and Missed independently, then restores All', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    await user.click(panel().getByRole('button', { name: 'Upcoming' }))
    expect(panel().getAllByRole('article')).toHaveLength(2)
    expect(panel().queryByText('Initial Consultation')).not.toBeInTheDocument()
    await user.click(panel().getByRole('button', { name: 'Completed' }))
    expect(panel().getAllByRole('article')).toHaveLength(4)
    expect(panel().queryByText('Individual Session')).not.toBeInTheDocument()
    await user.click(panel().getByRole('button', { name: 'Missed' }))
    expect(panel().getAllByRole('article')).toHaveLength(1)
    expect(panel().getByText('Individual Session')).toBeInTheDocument()
    await user.click(panel().getByRole('button', { name: 'All (6)' }))
    expect(panel().getAllByRole('article')).toHaveLength(7)
  })

  it('uses the exact existing notes, and expands/collapses note text locally', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().getByText('Session Date and Time: May 15, 2024, at 4:00 PM')).toBeInTheDocument()
    expect(panel().getByText(/During this session, we thoroughly reviewed/)).toHaveTextContent('ensuring a more tailored and effective therapeutic approach moving forward.')
    expect(panel().getByText('Noticed clear progress in managing anxiety.')).toBeInTheDocument()
    expect(panel().getByText('Patient improved anxiety coping skills.')).toBeInTheDocument()
    const first = panel().getByRole('button', { name: 'Collapse Comprehensive Summary of Therapy Session' })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    await user.click(first)
    expect(panel().getByRole('button', { name: 'Expand Comprehensive Summary of Therapy Session' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(panel().getByRole('button', { name: 'Expand Individual Therapy Session' }))
    expect(panel().getByRole('button', { name: 'Collapse Individual Therapy Session' })).toHaveAttribute('aria-expanded', 'true')
    expect(panel().getByText(/Reviewed anxiety symptoms and coping strategies in detail/)).toHaveTextContent('tackle new challenges for ongoing improvement.')
  })

  it('validates empty, short, whitespace and oversized local notes with no writes', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    const field = panel().getByRole('textbox', { name: 'New Note' })
    expect(field).toHaveAttribute('maxlength', '5000')
    for (const value of ['', '   ', 'ab', 'x'.repeat(5001)]) {
      fireEvent.change(field, { target: { value } })
      fireEvent.submit(field.closest('form')!)
      expect(screen.getByRole('alert')).toHaveTextContent('between 3 and 5,000 characters')
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(panel().queryByText('Local demo note')).not.toBeInTheDocument()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('adds a trimmed local note, retains it between tabs, and loses it on unmount', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { user, unmount } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    const field = panel().getByRole('textbox', { name: 'New Note' })
    await user.type(field, '  My local preview observation  ')
    await user.click(panel().getByRole('button', { name: 'Add Note' }))
    expect(panel().getByText('My local preview observation')).toBeInTheDocument()
    expect(panel().getByText('Local only — not saved to a server')).toBeInTheDocument()
    expect(field).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('It was not sent to a server')
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().getByText('My local preview observation')).toBeInTheDocument()
    unmount()
    renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().queryByText('My local preview observation')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('explicitly refuses unsupported scheduling, calls and rescheduling, and navigates only to demo chats for contact', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { navigate, user } = renderPreview()
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only: Scheduling is not connected')
    await user.click(screen.getByRole('button', { name: 'Call' }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only: Calling is not connected')
    await user.click(screen.getByRole('button', { name: 'Contact patient' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/chats')
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    await user.click(panel().getByRole('button', { name: 'Schedule session' }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only: Schedule session is not connected')
    await user.click(panel().getByRole('button', { name: 'Reschedule Follow-up Session' }))
    expect(screen.getByRole('status')).toHaveTextContent('No call, booking, or server change has been made')
    await user.click(panel().getByRole('button', { name: /View Initial Consultation/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Demo only: Session details is not connected')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
