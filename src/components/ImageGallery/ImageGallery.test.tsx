import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DocumentSnapshot } from 'firebase/firestore'
import { fetchGalleryPage } from '../../services/galleryService'
import { deleteImage } from '../../services/storageService'
import type { GalleryPhoto } from '../../types/gallery'
import { ImageGallery } from './ImageGallery'

const mocks = vi.hoisted(() => ({
  fetchGalleryPage: vi.fn(),
  deleteImage: vi.fn(),
  compressImage: vi.fn(),
  uploadImage: vi.fn(),
  // Misma normalización que el servicio real (NFKD, sin diacríticos, minúsculas, trim).
  normalizeCodigo: (valor: string) =>
    valor
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim(),
}))

vi.mock('../../services/galleryService', () => ({
  PAGE_SIZE: 24,
  fetchGalleryPage: mocks.fetchGalleryPage,
  normalizeCodigo: mocks.normalizeCodigo,
}))

vi.mock('../../services/storageService', () => ({
  compressImage: mocks.compressImage,
  uploadImage: mocks.uploadImage,
  deleteImage: mocks.deleteImage,
}))

const fetchGalleryPageMock = vi.mocked(fetchGalleryPage)
const deleteImageMock = vi.mocked(deleteImage)

class IntersectionObserverStub {
  static instancias: IntersectionObserverStub[] = []

  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: number[] = []

  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IntersectionObserverStub.instancias.push(this)
  }

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn((): IntersectionObserverEntry[] => [])

  intersectar(): void {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

const createObjectURLMock = vi.fn(() => 'blob:vista-previa')
const revokeObjectURLMock = vi.fn()

function foto(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
  return {
    id: 'migradas__CH-001',
    codigo: 'CH-001',
    nombre: 'CH-001.png',
    carpeta: 'migradas',
    url: 'https://example.com/CH-001.webp',
    thumbUrl: 'https://example.com/thumbs/CH-001.webp',
    fullPath: 'migradas/CH-001.webp',
    vista: 'frente',
    origen: 'corel',
    basadaEn: null,
    estado: 'aprobada',
    creadoEn: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  }
}

function pagina(fotos: GalleryPhoto[], cursor: DocumentSnapshot | null = null) {
  return { fotos, cursor }
}

function cursorFalso(id: string): DocumentSnapshot {
  return { id } as unknown as DocumentSnapshot
}

function ultimaSentinela(): IntersectionObserverStub {
  const instancia = IntersectionObserverStub.instancias.at(-1)
  if (!instancia) throw new Error('No se creó ningún IntersectionObserver')
  return instancia
}

async function intersecar(): Promise<void> {
  await act(async () => {
    ultimaSentinela().intersectar()
  })
}

describe('ImageGallery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    IntersectionObserverStub.instancias = []
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    URL.createObjectURL = createObjectURLMock
    URL.revokeObjectURL = revokeObjectURLMock
    createObjectURLMock.mockReturnValue('blob:vista-previa')
    mocks.compressImage.mockImplementation((archivo: File) => Promise.resolve(archivo))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra el skeleton mientras llega la primera página (FR-2)', () => {
    fetchGalleryPageMock.mockReturnValue(new Promise(() => {}))
    render(<ImageGallery />)

    expect(screen.getByRole('status', { name: 'Cargando imágenes' })).toBeTruthy()
  })

  it('renderiza la primera página con miniaturas lazy (FR-2, FR-4, FR-5)', async () => {
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    render(<ImageGallery />)

    const imagen = await screen.findByRole('img', { name: 'CH-001.png' })
    expect(imagen.getAttribute('src')).toBe('https://example.com/thumbs/CH-001.webp')
    expect(imagen.getAttribute('loading')).toBe('lazy')
    expect(fetchGalleryPageMock).toHaveBeenCalledWith({ codigoPrefijo: undefined })
  })

  it('carga el siguiente lote al llegar al final y retira la sentinela sin cursor (FR-2)', async () => {
    const cursor = cursorFalso('cursor-1')
    const primera = Array.from({ length: 24 }, (_, indice) =>
      foto({
        id: `foto-${indice}`,
        codigo: `CH-${indice}`,
        nombre: `CH-${indice}.png`,
        thumbUrl: `https://example.com/thumbs/CH-${indice}.webp`,
        url: `https://example.com/CH-${indice}.webp`,
      }),
    )
    const siguiente = foto({ id: 'foto-24', codigo: 'CH-24', nombre: 'CH-24.png' })

    fetchGalleryPageMock
      .mockResolvedValueOnce(pagina(primera, cursor))
      .mockResolvedValueOnce(pagina([siguiente]))

    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-0.png' })
    expect(screen.getByTestId('gallery-sentinel')).toBeTruthy()

    await intersecar()

    expect(await screen.findByRole('img', { name: 'CH-24.png' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'CH-0.png' })).toBeTruthy()
    expect(fetchGalleryPageMock).toHaveBeenLastCalledWith({
      codigoPrefijo: undefined,
      cursor,
    })
    expect(screen.queryByTestId('gallery-sentinel')).toBeNull()
  })

  it('muestra «Cargando más imágenes…» y evita dos cargas simultáneas (FR-2)', async () => {
    const cursor = cursorFalso('cursor-1')
    fetchGalleryPageMock
      .mockResolvedValueOnce(pagina([foto()], cursor))
      .mockReturnValueOnce(new Promise(() => {}))

    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    await act(async () => {
      ultimaSentinela().intersectar()
      ultimaSentinela().intersectar()
    })

    expect(screen.getByText('Cargando más imágenes…')).toBeTruthy()
    expect(fetchGalleryPageMock).toHaveBeenCalledTimes(2)
  })

  it('muestra el error de paginación con reintento sobre el mismo cursor (FR-2)', async () => {
    const cursor = cursorFalso('cursor-1')
    fetchGalleryPageMock
      .mockResolvedValueOnce(pagina([foto()], cursor))
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(pagina([foto({ id: 'otra', nombre: 'CH-002.png' })]))

    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })
    await intersecar()

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/sin red/i)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))

    expect(await screen.findByRole('img', { name: 'CH-002.png' })).toBeTruthy()
    expect(fetchGalleryPageMock).toHaveBeenLastCalledWith({
      codigoPrefijo: undefined,
      cursor,
    })
  })

  it('consulta por prefijo con debounce y no filtra en el navegador (FR-3)', async () => {
    fetchGalleryPageMock
      .mockResolvedValueOnce(
        pagina([
          foto({ id: 'a', codigo: 'CH-001', nombre: 'CH-001.png' }),
          foto({ id: 'b', codigo: 'OTRO-9', nombre: 'OTRO-9.png' }),
        ]),
      )
      .mockResolvedValueOnce(
        pagina([
          foto({ id: 'c', codigo: 'CH-010', nombre: 'CH-010.png' }),
          foto({ id: 'd', codigo: 'ZZZ-1', nombre: 'ZZZ-1.png' }),
        ]),
      )

    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.change(screen.getByLabelText('Buscar imágenes'), {
      target: { value: '  CH-0 ' },
    })

    await waitFor(() =>
      expect(fetchGalleryPageMock).toHaveBeenLastCalledWith({ codigoPrefijo: 'CH-0' }),
    )
    expect(await screen.findByRole('img', { name: 'CH-010.png' })).toBeTruthy()
    // La grilla confía en el servidor: muestra lo que devolvió el prefijo, sin filtrar de nuevo.
    expect(screen.getByRole('img', { name: 'ZZZ-1.png' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'CH-001.png' })).toBeNull()
  })

  it('arranca filtrado por codigoInicial y lo re-aplica si cambia (FR-12)', async () => {
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    const { rerender } = render(<ImageGallery codigoInicial="CH-0" />)

    expect(await screen.findByRole('img', { name: 'CH-001.png' })).toBeTruthy()
    expect(fetchGalleryPageMock).toHaveBeenLastCalledWith({ codigoPrefijo: 'CH-0' })
    expect((screen.getByLabelText('Buscar imágenes') as HTMLInputElement).value).toBe('CH-0')

    rerender(<ImageGallery codigoInicial="AB-1" />)

    await waitFor(() =>
      expect(fetchGalleryPageMock).toHaveBeenLastCalledWith({ codigoPrefijo: 'AB-1' }),
    )
    expect((screen.getByLabelText('Buscar imágenes') as HTMLInputElement).value).toBe('AB-1')
  })

  it('muestra la vista previa local mientras la subida está en curso (FR-8)', async () => {
    mocks.uploadImage.mockReturnValue(new Promise(() => {}))
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('button', { name: /subir imagen/i }))
    fireEvent.change(await screen.findByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [new File(['x'], 'nueva.png', { type: 'image/png' })] },
    })

    const vistaPrevia = await screen.findByRole('img', { name: 'nueva.png' })
    expect(vistaPrevia.getAttribute('src')).toBe('blob:vista-previa')
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Subiendo…')).toBeTruthy()
  })

  it('reemplaza la vista previa por la foto real, la revoca y notifica onUploadSuccess (FR-8, FR-9)', async () => {
    const nueva = foto({
      id: 'nueva',
      codigo: 'nueva',
      nombre: 'nueva.png',
      fullPath: 'nueva.webp',
      thumbUrl: 'https://example.com/thumbs/nueva.webp',
      url: 'https://example.com/nueva.webp',
    })
    let resolver: () => void = () => {}
    mocks.uploadImage.mockImplementation(() => new Promise<void>((resolve) => (resolver = resolve)))
    fetchGalleryPageMock
      .mockResolvedValueOnce(pagina([foto()]))
      .mockResolvedValue(pagina([nueva]))
    const onUploadSuccess = vi.fn()

    render(<ImageGallery onUploadSuccess={onUploadSuccess} />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('button', { name: /subir imagen/i }))
    fireEvent.change(await screen.findByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [new File(['x'], 'nueva.png', { type: 'image/png' })] },
    })
    await screen.findByRole('img', { name: 'nueva.png' })

    resolver()

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalledWith(nueva))
    expect(fetchGalleryPageMock).toHaveBeenLastCalledWith({ codigoPrefijo: 'nueva' })
    await waitFor(() => {
      const imagenes = screen.getAllByRole('img', { name: 'nueva.png' })
      expect(
        imagenes.some((imagen) => imagen.getAttribute('src') === 'blob:vista-previa'),
      ).toBe(false)
      expect(
        imagenes.some(
          (imagen) => imagen.getAttribute('src') === 'https://example.com/thumbs/nueva.webp',
        ),
      ).toBe(true)
    })
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:vista-previa')
  })

  it('avisa que la imagen se está procesando si el documento no aparece tras los reintentos (FR-8)', async () => {
    mocks.uploadImage.mockResolvedValue(undefined)
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('button', { name: /subir imagen/i }))
    fireEvent.change(await screen.findByLabelText('Seleccionar archivo de imagen'), {
      target: { files: [new File(['x'], 'nueva.png', { type: 'image/png' })] },
    })

    expect(
      await screen.findByText('La imagen se está procesando; aparecerá en unos segundos.', undefined, {
        timeout: 5000,
      }),
    ).toBeTruthy()
  })

  it('devuelve las fotos elegidas en orden de selección y bloquea las «para revisar» (FR-11)', async () => {
    const aprobada1 = foto({ id: 'a', codigo: 'CH-001', nombre: 'CH-001.png' })
    const aprobada2 = foto({ id: 'b', codigo: 'CH-002', nombre: 'CH-002.png' })
    const paraRevisar = foto({
      id: 'c',
      codigo: 'CH-003',
      nombre: 'CH-003.png',
      estado: 'para_revisar',
    })
    fetchGalleryPageMock.mockResolvedValue(pagina([aprobada1, aprobada2, paraRevisar]))
    const onSelect = vi.fn()

    render(<ImageGallery onSelect={onSelect} />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tildar CH-002.png' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tildar CH-001.png' }))
    expect(onSelect).toHaveBeenLastCalledWith([aprobada2, aprobada1])

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tildar CH-002.png' }))
    expect(onSelect).toHaveBeenLastCalledWith([aprobada1])

    const bloqueada = screen.getByRole('checkbox', {
      name: 'Tildar CH-003.png',
    }) as HTMLInputElement
    expect(bloqueada.disabled).toBe(true)
    fireEvent.click(bloqueada)
    expect(onSelect).toHaveBeenLastCalledWith([aprobada1])
    expect(screen.getByText('Para revisar')).toBeTruthy()
  })

  it('abre la vista previa con la imagen grande y la cierra por botón, Esc y fondo (FR-10)', async () => {
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar CH-001.png' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Vista previa de CH-001.png' })
    expect(within(dialogo).getByRole('img', { name: 'CH-001.png' }).getAttribute('src')).toBe(
      'https://example.com/CH-001.webp',
    )

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar vista previa' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar CH-001.png' }))
    await screen.findByRole('dialog', { name: 'Vista previa de CH-001.png' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar CH-001.png' }))
    const fondo = await screen.findByRole('dialog', { name: 'Vista previa de CH-001.png' })
    fireEvent.click(fondo)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('elimina con confirmación previa y quita la foto de la grilla (FR-16)', async () => {
    fetchGalleryPageMock.mockResolvedValue(
      pagina([foto(), foto({ id: 'b', codigo: 'CH-002', nombre: 'CH-002.png' })]),
    )
    deleteImageMock.mockResolvedValue(undefined)
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar CH-001.png' }))
    await screen.findByRole('dialog', { name: 'Confirmar eliminación' })
    expect(deleteImageMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(deleteImageMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'migradas__CH-001' })),
    )
    expect(screen.queryByRole('img', { name: 'CH-001.png' })).toBeNull()
    expect(screen.getByRole('img', { name: 'CH-002.png' })).toBeTruthy()
  })

  it('muestra el error de eliminación visible y conserva la foto (Cláusula III)', async () => {
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    deleteImageMock.mockRejectedValue(new Error('permiso denegado'))
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar CH-001.png' }))
    await screen.findByRole('dialog', { name: 'Confirmar eliminación' })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/permiso denegado/i)
    expect(screen.getByRole('img', { name: 'CH-001.png' })).toBeTruthy()
  })

  it('oculta subida, borrado y tilde en modo readOnly (contrato del plugin)', async () => {
    fetchGalleryPageMock.mockResolvedValue(pagina([foto()]))
    const { unmount } = render(<ImageGallery readOnly />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    expect(screen.queryByRole('button', { name: /subir imagen/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Eliminar CH-001.png' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    unmount()

    fetchGalleryPageMock.mockResolvedValue(pagina([]))
    render(<ImageGallery readOnly />)
    await screen.findByText(/no hay imágenes/i)
    expect(screen.queryByRole('button', { name: /subir imagen/i })).toBeNull()
  })

  it('muestra el estado vacío con acceso a la subida (FR-8)', async () => {
    fetchGalleryPageMock.mockResolvedValue(pagina([]))
    render(<ImageGallery />)

    expect(await screen.findByText(/no hay imágenes/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /subir imagen/i })).toBeTruthy()
  })

  it('avisa cuando la búsqueda no tiene coincidencias (FR-3)', async () => {
    fetchGalleryPageMock
      .mockResolvedValueOnce(pagina([foto()]))
      .mockResolvedValueOnce(pagina([]))
    render(<ImageGallery />)
    await screen.findByRole('img', { name: 'CH-001.png' })

    fireEvent.change(screen.getByLabelText('Buscar imágenes'), { target: { value: 'zzz' } })

    expect(await screen.findByText(/no se encontraron imágenes/i)).toBeTruthy()
    expect(screen.getByText(/zzz/)).toBeTruthy()
  })

  it('muestra el error de carga inicial con reintento (Cláusula III)', async () => {
    fetchGalleryPageMock
      .mockRejectedValueOnce(new Error('permiso denegado'))
      .mockResolvedValueOnce(pagina([foto()]))
    render(<ImageGallery />)

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/permiso denegado/i)

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('img', { name: 'CH-001.png' })).toBeTruthy()
  })
})
