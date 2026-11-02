/** Imagen residente en el bucket. `name`/`fullPath` siguen la convención {carpeta}/{código}[_N].jpg (spec 006). */
export interface ImageItem {
  /** Identificador único del objeto en Storage (su fullPath). */
  id: string
  /** Nombre del archivo en el bucket (búsqueda y miniatura). */
  name: string
  /** URL pública de descarga (getDownloadURL). */
  url: string
  /** Ruta completa en el bucket (usada por deleteObject). */
  fullPath: string
  /** Fecha de creación del objeto (timeCreated de los metadatos). */
  createdAt: string
  /** Carpeta de contexto ERP: "productos", "facturas", "avatares". */
  tag?: string
}

/** Estado de una subida en curso (feature 002). */
export interface UploadState {
  isUploading: boolean
  /** Progreso 0–100 de uploadBytesResumable. */
  progress: number
}

/** Estado de los filtros de la galería (feature 003). */
export interface GalleryFilterState {
  searchTerm: string
  filterTag?: string
}

/** Errores de validación y subida del UploadModal (spec 002). */
export type UploadErrorKind = 'format' | 'size' | 'network'

/** Props dual-mode del componente raíz (contrato del plugin ERP — plan.md). */
export interface ImageGalleryProps {
  /** Filtra por carpeta de contexto ERP al momento de listar. */
  filterTag?: string
  /** Oculta subida y eliminación cuando es true (modo lectura). */
  readOnly?: boolean
  /** Se ejecuta al seleccionar una imagen (feature 004). */
  onSelectImage?: (image: ImageItem) => void
  /** Se ejecuta tras confirmarse la eliminación (feature 004). */
  onDeleteImage?: (id: string) => void
  /** Se ejecuta con la URL de la imagen subida y procesada (feature 004). */
  onUploadSuccess?: (url: string) => void
}
