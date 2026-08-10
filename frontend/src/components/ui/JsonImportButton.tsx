import { useRef, useState } from 'react'
import { UploadOutlined } from '@ant-design/icons'
import { message } from 'antd'

interface JsonImportButtonProps {
  label: string
  onImport: (data: unknown) => Promise<void>
  className?: string
}

/** Hidden file input + button for JSON library/template/scenario imports. */
export function JsonImportButton({
  label,
  onImport,
  className = 'btn btn-ghost',
}: JsonImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const text = await file.text()
      const data: unknown = JSON.parse(text)
      await onImport(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка импорта'
      void message.error(msg)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        data-testid="json-import-input"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <button
        type="button"
        className={className}
        data-testid="json-import-button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadOutlined /> {busy ? 'Импорт…' : label}
      </button>
    </>
  )
}
