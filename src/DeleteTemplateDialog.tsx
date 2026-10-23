import { Modal } from './ui'

export function DeleteTemplateDialog({
  templateName,
  assignedCount,
  onClose,
  onDelete,
}: {
  templateName: string
  assignedCount?: number
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <Modal title="Delete Template?" className="r5-delete-template-modal" onClose={onClose}>
      <p className="r5-delete-template-copy">
        Are you sure you want to delete “{templateName}”? This action cannot be undone.
        {assignedCount !== undefined &&
          ` This template is currently assigned to ${assignedCount} patients.`}
      </p>
      <footer className="r5-delete-template-actions">
        <button type="button" className="r5-delete-template-cancel" onClick={onClose}>
          cancel
        </button>
        <button type="button" className="r5-delete-template-confirm" onClick={onDelete}>
          Delete template
        </button>
      </footer>
    </Modal>
  )
}
