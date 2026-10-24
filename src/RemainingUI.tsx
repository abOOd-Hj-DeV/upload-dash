import type { ReactNode } from 'react'
import { asset } from './assets'
import { remainingAssets } from './remaining-assets'
import './visual-profile-wallet.css'
import './visual-help-final.css'

export type RemainingIconName = keyof typeof remainingAssets

const figmaIconOverrides: Partial<Record<RemainingIconName, string>> = {
  helpArrow: 'r4-help-chevron-right.svg',
}

export function RemainingIcon({ name }: { name: RemainingIconName }) {
  return (
    <span className="remaining-icon" data-icon={name} aria-hidden="true">
      <picture>
        {`${name}Mobile` in remainingAssets && (
          <source
            media="(max-width: 600px)"
            srcSet={asset(remainingAssets[`${name}Mobile` as RemainingIconName])}
          />
        )}
        <img src={asset(figmaIconOverrides[name] ?? remainingAssets[name])} alt="" />
      </picture>
    </span>
  )
}

export function FaqSummary({ children }: { children: ReactNode }) {
  return (
    <summary>
      <span>{children}</span>
      <span className="faq-open-arrow"><RemainingIcon name="faqOpen" /></span>
      <span className="faq-closed-arrow"><RemainingIcon name="faqClosed" /></span>
    </summary>
  )
}

export function FormActions({
  onClose,
  label = 'Save Changes',
  cancelLabel = 'Cancel',
}: {
  onClose: () => void
  label?: string
  cancelLabel?: string
}) {
  return (
    <footer className="remaining-form-actions">
      <button type="button" className="remaining-cancel" onClick={onClose}>
        {cancelLabel}
      </button>
      <button className="remaining-primary" type="submit">
        {label}
      </button>
    </footer>
  )
}

export function SettingRow({
  icon,
  title,
  detail,
  badge,
  onClick,
  chevron = 'arrow',
}: {
  icon: RemainingIconName
  title: string
  detail?: string
  badge?: ReactNode
  onClick: () => void
  chevron?: RemainingIconName
}) {
  return (
    <button className="remaining-setting-row" onClick={onClick}>
      <RemainingIcon name={icon} />
      <span className="setting-row-copy">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {badge && <span className="remaining-badge">{badge}</span>}
      <RemainingIcon name={chevron} />
    </button>
  )
}
