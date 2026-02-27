import { PhotoId } from '../../domain/models/photo';
import { PhotoStorage } from '../../domain/repositories/photo-storage';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * Photo から署名付き URL を取得
 * @param photoId Photo ID
 * @param photoStorage PhotoStorage 実装
 * @param expirationMinutes 有効期限（分）
 */
export async function getPhotoUrl(
  photoId: string,
  photoStorage: PhotoStorage
): Promise<string | null> {
  const photo = await prisma.photo.findUnique({
    where: { photo_id: photoId as PhotoId },
  });

  if (!photo) {
    return null;
  }

  return photoStorage.getUrl(photo.blob_key);
}
