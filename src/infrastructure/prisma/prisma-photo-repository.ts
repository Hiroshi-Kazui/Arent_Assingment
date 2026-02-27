import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { Photo } from '../../domain/models/photo';
import prisma from './prisma-client';

/**
 * Prisma を使用した Photo Repository の実装
 */
export class PrismaPhotoRepository implements IPhotoRepository {
  async save(photo: Photo): Promise<void> {
    await prisma.photo.create({
      data: {
        photo_id: photo.id,
        issue_id: photo.issueId,
        blob_key: photo.blobKey,
        photo_phase: photo.phase,
        uploaded_at: photo.uploadedAt,
      },
    });
  }
}
