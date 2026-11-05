import { Trash2 } from 'lucide-react'
import type { GalleryPhoto } from '../../types/gallery'

interface GalleryGridProps {
  fotos: GalleryPhoto[]
  /** Ids de las fotos tildadas para la ficha técnica (FR-11). */
  seleccionadas?: ReadonlySet<string>
  /** Alterna el tilde de una foto aprobada (FR-11). */
  onToggleSeleccion?: (foto: GalleryPhoto) => void
  /** Abre la vista previa en grande (FR-10). */
  onPreview?: (foto: GalleryPhoto) => void
  /** Presente sólo con permisos de edición; renderiza el botón de eliminar (FR-16). */
  onDelete?: (foto: GalleryPhoto) => void
  /** Modo lectura: oculta tilde y borrado. */
  readOnly?: boolean
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

/**
 * Grilla responsiva mobile-first (1 col en móvil hasta 5 en pantallas grandes).
 * Cada tarjeta muestra la miniatura WebP con respaldo a la imagen completa,
 * nombre, fecha y código; el tilde queda bloqueado para las fotos "para revisar".
 */
export function GalleryGrid({
  fotos,
  seleccionadas,
  onToggleSeleccion,
  onPreview,
  onDelete,
  readOnly = false,
}: GalleryGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {fotos.map((foto) => {
        const seleccionada = seleccionadas?.has(foto.id) ?? false
        const paraRevisar = foto.estado !== 'aprobada'

        return (
          <li key={foto.id} className="relative">
            <div className="rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md">
              <button
                type="button"
                onClick={() => onPreview?.(foto)}
                aria-label={`Ampliar ${foto.nombre}`}
                className="group block w-full rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <img
                  src={foto.thumbUrl || foto.url}
                  alt={foto.nombre}
                  loading="lazy"
                  onError={(event) => {
                    const imagen = event.currentTarget
                    // Una sola caída a la imagen completa, sin bucles si también falla.
                    if (imagen.dataset.respaldo === 'true') return
                    imagen.dataset.respaldo = 'true'
                    imagen.src = foto.url
                  }}
                  className="aspect-[4/3] w-full rounded object-cover"
                />
              </button>

              <div className="mt-2 space-y-0.5">
                <p className="truncate text-sm font-medium text-gray-800">{foto.nombre}</p>
                {foto.codigo && (
                  <p className="truncate text-xs font-semibold text-gray-600">{foto.codigo}</p>
                )}
                <p className="text-xs text-gray-500">{dateFormatter.format(foto.creadoEn)}</p>
                {paraRevisar && (
                  <p className="text-xs font-medium text-amber-700">Para revisar</p>
                )}
              </div>
            </div>

            {!readOnly && (
              <label className="absolute left-3 top-3 flex items-center gap-1 rounded bg-white/90 px-2 py-1 shadow-sm">
                <input
                  type="checkbox"
                  aria-label={`Tildar ${foto.nombre}`}
                  checked={seleccionada}
                  disabled={paraRevisar}
                  onChange={() => onToggleSeleccion?.(foto)}
                  className="size-4 accent-blue-600 disabled:opacity-50"
                />
              </label>
            )}

            {!readOnly && onDelete && (
              <button
                type="button"
                aria-label={`Eliminar ${foto.nombre}`}
                onClick={() => onDelete(foto)}
                className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
