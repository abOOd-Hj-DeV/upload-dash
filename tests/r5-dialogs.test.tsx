import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SessionDetails } from '../src/SessionDetails'
import { Profile } from '../src/Profile'
import { DeleteTemplateDialog } from '../src/DeleteTemplateDialog'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  DesignIcon: ({ name }: { name: string }) => <img src={name} alt="" aria-hidden="true" />,
}))

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/sessions/upcoming?state=record')
})

describe('r5 dialogs-remove: crossed-out assign-homework modal', () => {
  it.each(['library', 'create'] as const)('redirects ?state=%s to the homework library', (state) => {
    window.history.replaceState({}, '', `/sessions/upcoming?state=${state}`)
    const navigate = vi.fn()
    render(<SessionDetails navigate={navigate} />)
    expect(navigate).toHaveBeenCalledWith(state === 'library' ? '/homework' : '/homework/create')
    expect(
      screen.queryByRole('dialog', { name: /Assign homework to/ }),
    ).not.toBeInTheDocument()
  })

  it('repoints "+ Add New Homework" to /homework/create instead of the deleted modal', () => {
    const navigate = vi.fn()
    render(<SessionDetails navigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add New Homework' }))
    expect(navigate).toHaveBeenCalledWith('/homework/create')
    expect(
      screen.queryByRole('dialog', { name: /Assign homework to/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps the previous-homework review card and the assigned-homework list', () => {
    render(<SessionDetails navigate={vi.fn()} />)
    expect(screen.getByText("Review previous session's homework")).toBeInTheDocument()
    expect(screen.getByText('New assignment after this session')).toBeInTheDocument()
    expect(screen.getByText('Cognitive Restructuring')).toBeInTheDocument()
    expect(screen.getByText('Avoid news and social media')).toBeInTheDocument()
  })
})

describe('r5 dialogs-remove: DeleteTemplateDialog (refs r5-113..115)', () => {
  it('renders the Figma confirm copy and wires cancel/delete', () => {
    const onClose = vi.fn()
    const onDelete = vi.fn()
    render(
      <DeleteTemplateDialog
        templateName="Daily Breathing Exercise"
        assignedCount={14}
        onClose={onClose}
        onDelete={onDelete}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete Template?' })
    expect(
      within(dialog).getByText(
        'Are you sure you want to delete “Daily Breathing Exercise”? This action cannot be undone. This template is currently assigned to 14 patients.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete template' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('opens through the session demo fixture ?state=delete-template and stays demo-honest', () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=delete-template')
    render(<SessionDetails navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Delete Template?' })
    expect(dialog).toHaveClass('r5-delete-template-modal')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete template' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByText('Demo only: no template was deleted. No backend is connected.'),
    ).toBeInTheDocument()
  })
})

describe('r5 dialogs-remove: holiday-row delete control (refs r5-116..118)', () => {
  it('removes a vacation row locally via the bare X delete button', async () => {
    window.history.replaceState({}, '', '/profile/settings?state=holidays')
    render(<Profile page="settings" navigate={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Work Hours Management' })
    const remove = within(dialog).getByRole('button', { name: 'Remove Annual Leave' })
    expect(remove.querySelector('img')?.getAttribute('src')).toContain(
      'r4-profile-settings-holiday-remove',
    )
    fireEvent.click(remove)
    expect(
      within(dialog).queryByRole('button', { name: 'Remove Annual Leave' }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByText(/no calendar service is connected/i)).toBeInTheDocument()
  })
})
