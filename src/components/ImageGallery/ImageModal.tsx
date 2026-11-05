import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { GalleryPhoto } from '../../types/gallery'

interface ImageModalProps {
  foto: GalleryPhoto
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

/**
 * Lightbox de sólo lectura (spec 007, FR-10): muestra la imagen completa (la
 * grande se descarga recién al abrir) con nombre, código y fecha. Se cierra con
 * el botón, la tecla `Esc` o un clic fuera del contenido.
 */
export function ImageModal({ foto, onClose }: ImageModalProps) {
  useEffect(() => {
    const alPresionar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${foto.nombre}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl"
      >
        <button
          type="button"
          aria-label="Cerrar vista previa"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-600 shadow-sm transition-colors duration-200 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <X aria-hidden="true" className="size-5" />
        </button>

        <img
          src={foto.url}
          alt={foto.nombre}
          className="mx-auto max-h-[75vh] w-auto rounded object-contain"
        />

        <div className="mt-3 space-y-0.5 text-center">
          <p className="text-sm font-medium text-gray-900">{foto.nombre}</p>
          {foto.codigo && <p className="text-xs font-semibold text-gray-600">{foto.codigo}</p>}
          <p className="text-xs text-gray-500">{dateFormatter.format(foto.creadoEn)}</p>
        </div>
      </div>
    </div>
  )
}
