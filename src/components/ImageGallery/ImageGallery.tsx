import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ImageOff, Search, Upload } from 'lucide-react'
import { deleteImage, listImages } from '../../services/storageService'
import type { ImageGalleryProps, ImageItem } from '../../types/gallery'
import { ConfirmDialog } from './ConfirmDialog'
import { GalleryGrid } from './GalleryGrid'
import { matchesSearch } from './searchUtils'
import { UploadModal } from './UploadModal'

type GalleryState =
  | { status: 'loading' }
  | { status: 'ready'; items: ImageItem[] }
  | { status: 'error'; message: string }

/** Componente raíz: orquesta la carga desde Firebase Storage, los estados de la vista, la subida y la eliminación (specs 001, 002, 003 y 005). */
export function ImageGallery({
  filterTag,
  readOnly = false,
  onDeleteImage,
  onSelectImage,
  onUploadSuccess,
}: ImageGalleryProps) {
  const [state, setState] = useState<GalleryState>({ status: 'loading' })
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ImageItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
    // Al cambiar de contexto ERP (filterTag) se limpia la búsqueda activa.
    setSearchTerm('')

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

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleting) return
    const target = pendingDelete
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteImage(target.fullPath)
      // Remoción inmediata de la miniatura sin refetch (spec 005, FR-3).
      setState((previous) =>
        previous.status === 'ready'
          ? { status: 'ready', items: previous.items.filter((entry) => entry.id !== target.id) }
          : previous,
      )
      onDeleteImage?.(target.id)
      setPendingDelete(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      setDeleteError(`No se pudo eliminar la imagen: ${message}`)
    } finally {
      setDeleting(false)
    }
  }

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
  const visibleItems = state.items.filter((item) => matchesSearch(item.name, searchTerm))
  const uploadButtonClass =
    'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

  return (
    <div>
      {!isEmpty && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              aria-label="Buscar imágenes"
              placeholder="Buscar por nombre…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            />
          </div>
          {!readOnly && (
            <div className="sm:ml-auto">
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
      ) : visibleItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No se encontraron imágenes que coincidan con “{searchTerm}”.
        </p>
      ) : (
        <GalleryGrid
          items={visibleItems}
          onSelect={onSelectImage}
          onDelete={
            readOnly
              ? undefined
              : (target) => {
                  setDeleteError(null)
                  setPendingDelete(target)
                }
          }
        />
      )}

      <UploadModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        filterTag={filterTag}
        onUploaded={(url) => {
          void refresh()
          onUploadSuccess?.(url)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`¿Eliminar “${pendingDelete?.name ?? ''}”? Esta acción no se puede deshacer.`}
        confirming={deleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (deleting) return
          setPendingDelete(null)
          setDeleteError(null)
        }}
      />
    </div>
  )
}
