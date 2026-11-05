import { useState } from 'react'
import { ImageGallery } from './components/ImageGallery/ImageGallery'
import type { GalleryPhoto } from './types/gallery'

/**
 * Harness de desarrollo (spec 007, FR-13): la galería vive sólo en modo ERP,
 * montada con el contrato del plugin y mostrando las fotos elegidas.
 */
export default function App() {
  const [elegidas, setElegidas] = useState<GalleryPhoto[]>([])

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Galería de Imágenes</h1>

      <ImageGallery onSelect={setElegidas} />

      <section aria-label="Fotos elegidas" className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
        {elegidas.length === 0 ? (
          <p className="text-sm text-blue-900">No hay fotos elegidas.</p>
        ) : (
          <p className="text-sm text-blue-900">
            Elegidas: {elegidas.map((foto) => foto.nombre).join(', ')}
          </p>
        )}
      </section>
    </main>
  )
}
