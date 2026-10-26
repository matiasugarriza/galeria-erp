/**
 * Exportación pública del módulo para integración como Plugin ERP.
 * El consumidor NO accede a la configuración interna de Firebase (Cláusula IV).
 */
export { ImageGallery } from './components/ImageGallery/ImageGallery'
export type { ImageGalleryProps, ImageItem, GalleryFilterState, UploadState } from './types/gallery'
