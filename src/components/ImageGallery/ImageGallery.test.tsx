import { render, screen } from '@testing-library/react'
import { listImages } from '../../services/storageService'
import type { ImageItem } from '../../types/gallery'
import { ImageGallery } from './ImageGallery'

vi.mock('../../services/storageService', () => ({
  listImages: vi.fn(),
}))

const listImagesMock = vi.mocked(listImages)

const item: ImageItem = {
  id: 'productos/CH-001.jpg',
  name: 'CH-001.jpg',
  url: 'https://example.com/ch-001.jpg',
  fullPath: 'productos/CH-001.jpg',
  createdAt: '2026-01-15T10:00:00Z',
  tag: 'productos',
}

describe('ImageGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el skeleton mientras el listado está en curso (AC1)', () => {
    listImagesMock.mockReturnValue(new Promise(() => {}))
    render(<ImageGallery />)

    expect(screen.getByRole('status', { name: 'Cargando imágenes' })).toBeTruthy()
  })

  it('renderiza las miniaturas cuando el listado resuelve (AC1)', async () => {
    listImagesMock.mockResolvedValue([item])
    render(<ImageGallery />)

    expect(await screen.findByRole('img', { name: 'CH-001.jpg' })).toBeTruthy()
  })

  it('muestra el estado vacío con acceso a la subida cuando no hay imágenes (AC2)', async () => {
    listImagesMock.mockResolvedValue([])
    render(<ImageGallery />)

    expect(await screen.findByText(/no hay imágenes/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /subir imagen/i })).toBeTruthy()
  })

  it('muestra un error visible cuando el listado falla (Cláusula III)', async () => {
    listImagesMock.mockRejectedValue(new Error('permiso denegado'))
    render(<ImageGallery />)

    expect((await screen.findByRole('alert')).textContent).toMatch(/permiso denegado/i)
  })

  it('pasa filterTag al servicio de listado (costura de la feature 003)', async () => {
    listImagesMock.mockResolvedValue([])
    render(<ImageGallery filterTag="productos" />)

    await screen.findByText(/no hay imágenes/i)
    expect(listImagesMock).toHaveBeenCalledWith('productos')
  })
})
