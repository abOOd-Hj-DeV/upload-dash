import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { Sessions } from '../src/Sessions'
import { closurePortraitAssets } from '../src/closure-portrait-assets'

const styles = readFileSync('src/visual-session-list-final.css', 'utf8')

beforeEach(() => {
  window.history.replaceState({}, '', '/sessions')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('final session list source contracts (not UI acceptance)', () => {
  it('wires eleven desktop/tablet portraits and the seven documented phone identities', () => {
    render(<Sessions navigate={vi.fn()} />)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    closurePortraitAssets.sessions.desktopTablet.forEach((portrait, index) => {
      const avatar =
        rows[index].querySelector('.session-desktop-portrait .avatar') ??
        rows[index].querySelector('.avatar')
      expect(rows[index]).toHaveTextContent(portrait.target.name)
      expect(avatar?.querySelector('img')).toHaveAttribute('src', `/assets/${portrait.image}`)
      if (portrait.crop) expect(avatar).toHaveClass(portrait.crop)
    })
    closurePortraitAssets.sessions.phone.forEach((portrait, index) => {
      const avatar =
        rows[index].querySelector('.session-phone-portrait .avatar') ??
        rows[index].querySelector('.avatar')
      expect(avatar?.querySelector('img')).toHaveAttribute('src', `/assets/${portrait.image}`)
      if (portrait.crop) expect(avatar).toHaveClass(portrait.crop)
    })
    expect(rows.slice(7).every((row) => !row.querySelector('.session-phone-portrait'))).toBe(true)
    expect(styles).toMatch(/\.final-session-list \.session-phone-portrait\s*\{\s*display: none;/)
    const phone = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phone).toMatch(/\.final-session-list \.session-desktop-portrait\s*\{\s*display: none;/)
    expect(phone).toMatch(/\.final-session-list \.session-phone-portrait\s*\{\s*display: block;/)
  })

  it('keeps portrait identities attached to their session through filtering', () => {
    render(<Sessions navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Previous (6)' }))
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Sara Muhammad')
    expect(rows[0].querySelector('.avatar img')).toHaveAttribute(
      'src',
      '/assets/dashboard-imgContainer3.png',
    )
    expect(rows[2]).toHaveTextContent('Jad Matcha')
    expect(rows[2].querySelector('.avatar')).toHaveClass('jad')
    expect(rows[2].querySelector('.avatar img')).toHaveAttribute(
      'src',
      '/assets/dashboard-imgContainer4.png',
    )
  })

  it('keeps both source Noor rows as group sessions while preserving the other session types', () => {
    render(<Sessions navigate={vi.fn()} />)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(16)
    expect(rows.slice(0, 11).map((row) => row.querySelector('small')?.textContent)).toEqual([
      ...Array<string>(7).fill('Private Session'),
      'Follow-up Session',
      'Initial Consultation',
      'Group Session',
      'Group Session',
    ])
    expect(within(rows[9]).getByText('Noor Al-Khatib')).toBeInTheDocument()
    expect(within(rows[10]).getByText('Noor Al-Khatib')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Upcoming (8)' }))
    expect(screen.getAllByText('Group Session')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Upcoming (8)' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('repairs panel bounds without changing the existing desktop/tablet row pitch', () => {
    const { container } = render(<Sessions navigate={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'All Sessions' })).toHaveClass('final-session-list')
    expect(container.querySelector('.final-session-list .sessions-list-scroll table')).toBeTruthy()
    expect(styles).toMatch(/\.demo-all-sessions\.final-session-list\s*\{[^}]*padding:\s*16px;/)
    expect(styles).toMatch(
      /@media \(min-width: 601px\)[\s\S]*?\.secondary-topbar\s*\{[^}]*height:\s*68px;/,
    )
    expect(styles).toMatch(
      /\.final-session-list \.sessions-list-scroll\s*\{[^}]*max-height:\s*max\(500px, calc\(100svh - 212px\)\);/,
    )
    expect(styles).not.toMatch(/border-spacing:|\btd\s*\{[^}]*height:/)
  })

  it('removes only the extra phone inset and patient-button padding, retaining all patients', () => {
    render(<Sessions navigate={vi.fn()} />)
    const phone = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phone).toMatch(/\.demo-all-sessions\.final-session-list\s*\{[^}]*margin-inline:\s*0;/)
    expect(phone).toMatch(
      /\.final-session-list \.all-sessions-table \.patient-cell\s*\{[^}]*gap:\s*4px;[^}]*padding-block:\s*0;/,
    )
    expect(phone).toMatch(/\.final-session-list \.patient-name\s*\{[^}]*overflow-wrap:\s*anywhere;/)
    expect(screen.getByText('Fahad Al Ali')).toBeInTheDocument()
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(16)
    // Only alternate decorative photos switch at 600px; no patient content may be hidden.
    const contentStyles = styles.replace(
      /\.final-session-list \.session-(?:phone|desktop)-portrait\s*\{[^}]*\}/g,
      '',
    )
    expect(contentStyles).not.toMatch(/overflow:\s*(hidden|clip)|transform:|zoom:|display:\s*none/)
  })

  it('reuses the teal calendar only in compact navigation and leaves active semantics intact', () => {
    window.history.replaceState({}, '', '/sessions?state=collapsed')
    render(<Sessions navigate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
    const icon = 'preview-client-list-calendar.svg'
    expect(existsSync(`public/assets/${icon}`)).toBe(true)
    expect(readFileSync(`public/assets/${icon}`, 'utf8')).toContain('stroke="#1D919E"')
    expect(styles).toContain(`content: url('/assets/${icon}')`)
    expect(styles).toContain('.demo-workspace.is-collapsed:has(.final-session-list)')
    expect(styles).toContain('.demo-workspace:not(.is-expanded):has(.final-session-list)')
  })
})
