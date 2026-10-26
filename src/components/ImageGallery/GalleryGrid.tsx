import type { ImageItem } from '../../types/gallery'

interface GalleryGridProps {
  items: ImageItem[]
  /** Se ejecuta al hacer clic en una miniatura (feature 004: onSelectImage). */
  onSelect?: (item: ImageItem) => void
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

/** Grilla responsiva mobile-first: 1 col en móvil hasta 5 cols en pantallas grandes. */
export function GalleryGrid({ items, onSelect }: GalleryGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect?.(item)}
            aria-label={`Seleccionar imagen ${item.name}`}
            className="group w-full rounded-lg border border-gray-200 bg-white p-2 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <img
              src={item.url}
              alt={item.name}
              loading="lazy"
              className="aspect-[4/3] w-full rounded object-cover"
            />
            <p className="mt-2 truncate text-sm font-medium text-gray-800">{item.name}</p>
            <p className="text-xs text-gray-500">{dateFormatter.format(new Date(item.createdAt))}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}
