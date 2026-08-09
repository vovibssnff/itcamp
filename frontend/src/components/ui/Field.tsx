import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  variant?: 'underline' | 'box'
  error?: string
}

export function Field({ label, variant = 'box', error, className = '', ...rest }: FieldProps) {
  const cls = variant === 'underline' ? 'fld' : 'fld-box'
  return (
    <div className="fld-group">
      {label && <label className="fld-lbl">{label}</label>}
      <input className={[cls, className].filter(Boolean).join(' ')} {...rest} />
      {error && (
        <span
          style={{
            display: 'block',
            marginTop: 4,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--alarm)',
            letterSpacing: '0.08em',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function TextArea({ label, error, className = '', ...rest }: TextAreaProps) {
  return (
    <div className="fld-group">
      {label && <label className="fld-lbl">{label}</label>}
      <textarea
        className={['fld-box', className].filter(Boolean).join(' ')}
        style={{ resize: 'vertical', minHeight: 80 }}
        {...rest}
      />
      {error && (
        <span
          style={{
            display: 'block',
            marginTop: 4,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--alarm)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

interface FieldLabelProps {
  children: ReactNode
  htmlFor?: string
}

export function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label className="fld-lbl" htmlFor={htmlFor}>
      {children}
    </label>
  )
}
