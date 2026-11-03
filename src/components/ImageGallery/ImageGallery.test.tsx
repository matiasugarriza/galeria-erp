import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deleteImage, listImages, uploadImage } from '../../services/storageService'
import type { ImageItem } from '../../types/gallery'
import { ImageGallery } from './ImageGallery'

vi.mock('../../services/storageService', () => ({
  listImages: vi.fn(),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}))

const listImagesMock = vi.mocked(listImages)
const uploadImageMock = vi.mocked(uploadImage)
const deleteImageMock = vi.mocked(deleteImage)

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

const accentItem: ImageItem = {
  id: 'productos/AÑO-2026.jpg',
  name: 'AÑO-2026.jpg',
  url: 'https://example.com/ano-2026.jpg',
  fullPath: 'productos/AÑO-2026.jpg',
  createdAt: '2026-11-01T10:00:00Z',
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
    expect(screen.queryByRole('button', { name: /^eliminar /i })).toBeNull()
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

  it('filtra la grilla en tiempo real según el texto de búsqueda, sin distinguir mayúsculas ni acentos (AC1, FR-1 de la spec 003)', async () => {
    listImagesMock.mockResolvedValue([item, secondItem, accentItem])
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.jpg' })

    const search = screen.getByLabelText('Buscar imágenes')

    fireEvent.change(search, { target: { value: 'ch-001' } })
    expect(screen.getByRole('img', { name: 'CH-001.jpg' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'nueva.jpg' })).toBeNull()

    fireEvent.change(search, { target: { value: 'ano-2026' } })
    expect(screen.getByRole('img', { name: 'AÑO-2026.jpg' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'CH-001.jpg' })).toBeNull()

    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByRole('img', { name: 'CH-001.jpg' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'nueva.jpg' })).toBeTruthy()
  })

  it('muestra un aviso cuando la búsqueda no tiene coincidencias (AC1 de la spec 003)', async () => {
    listImagesMock.mockResolvedValue([item])
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.jpg' })

    fireEvent.change(screen.getByLabelText('Buscar imágenes'), { target: { value: 'zzz' } })

    expect(screen.queryByRole('img', { name: 'CH-001.jpg' })).toBeNull()
    expect(screen.getByText(/no se encontraron imágenes/i)).toBeTruthy()
  })

  it('no ejecuta la eliminación sin confirmación en el modal de diálogo (AC1 de la spec 005)', async () => {
    listImagesMock.mockResolvedValue([item])
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.jpg' })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar CH-001.jpg' }))
    await screen.findByRole('dialog', { name: 'Confirmar eliminación' })

    expect(deleteImageMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deleteImageMock).not.toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'CH-001.jpg' })).toBeTruthy()
  })

  it('elimina el archivo, remueve la miniatura de inmediato y notifica onDeleteImage al confirmar (AC1, FR-2, FR-3 de la spec 005)', async () => {
    listImagesMock.mockResolvedValue([item, secondItem])
    deleteImageMock.mockResolvedValue()
    const onDeleteImage = vi.fn()
    render(<ImageGallery onDeleteImage={onDeleteImage} />)
    await screen.findByRole('img', { name: 'CH-001.jpg' })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar CH-001.jpg' }))
    await screen.findByRole('dialog', { name: 'Confirmar eliminación' })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(deleteImageMock).toHaveBeenCalledWith('productos/CH-001.jpg'))
    await waitFor(() => expect(onDeleteImage).toHaveBeenCalledWith('productos/CH-001.jpg'))
    expect(screen.queryByRole('img', { name: 'CH-001.jpg' })).toBeNull()
    expect(screen.getByRole('img', { name: 'nueva.jpg' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('muestra el error de eliminación visible y conserva la miniatura cuando deleteObject falla (T007, Cláusula III)', async () => {
    listImagesMock.mockResolvedValue([item])
    deleteImageMock.mockRejectedValue(new Error('permiso denegado'))
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.jpg' })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar CH-001.jpg' }))
    await screen.findByRole('dialog', { name: 'Confirmar eliminación' })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/permiso denegado/i)
    expect(screen.getByRole('img', { name: 'CH-001.jpg' })).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Confirmar eliminación' })).toBeTruthy()
  })
})
