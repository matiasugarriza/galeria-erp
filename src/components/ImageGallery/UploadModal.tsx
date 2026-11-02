import { useRef, useState } from 'react'
import { UploadCloud, X } from 'lucide-react'
import { uploadImage } from '../../services/storageService'
import type { UploadErrorKind } from '../../types/gallery'

const ALLOWED_EXTENSIONS = ['.jpg', '.png', '.webp']
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const ERROR_MESSAGES: Record<UploadErrorKind, string> = {
  format: 'Formato no soportado. Formatos permitidos: .jpg, .png y .webp.',
  size: 'Archivo demasiado grande. El tamaño máximo es 10 MB.',
  network: 'No se pudo subir la imagen. Verificá la conexión e intentá de nuevo.',
}

interface UploadModalProps {
  open: boolean
  onClose: () => void
  /** Carpeta de contexto ERP a la que se sube el archivo (filterTag). */
  filterTag?: string
  /** Se invoca tras subir exitosamente; la galería refresca la lista (FR-6). */
  onUploaded: () => void
}

/** Modal de subida: zona drag & drop + selección, validación de formato/tamaño y barra de progreso (spec 002). */
export function UploadModal({ open, onClose, filterTag, onUploaded }: UploadModalProps) {
  const [error, setError] = useState<UploadErrorKind | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFile = async (file: File) => {
    if (uploading) return

    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError('format')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('size')
      return
    }

    setError(null)
    setUploading(true)
    setProgress(0)
    try {
      await uploadImage(file, filterTag, setProgress)
      onUploaded()
      onClose()
    } catch {
      setError('network')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Subir imagen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Subir imagen</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={uploading}
            className="rounded p-1 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div
          aria-label="Zona de carga de archivos"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
          className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center"
        >
          <UploadCloud aria-hidden="true" className="size-10 text-gray-400" />
          <p className="text-sm text-gray-600">Arrastrá una imagen aquí</p>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            aria-label="Seleccionar archivo de imagen"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            Seleccionar archivo
          </button>
          <p className="text-xs text-gray-500">Formatos permitidos: .jpg, .png, .webp · Máximo 10 MB</p>
        </div>

        {uploading && (
          <div className="mt-4">
            <div
              role="progressbar"
              aria-label="Progreso de subida"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded bg-gray-200"
            >
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">{progress}%</p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
