import { ImageGallery } from './components/ImageGallery/ImageGallery'

/** Demo en Modo Standalone: funciona sin props de integración (fallbacks por defecto). */
export default function App() {
  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Galería de Imágenes</h1>
      <ImageGallery />
    </main>
  )
}
