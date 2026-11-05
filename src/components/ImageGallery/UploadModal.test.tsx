import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { compressImage, uploadImage } from '../../services/storageService'
import { UploadModal } from './UploadModal'

const mocks = vi.hoisted(() => ({
  compressImage: vi.fn(),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}))

vi.mock('../../services/storageService', () => ({
  compressImage: mocks.compressImage,
  uploadImage: mocks.uploadImage,
  deleteImage: mocks.deleteImage,
}))

const compressImageMock = vi.mocked(compressImage)
const uploadImageMock = vi.mocked(uploadImage)

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onUploaded: vi.fn(),
}

function archivo(nombre = 'foto.jpg', tipo = 'image/jpeg'): File {
  return new File(['contenido'], nombre, { type: tipo })
}

function elegir(archivoElegido: File): void {
  fireEvent.change(screen.getByLabelText('Seleccionar archivo de imagen'), {
    target: { files: [archivoElegido] },
  })
}

describe('UploadModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    compressImageMock.mockImplementation((file) => Promise.resolve(file))
  })

  it('acepta JPG, PNG, WebP y HEIC en el input (FR-14)', () => {
    render(<UploadModal {...baseProps} />)

    const input = screen.getByLabelText('Seleccionar archivo de imagen')
    expect(input.getAttribute('accept')).toMatch(/\.jpg/)
    expect(input.getAttribute('accept')).toMatch(/\.png/)
    expect(input.getAttribute('accept')).toMatch(/\.webp/)
    expect(input.getAttribute('accept')).toMatch(/\.heic/)
  })

  it('bloquea formatos no soportados con un mensaje visible (FR-14)', () => {
    render(<UploadModal {...baseProps} />)

    elegir(new File(['x'], 'documento.pdf', { type: 'application/pdf' }))

    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toMatch(/formatos permitidos/i)
    expect(alerta.textContent).toMatch(/\.jpg.*\.png.*\.webp.*\.heic/i)
    expect(compressImageMock).not.toHaveBeenCalled()
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('bloquea archivos mayores a 10 MB sin comprimir ni subir (FR-7)', () => {
    render(<UploadModal {...baseProps} />)

    elegir(new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'grande.heic', { type: 'image/heic' }))

    expect(screen.getByRole('alert').textContent).toMatch(/10 MB/i)
    expect(compressImageMock).not.toHaveBeenCalled()
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('acepta HEIC comprimiendo antes de subir (FR-14)', async () => {
    uploadImageMock.mockResolvedValue(undefined)
    render(<UploadModal {...baseProps} />)

    const heic = archivo('foto.heic', 'image/heic')
    elegir(heic)

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledTimes(1))
    expect(compressImageMock).toHaveBeenCalledWith(heic)
  })

  it('comprime antes de subir, muestra el progreso y notifica al completar (FR-7, FR-8)', async () => {
    const comprimido = new File(['comprimido'], 'foto.jpg', { type: 'image/jpeg' })
    compressImageMock.mockResolvedValue(comprimido)
    let resolver: () => void = () => {}
    uploadImageMock.mockImplementation((_file, onProgress) => {
      onProgress?.(42)
      return new Promise<void>((resolve) => {
        resolver = resolve
      })
    })
    const onUploaded = vi.fn()
    const onUploadStart = vi.fn()
    const onClose = vi.fn()
    render(
      <UploadModal
        {...baseProps}
        onClose={onClose}
        onUploaded={onUploaded}
        onUploadStart={onUploadStart}
      />,
    )

    const original = archivo('foto.jpg')
    elegir(original)

    const barra = await screen.findByRole('progressbar', { name: 'Progreso de subida' })
    await waitFor(() => expect(barra.getAttribute('aria-valuenow')).toBe('42'))
    expect(onUploadStart).toHaveBeenCalledWith(original)
    expect(uploadImageMock).toHaveBeenCalledWith(comprimido, expect.any(Function))

    resolver()
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(original))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('acepta archivos arrastrados a la zona de carga (FR-8)', async () => {
    uploadImageMock.mockResolvedValue(undefined)
    render(<UploadModal {...baseProps} />)

    fireEvent.drop(screen.getByLabelText('Zona de carga de archivos'), {
      dataTransfer: { files: [archivo('arrastrada.webp', 'image/webp')] },
    })

    await waitFor(() => expect(uploadImageMock).toHaveBeenCalledTimes(1))
  })

  it('mantiene el modal abierto y muestra el error cuando la subida falla (Cláusula III)', async () => {
    uploadImageMock.mockRejectedValue(new Error('red caída'))
    const onUploadFailed = vi.fn()
    render(<UploadModal {...baseProps} onUploadFailed={onUploadFailed} />)

    elegir(archivo())

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/no se pudo subir/i)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(baseProps.onUploaded).not.toHaveBeenCalled()
    expect(onUploadFailed).toHaveBeenCalledTimes(1)
  })
})
