import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { normalizeSearch } from '../components/ImageGallery/searchUtils'
import { getDb } from '../config/firebase'
import type {
  GalleryEstado,
  GalleryOrigen,
  GalleryPhoto,
  GalleryVista,
} from '../types/gallery'

/** Tamaño del lote de la grilla (spec 007, FR-2). */
export const PAGE_SIZE = 24

const VISTAS = ['frente', 'espalda', 'detalle'] as const
const ORIGENES = ['corel', 'ia'] as const
const ESTADOS = ['aprobada', 'para_revisar'] as const

/**
 * Normaliza un código con el mismo criterio que el campo `codigoBusqueda`
 * guardado en el documento (FR-3): NFKD, sin diacríticos, minúsculas y trim.
 */
export function normalizeCodigo(value: string): string {
  return normalizeSearch(value)
}

export interface FetchGalleryPageArgs {
  /** Prefijo de código por el que filtrar (se normaliza antes de consultar). */
  codigoPrefijo?: string
  /** Último documento de la página anterior (`startAfter`). */
  cursor?: DocumentSnapshot | null
}

export interface GalleryPage {
  fotos: GalleryPhoto[]
  /** Cursor para la página siguiente, o `null` cuando no quedan más fotos. */
  cursor: DocumentSnapshot | null
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function esUnaDe<T extends string>(opciones: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (opciones as readonly string[]).includes(valor)
}

function fechaDesde(valor: unknown): Date {
  if (valor instanceof Date) return valor
  if (typeof valor === 'string') {
    const fecha = new Date(valor)
    return Number.isNaN(fecha.getTime()) ? new Date(0) : fecha
  }
  if (valor && typeof valor === 'object' && 'toDate' in valor) {
    const conToDate = valor as { toDate: unknown }
    if (typeof conToDate.toDate === 'function') {
      return (conToDate.toDate as () => Date)()
    }
  }
  return new Date(0)
}

function aGalleryPhoto(snapshot: QueryDocumentSnapshot): GalleryPhoto {
  const datos = snapshot.data()
  const carpeta = texto(datos.carpeta)
  const nombre = texto(datos.nombre)
  return {
    id: snapshot.id,
    codigo: texto(datos.codigo),
    nombre,
    carpeta,
    url: texto(datos.url),
    thumbUrl: texto(datos.thumbUrl),
    // Respaldo para documentos antiguos sin `fullPath` explícito.
    fullPath: texto(datos.fullPath) || (carpeta ? `${carpeta}/${nombre}` : nombre),
    vista: esUnaDe<GalleryVista>(VISTAS, datos.vista) ? datos.vista : 'frente',
    origen: esUnaDe<GalleryOrigen>(ORIGENES, datos.origen) ? datos.origen : 'corel',
    basadaEn: typeof datos.basadaEn === 'string' ? datos.basadaEn : null,
    // Ante la duda, una foto queda "para revisar" y no se puede tildar (FR-11).
    estado: esUnaDe<GalleryEstado>(ESTADOS, datos.estado) ? datos.estado : 'para_revisar',
    creadoEn: fechaDesde(datos.creadoEn),
  }
}

/**
 * Trae una página de 24 fotos de la colección `fotos` (spec 007, FR-2 y FR-3).
 * La búsqueda se resuelve en Firestore por prefijo de `codigoBusqueda`; nunca
 * se filtra en el navegador después de descargar.
 */
export async function fetchGalleryPage({
  codigoPrefijo,
  cursor,
}: FetchGalleryPageArgs = {}): Promise<GalleryPage> {
  const prefijo = normalizeCodigo(codigoPrefijo ?? '')
  const restricciones: QueryConstraint[] = []

  if (prefijo) {
    restricciones.push(
      where('codigoBusqueda', '>=', prefijo),
      where('codigoBusqueda', '<=', `${prefijo}\uf8ff`),
    )
  }

  restricciones.push(orderBy('codigoBusqueda'), orderBy(documentId()))
  if (cursor) {
    restricciones.push(startAfter(cursor))
  }
  restricciones.push(limit(PAGE_SIZE))

  const snapshot = await getDocs(query(collection(getDb(), 'fotos'), ...restricciones))
  const fotos = snapshot.docs.map(aGalleryPhoto)
  const ultimo = snapshot.docs.at(-1) ?? null

  return { fotos, cursor: fotos.length === PAGE_SIZE ? ultimo : null }
}
