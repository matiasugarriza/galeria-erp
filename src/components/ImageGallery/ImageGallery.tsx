import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentSnapshot } from 'firebase/firestore'
import { AlertTriangle, ImageOff, Search, Upload } from 'lucide-react'
import { fetchGalleryPage, normalizeCodigo } from '../../services/galleryService'
import { deleteImage } from '../../services/storageService'
import type { GalleryPhoto, ImageGalleryProps } from '../../types/gallery'
import { ConfirmDialog } from './ConfirmDialog'
import { GalleryGrid } from './GalleryGrid'
import { ImageModal } from './ImageModal'
import { UploadModal } from './UploadModal'

type GalleryState = 'loading' | 'ready' | 'error'

/** Espera del debounce de la búsqueda por código (FR-3). */
const DEBOUNCE_BUSQUEDA_MS = 300
/** Esperas entre refrescos tras una subida, hasta que aparece el documento (FR-8). */
const REINTENTOS_SUBIDA_MS = [300, 600, 900]
const AVISO_PROCESANDO = 'La imagen se está procesando; aparecerá en unos segundos.'

/** Vista previa local de una subida en curso (`URL.createObjectURL`, FR-8). */
interface VistaPrevia {
  id: string
  url: string
  nombre: string
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido'
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nombreSinExtension(nombre: string): string {
  return nombre.includes('.') ? nombre.slice(0, nombre.lastIndexOf('.')) : nombre
}

function fusionar(actuales: GalleryPhoto[], nuevas: GalleryPhoto[]): GalleryPhoto[] {
  const ids = new Set(actuales.map((foto) => foto.id))
  return [...actuales, ...nuevas.filter((foto) => !ids.has(foto.id))]
}

function coincideConArchivo(foto: GalleryPhoto, file: File): boolean {
  return (
    foto.fullPath === file.name ||
    foto.fullPath.endsWith(`/${file.name}`) ||
    foto.nombre === file.name
  )
}

/**
 * Componente raíz del plugin ERP (spec 007): grilla paginada desde Firestore,
 * búsqueda por prefijo, scroll infinito, vista previa local al subir, modal de
 * sólo lectura y selección múltiple de fotos aprobadas.
 */
export function ImageGallery({
  codigoInicial,
  readOnly = false,
  onSelect,
  onUploadSuccess,
}: ImageGalleryProps) {
  const [estado, setEstado] = useState<GalleryState>('loading')
  const [mensajeError, setMensajeError] = useState('')
  const [fotos, setFotos] = useState<GalleryPhoto[]>([])
  const [paginaCursor, setPaginaCursor] = useState<DocumentSnapshot | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorCargaMas, setErrorCargaMas] = useState<string | null>(null)
  const [termino, setTermino] = useState(codigoInicial ?? '')
  const [busqueda, setBusqueda] = useState(codigoInicial ?? '')
  const [reintento, setReintento] = useState(0)
  const [elegidas, setElegidas] = useState<GalleryPhoto[]>([])
  const [vistasPrevias, setVistasPrevias] = useState<VistaPrevia[]>([])
  const [avisoProcesando, setAvisoProcesando] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [previewFoto, setPreviewFoto] = useState<GalleryPhoto | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GalleryPhoto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const cursorRef = useRef<DocumentSnapshot | null>(null)
  const cargandoRef = useRef(false)
  const requestIdRef = useRef(0)
  const busquedaRef = useRef(busqueda)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const elegidasRef = useRef<GalleryPhoto[]>([])
  const vistasPreviasRef = useRef<VistaPrevia[]>([])
  const previewSeqRef = useRef(0)
  const montadoRef = useRef(true)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // Al desmontar se revocan las URLs locales que sigan vivas (Cláusula III).
  useEffect(
    () => () => {
      for (const vista of vistasPreviasRef.current) {
        if (vista.url && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(vista.url)
        }
      }
    },
    [],
  )

  // Re-aplica el filtro cuando el ERP cambia el código con el que monta (FR-12).
  useEffect(() => {
    if (codigoInicial === undefined) return
    setTermino(codigoInicial)
    setBusqueda(codigoInicial)
  }, [codigoInicial])

