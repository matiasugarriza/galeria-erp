import type { GalleryPhoto } from '../types/gallery'
import { compressImage, deleteImage, uploadImage } from './storageService'

const mocks = vi.hoisted(() => ({
  comprimir: vi.fn(),
  deleteObject: vi.fn(),
  uploadBytesResumable: vi.fn(),
  ref: vi.fn((_storage: unknown, ruta: string) => ({ fullPath: ruta })),
  getStorage: vi.fn(() => ({ bucket: 'fake' })),
}))

vi.mock('browser-image-compression', () => ({ default: mocks.comprimir }))
vi.mock('firebase/storage', () => ({
  deleteObject: mocks.deleteObject,
  ref: mocks.ref,
  uploadBytesResumable: mocks.uploadBytesResumable,
  getStorage: mocks.getStorage,
}))
vi.mock('../config/firebase', () => ({
  db: { app: 'fake' },
  getFirebaseApp: vi.fn(() => ({ name: 'fake-app' })),
}))

function foto(): GalleryPhoto {
  return {
    id: 'migradas__CH-001',
    codigo: 'CH-001',
    nombre: 'CH-001.webp',
    carpeta: 'migradas',
    url: 'https://example.com/CH-001.webp',
    thumbUrl: 'https://example.com/thumbs/CH-001.webp',
    fullPath: 'migradas/CH-001.webp',
    vista: 'frente',
    origen: 'corel',
    basadaEn: null,
    estado: 'aprobada',
    creadoEn: new Date('2026-01-15T10:00:00Z'),
  }
}

describe('storageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('comprime en el navegador antes de subir conservando el tipo original (FR-7)', async () => {
    const png = new File(['x'], 'foto.png', { type: 'image/png' })
    const comprimido = new File(['y'], 'foto.png', { type: 'image/png' })
    mocks.comprimir.mockResolvedValue(comprimido)

    await expect(compressImage(png)).resolves.toBe(comprimido)

    expect(mocks.comprimir).toHaveBeenCalledWith(png, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 1,
      useWebWorker: true,
      fileType: 'image/png',
    })
  })

  it('sube con contentType del archivo y cacheControl de un año reportando progreso (FR-6, FR-7)', async () => {
    const tarea = {
      on: vi.fn(
        (
          _evento: string,
          siguiente: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
          _error: (error: Error) => void,
          completado: () => void,
        ) => {
          siguiente({ bytesTransferred: 50, totalBytes: 100 })
          completado()
        },
      ),
    }
    mocks.uploadBytesResumable.mockReturnValue(tarea)
    const archivo = new File(['x'], 'foto.webp', { type: 'image/webp' })
    const progreso = vi.fn()

    await expect(uploadImage(archivo, progreso)).resolves.toBeUndefined()

    expect(mocks.ref).toHaveBeenCalledWith({ bucket: 'fake' }, 'foto.webp')
    expect(mocks.uploadBytesResumable).toHaveBeenCalledWith(
      { fullPath: 'foto.webp' },
      archivo,
      { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' },
    )
    expect(progreso).toHaveBeenCalledWith(50)
  })

  it('elimina el objeto por el fullPath de la foto (FR-16, lado cliente)', async () => {
    mocks.deleteObject.mockResolvedValue(undefined)

    await deleteImage(foto())

    expect(mocks.ref).toHaveBeenCalledWith({ bucket: 'fake' }, 'migradas/CH-001.webp')
    expect(mocks.deleteObject).toHaveBeenCalledWith({ fullPath: 'migradas/CH-001.webp' })
  })
})
