import {
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
  uploadBytesResumable,
  type FirebaseStorage,
} from 'firebase/storage'
import { getFirebaseApp } from '../config/firebase'
import type { ImageItem } from '../types/gallery'

function storageInstance(): FirebaseStorage {
  return getStorage(getFirebaseApp())
}

/**
 * Sube un archivo con progreso reportado como porcentaje 0–100 (spec 002, FR-2).
 * La normalización del archivo (feature 006) la ejecuta el procesamiento en
 * servidor vía Cloud Function `onFinalize`; el componente solo sube y refresca.
 */
export async function uploadImage(
  file: File,
  folder: string | undefined,
  onProgress: (percent: number) => void,
): Promise<string> {
  const storage = storageInstance()
  const targetRef = ref(storage, folder ? `${folder}/${file.name}` : file.name)
  const task = uploadBytesResumable(targetRef, file)

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        onProgress(percent)
      },
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref))
        } catch (error) {
          reject(error)
        }
      },
    )
  })
}

/**
 * Lista las imágenes del bucket, opcionalmente filtradas por la carpeta de
 * contexto ERP (filterTag → {carpeta}/, spec 003 FR-2).
 *
 * Nota (plan.md, riesgo R2): getMetadata se consulta por objeto para obtener
 * `timeCreated`; aceptable a la escala de una galería.
 */
export async function listImages(filterTag?: string): Promise<ImageItem[]> {
  const baseRef = filterTag ? ref(storageInstance(), `${filterTag}/`) : ref(storageInstance())
  const listing = await listAll(baseRef)

  return Promise.all(
    listing.items.map(async (itemRef): Promise<ImageItem> => {
      const [url, metadata] = await Promise.all([getDownloadURL(itemRef), getMetadata(itemRef)])
      return {
        id: itemRef.fullPath,
        name: itemRef.name,
        url,
        fullPath: itemRef.fullPath,
        createdAt: metadata.timeCreated,
        tag: filterTag,
      }
    }),
  )
}
