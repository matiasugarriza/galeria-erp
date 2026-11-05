import type { DocumentSnapshot } from 'firebase/firestore'
import { fetchGalleryPage, normalizeCodigo, PAGE_SIZE } from './galleryService'

const mocks = vi.hoisted(() => {
  const creador = (tipo: string) => vi.fn((...args: unknown[]) => ({ tipo, args }))
  return {
    collection: creador('collection'),
    query: creador('query'),
    where: creador('where'),
    orderBy: creador('orderBy'),
    startAfter: creador('startAfter'),
    limit: creador('limit'),
    documentId: vi.fn(() => '__name__'),
    getDocs: vi.fn(),
    getFirestore: vi.fn(() => ({})),
  }
})

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  query: mocks.query,
  where: mocks.where,
  orderBy: mocks.orderBy,
  startAfter: mocks.startAfter,
  limit: mocks.limit,
  documentId: mocks.documentId,
  getDocs: mocks.getDocs,
  getFirestore: mocks.getFirestore,
}))

vi.mock('../config/firebase', () => ({
  getDb: () => ({ app: 'fake' }),
  getFirebaseApp: vi.fn(),
}))

interface DocumentoFalso {
  id: string
  data: () => Record<string, unknown>
}

function documento(id: string, data: Record<string, unknown> = {}): DocumentoFalso {
  return { id, data: () => data }
}

describe('galleryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expone el tamaño de página de 24 fotos (FR-2)', () => {
    expect(PAGE_SIZE).toBe(24)
  })

  it('normaliza el código con el mismo criterio que el campo codigoBusqueda (FR-3)', () => {
    expect(normalizeCodigo('  AÑO-2026 ')).toBe('ano-2026')
    expect(normalizeCodigo('CH-001')).toBe('ch-001')
  })

  it('consulta la colección fotos ordenada por código y __name__ con límite de 24 (FR-2)', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] })

    await fetchGalleryPage({})

    expect(mocks.collection).toHaveBeenCalledWith({ app: 'fake' }, 'fotos')
    const argumentos = mocks.query.mock.calls[0]
    expect(argumentos[0]).toEqual({
      tipo: 'collection',
      args: [{ app: 'fake' }, 'fotos'],
    })
    expect(argumentos.slice(1)).toEqual([
      { tipo: 'orderBy', args: ['codigoBusqueda'] },
      { tipo: 'orderBy', args: ['__name__'] },
      { tipo: 'limit', args: [24] },
    ])
    expect(mocks.where).not.toHaveBeenCalled()
    expect(mocks.startAfter).not.toHaveBeenCalled()
  })

  it('filtra por prefijo de código normalizado entre el prefijo y su cota superior (FR-3)', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] })

    await fetchGalleryPage({ codigoPrefijo: '  CH-0 ' })

    expect(mocks.where).toHaveBeenNthCalledWith(1, 'codigoBusqueda', '>=', 'ch-0')
    expect(mocks.where).toHaveBeenNthCalledWith(2, 'codigoBusqueda', '<=', `ch-0\uf8ff`)
    const argumentos = mocks.query.mock.calls[0].slice(1) as Array<{ tipo: string; args: unknown[] }>
    expect(argumentos.map((restriccion) => restriccion.tipo)).toEqual([
      'where',
      'where',
      'orderBy',
      'orderBy',
      'limit',
    ])
  })

  it('ignora un prefijo vacío y no agrega restricciones where (FR-3)', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] })

    await fetchGalleryPage({ codigoPrefijo: '   ' })

    expect(mocks.where).not.toHaveBeenCalled()
  })

  it('continúa desde el cursor con startAfter (FR-2)', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] })
    const cursor = { id: 'ultima-foto' } as unknown as DocumentSnapshot

    await fetchGalleryPage({ cursor })

    expect(mocks.startAfter).toHaveBeenCalledWith(cursor)
  })

  it('mapea cada documento a GalleryPhoto con creadoEn como Date (FR-1)', async () => {
    const fecha = new Date('2026-11-05T12:00:00Z')
    mocks.getDocs.mockResolvedValue({
      docs: [
        documento('migradas__CH-001', {
          codigo: 'CH-001',
          codigoBusqueda: 'ch-001',
          nombre: 'CH-001.webp',
          carpeta: 'migradas',
          url: 'https://example.com/CH-001.webp',
          thumbUrl: 'https://example.com/thumbs/CH-001.webp',
          fullPath: 'migradas/CH-001.webp',
          vista: 'espalda',
          origen: 'ia',
          basadaEn: 'migradas__CH-000',
          estado: 'para_revisar',
          creadoEn: { toDate: () => fecha },
        }),
      ],
    })

    const { fotos } = await fetchGalleryPage({})

    expect(fotos).toEqual([
      {
        id: 'migradas__CH-001',
        codigo: 'CH-001',
        nombre: 'CH-001.webp',
        carpeta: 'migradas',
        url: 'https://example.com/CH-001.webp',
        thumbUrl: 'https://example.com/thumbs/CH-001.webp',
        fullPath: 'migradas/CH-001.webp',
        vista: 'espalda',
        origen: 'ia',
        basadaEn: 'migradas__CH-000',
        estado: 'para_revisar',
        creadoEn: fecha,
      },
    ])
  })

  it('devuelve el último documento como cursor sólo cuando la página viene completa (FR-2)', async () => {
    const completos = Array.from({ length: 24 }, (_, indice) => documento(`doc-${indice}`))
    mocks.getDocs.mockResolvedValue({ docs: completos })

    const paginaCompleta = await fetchGalleryPage({})
    expect(paginaCompleta.cursor).toBe(completos[23])

    mocks.getDocs.mockResolvedValue({ docs: completos.slice(0, 23) })
    const paginaFinal = await fetchGalleryPage({})
    expect(paginaFinal.cursor).toBeNull()
  })
})
