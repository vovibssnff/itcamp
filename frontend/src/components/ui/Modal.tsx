import { useEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number | string
  style?: CSSProperties
}

export function Modal({ open, onClose, title, children, footer, width = 520, style }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" style={{ maxWidth: width, ...style }}>
        {title !== undefined && (
          <div className="sheet-hd">
            <span className="h3">{title}</span>
            <button className="x" onClick={onClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        )}
        <div className="sheet-bd">{children}</div>
        {footer && <div className="sheet-ft">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
