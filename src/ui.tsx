import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { asset } from './assets'
import './visual-auth-shell.css'

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <img className={`icon ${className}`} src={asset(name)} alt="" aria-hidden="true" />
}

export function Logo({ wordmark = false }: { wordmark?: boolean }) {
  return (
    <span className="brand" aria-label="Sakina">
      <span className="brand-symbol">
        <img src={asset('auth-imgRectangle6.png')} alt="" />
      </span>
      {wordmark && (
        <img className="brand-wordmark" src={asset('dashboard-imgLabel.png')} alt="Sakina" />
      )}
    </span>
  )
}

function isInsideDialog(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return true
  const rect = event.currentTarget.getBoundingClientRect()
  return (
    event.clientX >= rect.left &&
    event.clientX < rect.right &&
    event.clientY >= rect.top &&
    event.clientY < rect.bottom
  )
}

export function Modal({
  title,
  children,
  onClose,
  className = '',
  closeIcon,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
  closeIcon?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const pointerOrigin = useRef<{ startedInside: boolean; endedInside: boolean } | null>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement as HTMLElement | null
    let cancelled = false
    const show = () => {
      if (!cancelled) dialog.showModal()
    }
    if (document.fonts) void document.fonts.ready.then(show)
    else show()
    function containFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      )
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    dialog.addEventListener('keydown', containFocus)
    return () => {
      cancelled = true
      dialog.removeEventListener('keydown', containFocus)
      dialog.close()
      previousFocus?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onPointerDownCapture={(event) => {
        pointerOrigin.current = { startedInside: isInsideDialog(event), endedInside: false }
      }}
      onPointerUpCapture={(event) => {
        if (pointerOrigin.current) pointerOrigin.current.endedInside = isInsideDialog(event)
      }}
      onPointerCancelCapture={() => {
        pointerOrigin.current = null
      }}
      onClick={(event) => {
        const origin = pointerOrigin.current
        pointerOrigin.current = null
        if (!isInsideDialog(event) && !origin?.startedInside && !origin?.endedInside) onClose()
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          {closeIcon ?? '×'}
        </button>
      </div>
      {children}
    </dialog>
  )
}
