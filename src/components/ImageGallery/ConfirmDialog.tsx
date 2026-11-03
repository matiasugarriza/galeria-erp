interface ConfirmDialogProps {
  open: boolean
  /** Pregunta completa mostrada al usuario (spec 005, FR-1). */
  message: string
  /** Deshabilita los botones mientras la eliminación está en curso. */
  confirming?: boolean
  /** Error visible de la eliminación en curso (Cláusula III). */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** Modal de diálogo de confirmación previo a una acción destructiva (spec 005, T003). */
export function ConfirmDialog({
  open,
  message,
  confirming = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <p className="text-sm text-gray-700">{message}</p>

        {error && (
          <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
