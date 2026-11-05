import { fireEvent, render, screen } from '@testing-library/react'
import { fetchGalleryPage } from './services/galleryService'
import type { GalleryPhoto } from './types/gallery'
import App from './App'

const mocks = vi.hoisted(() => ({
  fetchGalleryPage: vi.fn(),
  compressImage: vi.fn(),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}))

vi.mock('./services/galleryService', () => ({
  PAGE_SIZE: 24,
  fetchGalleryPage: mocks.fetchGalleryPage,
}))
vi.mock('./services/storageService', () => ({
  compressImage: mocks.compressImage,
  uploadImage: mocks.uploadImage,
  deleteImage: mocks.deleteImage,
}))

const foto: GalleryPhoto = {
  id: 'migradas__CH-999',
  codigo: 'CH-999',
  nombre: 'CH-999.png',
  carpeta: 'migradas',
  url: 'https://example.com/CH-999.webp',
  thumbUrl: 'https://example.com/thumbs/CH-999.webp',
  fullPath: 'migradas/CH-999.webp',
  vista: 'frente',
  origen: 'corel',
  basadaEn: null,
  estado: 'aprobada',
  creadoEn: new Date('2026-01-02T00:00:00Z'),
}

describe('App (harness sólo modo ERP, FR-13)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fetchGalleryPage).mockResolvedValue({ fotos: [foto], cursor: null })
  })

  it('monta la galería en modo ERP y lista las fotos elegidas (FR-13)', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Galería de Imágenes' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /modo standalone/i })).toBeNull()
    await screen.findByRole('img', { name: 'CH-999.png' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tildar CH-999.png' }))

    expect(await screen.findByText(/Elegidas: CH-999\.png/)).toBeTruthy()
  })
})