  // Debounce de 300 ms: la búsqueda se resuelve en Firestore (FR-3).
  useEffect(() => {
    if (termino === busqueda) return
    const temporizador = setTimeout(() => setBusqueda(termino), DEBOUNCE_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [termino, busqueda])

  // Primera página (y recarga al cambiar de búsqueda o reintentar un error).
  useEffect(() => {
    busquedaRef.current = busqueda
    const requestId = ++requestIdRef.current
    cargandoRef.current = false
    cursorRef.current = null
    setPaginaCursor(null)
    setCargandoMas(false)
    setErrorCargaMas(null)
    setEstado('loading')

    fetchGalleryPage({ codigoPrefijo: busqueda.trim() || undefined })
      .then((pagina) => {
        if (requestIdRef.current !== requestId) return
        setFotos(pagina.fotos)
        cursorRef.current = pagina.cursor
        setPaginaCursor(pagina.cursor)
        setEstado('ready')
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return
        setMensajeError(mensajeDeError(error))
        setEstado('error')
      })
  }, [busqueda, reintento])

  const cargarMas = useCallback(async () => {
    if (cargandoRef.current) return
    const cursor = cursorRef.current
    if (!cursor) return

    cargandoRef.current = true
    const requestId = requestIdRef.current
    setCargandoMas(true)
    setErrorCargaMas(null)

    try {
      const pagina = await fetchGalleryPage({
        codigoPrefijo: busquedaRef.current.trim() || undefined,
        cursor,
      })
      if (requestIdRef.current !== requestId) return
      setFotos((actuales) => fusionar(actuales, pagina.fotos))
      cursorRef.current = pagina.cursor
      setPaginaCursor(pagina.cursor)
    } catch (error) {
      if (requestIdRef.current !== requestId) return
      setErrorCargaMas(mensajeDeError(error))
    } finally {
      cargandoRef.current = false
      if (requestIdRef.current === requestId) setCargandoMas(false)
    }
  }, [])

  // Scroll infinito: una sentinela al final dispara el siguiente lote (FR-2).
  useEffect(() => {
    const nodo = sentinelRef.current
    if (!nodo || typeof IntersectionObserver === 'undefined') return

    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((entrada) => entrada.isIntersecting)) void cargarMas()
    })
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [cargarMas, paginaCursor])

  const aplicarElegidas = (siguientes: GalleryPhoto[]) => {
    elegidasRef.current = siguientes
    setElegidas(siguientes)
    onSelect?.(siguientes)
  }

  const toggleSeleccion = (foto: GalleryPhoto) => {
    // Las fotos "para revisar" no se pueden tildar para la ficha (FR-11).
    if (foto.estado !== 'aprobada') return
    const actuales = elegidasRef.current
    const existe = actuales.some((elegida) => elegida.id === foto.id)
    aplicarElegidas(
      existe ? actuales.filter((elegida) => elegida.id !== foto.id) : [...actuales, foto],
    )
  }

  const actualizarVistasPrevias = (siguientes: VistaPrevia[]) => {
    vistasPreviasRef.current = siguientes
    setVistasPrevias(siguientes)
  }

  const agregarVistaPrevia = (file: File) => {
    const url = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
    const id = `vista-previa-${++previewSeqRef.current}`
    actualizarVistasPrevias([...vistasPreviasRef.current, { id, url, nombre: file.name }])
    setAvisoProcesando(null)
  }

