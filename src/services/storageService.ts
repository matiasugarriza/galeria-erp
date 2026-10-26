import {
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
  type FirebaseStorage,
} from 'firebase/storage'
import { getFirebaseApp } from '../config/firebase'
import type { ImageItem } from '../types/gallery'

function storageInstance(): FirebaseStorage {
  return getStorage(getFirebaseApp())
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
