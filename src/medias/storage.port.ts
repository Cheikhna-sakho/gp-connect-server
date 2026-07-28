import { MediaType } from '@prisma/client';

// Port de stockage de fichiers : le domaine (MediasService) ne dépend que de
// ce contrat, exprimé dans le vocabulaire métier (MediaType). Le provider
// concret (Cloudinary, demain S3/GCS…) est un adapter branché dans
// MediasModule — en changer ne touche aucun service.
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface StoredFile {
  url: string;
  /** Identifiant du fichier chez le provider (publicId Cloudinary, clé S3…) */
  storageId: string;
}

export interface StoragePort {
  upload(file: Express.Multer.File, type: MediaType): Promise<StoredFile>;
  delete(storageId: string, type: MediaType): Promise<unknown>;
}
