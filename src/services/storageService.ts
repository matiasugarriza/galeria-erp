import imageCompression from 'browser-image-compression'
import { deleteObject, getStorage, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage'
import { getFirebaseApp } from '../config/firebase'
import type { GalleryPhoto } from '../types/gallery'

/** Un año de caché en el navegador para las imágenes procesadas (spec 007, FR-6). */
const CACHE_CONTROL = 'public, max-age=31536000'

function storageInstance(): FirebaseStorage {
  return getStorage(getFirebaseApp())
}

/**
 * Achica y comprime la imagen en el navegador antes de subirla (FR-7):
 * 1600 px de lado máximo, 1 MB como tope, en un web worker y conservando el
 * tipo original para que un PNG de Corel mantenga la transparencia.
 */
export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 1,
    useWebWorker: true,
    ...(file.type ? { fileType: file.type } : {}),
  })
}

/**
 * Sube el archivo ya comprimido con progreso reportado como porcentaje 0–100.
 * Fija `cacheControl` de un año para que el navegador no vuelva a descargarlo
 * (FR-6). La miniatura y el documento de Firestore los escribe la Cloud
 * Function a partir de esta subida (FR-9).
 */
export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const storage = storageInstance()
  const targetRef = ref(storage, file.name)
  const task = uploadBytesResumable(targetRef, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: CACHE_CONTROL,
  })

  return new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      reject,
      () => resolve(),
    )
  })
}

/**
 * Elimina el objeto principal de Storage (spec 005 / FR-16). El documento de
 * Firestore y la miniatura los limpia el trigger `on_object_deleted`.
 */
export async function deleteImage(foto: GalleryPhoto): Promise<void> {
  await deleteObject(ref(storageInstance(), foto.fullPath))
}
