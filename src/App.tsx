import { useState } from 'react'
import { ImageGallery } from './components/ImageGallery/ImageGallery'
import type { ImageItem } from './types/gallery'

/** Demo dual-mode (spec 004, T008): el mismo código base opera sin props (standalone)
 * y embebido como complemento ERP con filterTag y callbacks. */
export default function App() {
  const [selected, setSelected] = useState<ImageItem | null>(null)
  const [lastUploadUrl, setLastUploadUrl] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Galería de Imágenes</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Modo Standalone</h2>
        <ImageGallery />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Modo ERP (plugin con props)
        </h2>
        <ImageGallery
          filterTag="migradas"
          onSelectImage={(image) => setSelected(image)}
          onUploadSuccess={(url) => setLastUploadUrl(url)}
        />
        {(selected || lastUploadUrl) && (
          <div role="status" className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {selected && (
              <p>
                Seleccionada: {selected.name} ({selected.id})
              </p>
            )}
            {lastUploadUrl && <p>Última subida: {lastUploadUrl}</p>}
          </div>
        )}
      </section>
    </main>
  )
}
