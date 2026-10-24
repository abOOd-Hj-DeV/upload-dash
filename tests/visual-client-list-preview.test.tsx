import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClients } from '../src/DemoClients'

const fixtures = [
  [
    'Saad Ali',
    'Anxiety · 32 yrs',
    'Progressing well',
    '40%',
    '139px',
    '7 sessions',
    '3 more than last month',
    'Friday, 9:30 AM',
  ],
  [
    'Jamal Thompson',
    'Fatigue · 29 yrs',
    'Requires review',
    '80%',
    '285px',
    '4 sessions',
    '1 less than last month',
    'Monday, 2:00 PM',
  ],
  [
    'Yaser Ramirez',
    'Mood · 27 yrs',
    'On schedule',
    '60%',
    '204px',
    '6 sessions',
    'Same as last month',
    'Wednesday, 10:00 AM',
  ],
  [
    'Ethan Clarke',
    'Stress · 30 yrs',
    'Missed previous session',
    '13%',
    '31px',
    '5 sessions',
    '2 fewer than last month',
    'Thursday, 3:30 PM',
  ],
  [
    'Maya Patel',
    'Anxiety · 24 yrs',
    'On track',
    '60%',
    '204px',
    '8 sessions',
    'Up by 1 from last month',
    'Tuesday, 8:00 AM',
  ],
  [
    'Noah Bennett',
    'Mood · 28 yrs',
    'On track',
    '60%',
    '204px',
    '5 sessions',
    '2 more than last month',
    'Saturday, 1:00 PM',
  ],
] as const

function cards() {
  return within(screen.getByRole('region', { name: 'Demo clients' })).getAllByRole('button')
}

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients')
})

describe('development-only client-list reference interactions (not visual validation)', () => {
  it('does not expose fixtures when VITE_DEMO_MODE is disabled', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders the six exact reference fixtures and source strip lengths independently of printed percentages', () => {
    render(<DemoClients navigate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Manage Clients' })).toBeInTheDocument()
    expect(cards()).toHaveLength(6)
    fixtures.forEach(
      ([name, detail, status, percentage, stripWidth, sessions, change, date], index) => {
        const card = cards()[index]
        expect(card).toHaveAccessibleName(`Open ${name} demo reference profile`)
        for (const text of [name, detail, status, percentage, sessions, change, date]) {
          expect(within(card).getByText(text)).toBeInTheDocument()
        }
        expect(card.style.getPropertyValue('--demo-client-list-strip-width')).toBe(stripWidth)
        expect(card.querySelector('img')?.getAttribute('src')).toMatch(
          /^\/assets\/preview-client-list-/,
        )
      },
    )
    expect(
      screen.getByRole('button', { name: 'Filter by Compliance' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByText(/Every card opens the separate Ahmed Mohamed reference profile/),
    ).toBeInTheDocument()
  })

  it('exposes the supplied compliance menu without inventing clinical filtering semantics', async () => {
    const user = userEvent.setup()
    render(<DemoClients navigate={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Filter by Compliance' })
    await user.click(toggle)
    const options = within(screen.getByRole('region', { name: 'Compliance design options' }))
    expect(options.getByRole('button', { name: 'High Compliance (80%+)' })).toBeDisabled()
    expect(options.getByRole('button', { name: 'Low Compliance (Below 80%)' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    await user.click(toggle)
    await user.click(within(screen.getByRole('region', { name: 'Compliance design options' })).getByRole('button', { name: 'All' }))
    expect(cards()).toHaveLength(6)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('filters All (6), Active (5), and Inactive (1) locally without network requests', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected demo request'))
    render(<DemoClients navigate={vi.fn()} />)
    const all = screen.getByRole('button', { name: 'All (6)' })
    const active = screen.getByRole('button', { name: 'Active (5)' })
    const inactive = screen.getByRole('button', { name: 'Inactive (1)' })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(active)
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
    expect(cards()).toHaveLength(5)
    expect(screen.queryByText('Ethan Clarke')).not.toBeInTheDocument()
    fireEvent.click(inactive)
    expect(inactive).toHaveAttribute('aria-pressed', 'true')
    expect(cards()).toHaveLength(1)
    expect(within(cards()[0]).getByText('Ethan Clarke')).toBeInTheDocument()
    fireEvent.click(all)
    expect(cards()).toHaveLength(6)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('searches names case-insensitively through Workspace and composes search with the selected filter', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected demo request'))
    render(<DemoClients navigate={vi.fn()} />)
    const search = screen.getByRole('textbox', { name: 'Search patients' })
    fireEvent.change(search, { target: { value: '  tHoMpSoN  ' } })
    expect(cards()).toHaveLength(1)
    expect(within(cards()[0]).getByText('Jamal Thompson')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Inactive (1)' }))
    expect(screen.getByRole('status')).toHaveTextContent('No demo clients found.')
    fireEvent.change(search, { target: { value: 'ETHAN' } })
    expect(cards()).toHaveLength(1)
    expect(within(cards()[0]).getByText('Ethan Clarke')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: '' } })
    expect(cards()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'All (6)' }))
    expect(cards()).toHaveLength(6)
    fireEvent.change(search, { target: { value: 'not a fixture name' } })
    expect(screen.getByRole('status')).toHaveTextContent('No demo clients found.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('preserves the exact demo-client query route for every card', () => {
    const navigate = vi.fn()
    render(<DemoClients navigate={navigate} />)
    cards().forEach((card) => fireEvent.click(card))
    expect(navigate.mock.calls).toEqual(fixtures.map(() => ['/clients/profile?id=demo-client']))
  })

  it('supports native keyboard activation of the reference card', async () => {
    const navigate = vi.fn()
    const user = userEvent.setup()
    render(<DemoClients navigate={navigate} />)
    cards()[0].focus()
    await user.keyboard('{Enter}')
    expect(navigate).toHaveBeenLastCalledWith('/clients/profile?id=demo-client')
  })
})
