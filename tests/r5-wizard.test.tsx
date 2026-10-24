import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeworkWizard } from '../src/HomeworkWizard'
import { ApiClient } from '../src/api'

const navigate = vi.fn()

function renderWizard(url = '/homework/create', live = false) {
  window.history.replaceState({}, '', url)
  return render(
    <HomeworkWizard navigate={navigate} api={live ? ({} as ApiClient) : undefined} />,
  )
}

beforeEach(() => {
  navigate.mockClear()
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  window.history.replaceState({}, '', '/homework/create')
})

describe('r5 add-new-content wizard', () => {
  it('renders the type picker, form fields, actions and the live patient preview', () => {
    renderWizard()
    expect(screen.getByRole('heading', { name: 'Add new content' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Patient Preview' })).toBeInTheDocument()
    expect(screen.getByText('Live Preview')).toBeInTheDocument()
    const cards = document.querySelectorAll('.hw-type-card')
    expect(cards).toHaveLength(7)
    expect(screen.getByRole('button', { name: 'Article / Lesson' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Instructions / Description')).toBeInTheDocument()
    expect(screen.getByText('Additional Fields by Content Type')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument()
  })

  it('swaps the additional fields when another content type is selected', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }))
    expect(screen.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Audio File (Trial)')).toBeInTheDocument()
    expect(screen.getByText('Audio thumbnail')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Goal' }))
    expect(screen.getByText('Goal target')).toBeInTheDocument()
    expect(screen.queryByText('Audio File (Trial)')).toBeNull()
  })

  it('updates the phone preview title live from the Title field', () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Breathing Exercise' } })
    expect(document.querySelector('.hw-phone-title')).toHaveTextContent('Breathing Exercise')
  })

  it('blocks publish with a validation error when the title is empty', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(screen.getByRole('alert')).toHaveTextContent('title is required')
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('routes a valid demo publish to the library published state', () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Evening calm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(navigate).toHaveBeenCalledWith('/homework?state=published')
  })

  it('prefills the filled fixture state and shows the draft banner only under ?state=draft', () => {
    const { unmount } = renderWizard('/homework/create?state=filled')
    expect(screen.getByLabelText('Title')).toHaveValue('Daily Small Activity')
    expect(screen.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true')
    unmount()
    renderWizard('/homework/create?state=draft')
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved')
  })

  it('keeps live mode honest: publish shows the unavailable notice instead of navigating', () => {
    renderWizard('/homework/create', true)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Real content' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('not available in the therapist API')
  })

  it('renders nothing without the demo fixture flags', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const { container } = renderWizard()
    expect(container).toBeEmptyDOMElement()
  })
})
