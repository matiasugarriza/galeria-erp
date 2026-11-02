import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { listImages, uploadImage } from '../../services/storageService'
import type { ImageItem } from '../../types/gallery'
import { ImageGallery } from './ImageGallery'

vi.mock('../../services/storageService', () => ({
  listImages: vi.fn(),
  uploadImage: vi.fn(),
}))

const listImagesMock = vi.mocked(listImages)
const uploadImageMock = vi.mocked(uploadImage)

const item: ImageItem = {
  id: 'productos/CH-001.jpg',
  name: 'CH-001.jpg',
  url: 'https://example.com/ch-001.jpg',
  fullPath: 'productos/CH-001.jpg',
  createdAt: '2026-01-15T10:00:00Z',
  tag: 'productos',
}

const secondItem: ImageItem = {
  id: 'productos/nueva.jpg',
  name: 'nueva.jpg',
  url: 'https://example.com/nueva.jpg',
  fullPath: 'productos/nueva.jpg',
  createdAt: '2026-11-02T10:00:00Z',
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

  it('oculta el acceso a subida en modo readOnly, con o sin imágenes (costura de la feature 004)', async () => {
    listImagesMock.mockResolvedValue([item])
    const { unmount } = render(<ImageGallery readOnly />)
    await screen.findByRole('img', { name: 'CH-001.jpg' })
    expect(screen.queryByRole('button', { name: /subir imagen/i })).toBeNull()
    unmount()

    listImagesMock.mockResolvedValue([])
    render(<ImageGallery readOnly />)
    await screen.findByText(/no hay imágenes/i)
    expect(screen.queryByRole('button', { name: /subir imagen/i })).toBeNull()
  })

  it('actualiza la grilla automáticamente tras una subida exitosa (AC1 de la spec 002)', async () => {
    listImagesMock.mockResolvedValueOnce([item]).mockResolvedValue([item, secondItem])
    uploadImageMock.mockResolvedValue('https://example.com/nueva.jpg')
    render(<ImageGallery />)

    await screen.findByRole('img', { name: 'CH-001.jpg' })
    fireEvent.click(screen.getByRole('button', { name: /subir imagen/i }))

    await screen.findByRole('dialog')
    fireEvent.change(screen.getByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [new File(['x'], 'nueva.jpg', { type: 'image/jpeg' })] },
    })

    expect(await screen.findByRole('img', { name: 'nueva.jpg' })).toBeTruthy()
    await waitFor(() => expect(listImagesMock).toHaveBeenCalledTimes(2))
  })
})
