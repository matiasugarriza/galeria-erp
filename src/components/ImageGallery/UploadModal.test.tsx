import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { uploadImage } from '../../services/storageService'
import { UploadModal } from './UploadModal'

vi.mock('../../services/storageService', () => ({
  listImages: vi.fn(),
  uploadImage: vi.fn(),
}))

const uploadImageMock = vi.mocked(uploadImage)

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onUploaded: vi.fn(),
}

function validFile(name = 'foto.jpg'): File {
  return new File(['contenido'], name, { type: 'image/jpeg' })
}

describe('UploadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bloquea formatos no soportados y muestra los formatos permitidos (AC2, FR-4)', () => {
    render(<UploadModal {...baseProps} />)

    fireEvent.change(screen.getByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [new File(['x'], 'documento.pdf', { type: 'application/pdf' })] },
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/formatos permitidos/i)
    expect(alert.textContent).toMatch(/\.jpg.*\.png.*\.webp/i)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('bloquea archivos mayores a 10 MB sin iniciar la subida (FR-5)', () => {
    render(<UploadModal {...baseProps} />)

    const big = new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'grande.jpg', {
      type: 'image/jpeg',
    })
    fireEvent.change(screen.getByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [big] },
    })

    expect(screen.getByRole('alert').textContent).toMatch(/10 MB/i)
    expect(uploadImageMock).not.toHaveBeenCalled()
  })

  it('muestra la barra de progreso 0-100 durante la subida y notifica al completarse (AC1, FR-2)', async () => {
    let resolveUpload: (url: string) => void = () => {}
    uploadImageMock.mockImplementation((_file, _folder, onProgress) => {
      onProgress(42)
      return new Promise<string>((resolve) => {
        resolveUpload = resolve
      })
    })
    const onUploaded = vi.fn()
    render(<UploadModal {...baseProps} onUploaded={onUploaded} />)

    fireEvent.change(screen.getByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [validFile()] },
    })

    const bar = await screen.findByRole('progressbar', { name: 'Progreso de subida' })
    expect(bar.getAttribute('aria-valuenow')).toBe('42')

    resolveUpload('https://example.com/foto.jpg')
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('acepta archivos arrastrados a la zona de carga (AC1)', () => {
    uploadImageMock.mockResolvedValue('https://example.com/foto.jpg')
    render(<UploadModal {...baseProps} />)

    fireEvent.drop(screen.getByLabelText('Zona de carga de archivos'), {
      dataTransfer: { files: [validFile('arrastrada.webp')] },
    })

    return waitFor(() => expect(uploadImageMock).toHaveBeenCalledTimes(1))
  })

  it('mantiene el modal abierto y muestra el error cuando la subida falla (Cláusula III)', async () => {
    uploadImageMock.mockRejectedValue(new Error('red caída'))
    render(<UploadModal {...baseProps} />)

    fireEvent.change(screen.getByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [validFile()] },
    })

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/no se pudo subir/i)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(baseProps.onUploaded).not.toHaveBeenCalled()
  })
})
