import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ImageOff, Upload } from 'lucide-react'
import { listImages } from '../../services/storageService'
import type { ImageGalleryProps, ImageItem } from '../../types/gallery'
import { GalleryGrid } from './GalleryGrid'
import { UploadModal } from './UploadModal'

type GalleryState =
  | { status: 'loading' }
  | { status: 'ready'; items: ImageItem[] }
  | { status: 'error'; message: string }

/** Componente raíz: orquesta la carga desde Firebase Storage, los estados de la vista y la subida (specs 001, 002 y 003). */
export function ImageGallery({ filterTag, readOnly = false }: ImageGalleryProps) {
  const [state, setState] = useState<GalleryState>({ status: 'loading' })
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  // Refresco silencioso tras una subida: la grilla se actualiza sola (spec 002, FR-3).
  const refresh = useCallback(async () => {
    try {
      const items = await listImages(filterTag)
      setState({ status: 'ready', items })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      setState({ status: 'error', message })
    }
  }, [filterTag])

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    listImages(filterTag)
      .then((items) => {
        if (!cancelled) setState({ status: 'ready', items })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Error desconocido'
        setState({ status: 'error', message })
      })

    // Limpieza del listener en vuelo (Cláusula III: evitar fugas/actualizaciones tras desmontar).
    return () => {
      cancelled = true
    }
  }, [filterTag])

  if (state.status === 'loading') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Cargando imágenes"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-[4/3] animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center"
      >
        <AlertTriangle aria-hidden="true" className="size-8 text-red-500" />
        <p className="text-sm font-medium text-red-800">
          No se pudieron cargar las imágenes: {state.message}
        </p>
      </div>
    )
  }

  const isEmpty = state.items.length === 0
  const uploadButtonClass =
    'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

  return (
    <div>
      {!isEmpty && !readOnly && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            aria-label="Subir imagen"
            onClick={() => setIsUploadOpen(true)}
            className={uploadButtonClass}
          >
            <Upload aria-hidden="true" className="size-4" />
            Subir Imagen
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <ImageOff aria-hidden="true" className="size-10 text-gray-400" />
          <p className="text-sm text-gray-600">No hay imágenes en esta galería todavía.</p>
          {!readOnly && (
            <button
              type="button"
              aria-label="Subir imagen"
              onClick={() => setIsUploadOpen(true)}
              className={uploadButtonClass}
            >
              <Upload aria-hidden="true" className="size-4" />
              Subir Imagen
            </button>
          )}
        </div>
      ) : (
        <GalleryGrid items={state.items} />
      )}

      <UploadModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        filterTag={filterTag}
        onUploaded={() => void refresh()}
      />
    </div>
  )
}