  const quitarVistaPrevia = (nombre: string) => {
    const mantener: VistaPrevia[] = []
    for (const vista of vistasPreviasRef.current) {
      if (vista.nombre === nombre) {
        if (vista.url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(vista.url)
      } else {
        mantener.push(vista)
      }
    }
    actualizarVistasPrevias(mantener)
  }

  /**
   * Tras la subida, refresca hasta que el documento aparezca (limitados
   * reintentos espaciados) y retira la vista previa (FR-8).
   */
  const handleUploaded = async (file: File) => {
    const prefijo =
      busquedaRef.current.trim() || normalizeCodigo(nombreSinExtension(file.name)) || undefined

    let encontrada: GalleryPhoto | null = null
    for (const espera of [0, ...REINTENTOS_SUBIDA_MS]) {
      if (espera > 0) await esperar(espera)
      if (!montadoRef.current) return
      try {
        const pagina = await fetchGalleryPage({ codigoPrefijo: prefijo })
        encontrada = pagina.fotos.find((foto) => coincideConArchivo(foto, file)) ?? null
      } catch {
        encontrada = null
      }
      if (encontrada) break
    }

    if (!montadoRef.current) return
    quitarVistaPrevia(file.name)

    const foto = encontrada
    if (!foto) {
      setAvisoProcesando(AVISO_PROCESANDO)
      return
    }

    setFotos((actuales) =>
      actuales.some((existente) => existente.id === foto.id) ? actuales : [foto, ...actuales],
    )
    onUploadSuccess?.(foto)
  }

  const abrirConfirmacion = (foto: GalleryPhoto) => {
    setDeleteError(null)
    setPendingDelete(foto)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleting) return
    const objetivo = pendingDelete
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteImage(objetivo)
      setFotos((actuales) => actuales.filter((foto) => foto.id !== objetivo.id))
      if (elegidasRef.current.some((foto) => foto.id === objetivo.id)) {
        aplicarElegidas(elegidasRef.current.filter((foto) => foto.id !== objetivo.id))
      }
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(`No se pudo eliminar la imagen: ${mensajeDeError(error)}`)
    } finally {
      setDeleting(false)
    }
  }

  if (estado === 'loading') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Cargando imágenes"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {Array.from({ length: 8 }).map((_, indice) => (
          <div key={indice} className="aspect-[4/3] animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center"
      >
        <AlertTriangle aria-hidden="true" className="size-8 text-red-500" />
        <p className="text-sm font-medium text-red-800">
          No se pudieron cargar las imágenes: {mensajeError}
        </p>
        <button
          type="button"
          onClick={() => setReintento((valor) => valor + 1)}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-200 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const uploadButtonClass =
    'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
  const hayBusqueda = busqueda.trim() !== ''
  const mostrarBotonSubida = !readOnly && (fotos.length > 0 || hayBusqueda)
  const idsElegidas = new Set(elegidas.map((foto) => foto.id))

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            aria-label="Buscar imágenes"
            placeholder="Buscar por código…"
            value={termino}
            onChange={(event) => setTermino(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
        </div>
        {mostrarBotonSubida && (
          <div className="sm:ml-auto">
            <button
              type="button"
              aria-label="Subir imagen"
              onClick={() => setIsUploadOpen(true)}
              className={uploadButtonClass}
            >
              <Upload aria-hidden="true" className="size-4" />
              Subir Imagen
            </button>
          </div>
        )}
      </div>

      {vistasPrevias.length > 0 && (
        <ul
          aria-label="Imágenes subiéndose"
          className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {vistasPrevias.map((vista) => (
            <li key={vista.id} className="rounded-lg border border-blue-200 bg-white p-2">
              <img
                src={vista.url}
                alt={vista.nombre}
                loading="lazy"
                className="aspect-[4/3] w-full rounded object-cover"
              />
              <p className="mt-2 truncate text-sm font-medium text-gray-800">{vista.nombre}</p>
              <p className="text-xs font-medium text-blue-700">Subiendo…</p>
            </li>
          ))}
        </ul>
      )}

      {avisoProcesando && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
        >
          {avisoProcesando}
        </p>
      )}

      {fotos.length === 0 ? (
        hayBusqueda ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No se encontraron imágenes que coincidan con “{busqueda.trim()}”.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
            <ImageOff aria-hidden="true" className="size-10 text-gray-400" />
            <p className="text-sm text-gray-600">No hay imágenes en esta galería todavía.</p>
            {!readOnly && (
              <button
                type="button"
                aria-label="Subir imagen"
                onClick={() => setIsUploadOpen(true)}
                className={uploadButtonClass}
              >
                <Upload aria-hidden="true" className="size-4" />
                Subir Imagen
              </button>
            )}
          </div>
        )
      ) : (
        <>
          <GalleryGrid
            fotos={fotos}
            seleccionadas={idsElegidas}
            onToggleSeleccion={readOnly ? undefined : toggleSeleccion}
            onPreview={setPreviewFoto}
            onDelete={readOnly ? undefined : abrirConfirmacion}
            readOnly={readOnly}
          />

          {cargandoMas && (
            <p role="status" className="mt-4 text-center text-sm text-gray-600">
              Cargando más imágenes…
            </p>
          )}

          {errorCargaMas && (
            <div
              role="alert"
              className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-center"
            >
              <p className="text-sm font-medium text-red-800">
                No se pudieron cargar más imágenes: {errorCargaMas}
              </p>
              <button
                type="button"
                onClick={() => void cargarMas()}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors duration-200 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Reintentar carga
              </button>
            </div>
          )}

          {paginaCursor && (
            <div ref={sentinelRef} data-testid="gallery-sentinel" aria-hidden="true" className="h-4" />
          )}
        </>
      )}

      <UploadModal
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadStart={agregarVistaPrevia}
        onUploadFailed={(file) => quitarVistaPrevia(file.name)}
        onUploaded={(file) => void handleUploaded(file)}
      />

      {previewFoto && <ImageModal foto={previewFoto} onClose={() => setPreviewFoto(null)} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={`¿Eliminar “${pendingDelete?.nombre ?? ''}”? Esta acción no se puede deshacer.`}
        confirming={deleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (deleting) return
          setPendingDelete(null)
          setDeleteError(null)
        }}
      />
    </div>
  )
}
