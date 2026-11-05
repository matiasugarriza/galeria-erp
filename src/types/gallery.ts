/** Tipo de vista de una foto del catálogo (spec 007, FR-15). */
export type GalleryVista = 'frente' | 'espalda' | 'detalle'

/** Origen de la imagen: exportada de Corel o generada/mejorada con IA (spec 007, FR-15). */
export type GalleryOrigen = 'corel' | 'ia'

/** Estado de aprobación: sólo las aprobadas se pueden tildar para la ficha (FR-11). */
export type GalleryEstado = 'aprobada' | 'para_revisar'

/**
 * Foto del catálogo leída del documento `fotos/{carpeta__nombre}` de Firestore
 * (spec 007, FR-1). Reemplaza a `ImageItem`.
 */
export interface GalleryPhoto {
  /** Id del documento en Firestore (`carpeta__nombre`). */
  id: string
  /** Código de artículo derivado del nombre del archivo. */
  codigo: string
  /** Nombre del archivo procesado (con extensión). */
  nombre: string
  /** Carpeta de origen dentro del bucket. */
  carpeta: string
  /** URL de la imagen principal (se descarga sólo al abrir el modal). */
  url: string
  /** URL de la miniatura WebP generada por el pipeline. */
  thumbUrl: string
  /** Ruta del objeto principal en Storage (usada por deleteObject). */
  fullPath: string
  /** Vista de la foto. */
  vista: GalleryVista
  /** Origen de la foto. */
  origen: GalleryOrigen
  /** Id de la foto original cuando la imagen fue generada por IA. */
  basadaEn: string | null
  /** Estado de aprobación para la ficha técnica. */
  estado: GalleryEstado
  /** Fecha de creación del documento. */
  creadoEn: Date
}

/** Estado de una subida en curso. */
export interface UploadState {
  isUploading: boolean
  /** Progreso 0–100 de uploadBytesResumable. */
  progress: number
}

/** Errores de validación y subida del UploadModal. */
export type UploadErrorKind = 'format' | 'size' | 'network'

/** Props del componente raíz expuesto al ERP (contrato del plugin — spec 007). */
export interface ImageGalleryProps {
  /** Código de artículo con el que la galería arranca filtrada (FR-12). */
  codigoInicial?: string
  /** Oculta subida, eliminación y selección cuando es true (modo lectura). */
  readOnly?: boolean
  /** Se ejecuta con las fotos elegidas, en orden de selección (FR-11). */
  onSelect?: (fotosElegidas: GalleryPhoto[]) => void
  /** Se ejecuta con la foto real cuando el documento aparece tras la subida (FR-8). */
  onUploadSuccess?: (foto: GalleryPhoto) => void
}
