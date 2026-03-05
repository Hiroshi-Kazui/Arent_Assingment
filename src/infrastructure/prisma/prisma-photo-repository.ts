import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { Photo, PhotoId, PhotoPhase } from '../../domain/models/photo';
import { IssueId } from '../../domain/models/issue';
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
        uploaded_by: photo.uploadedBy,
      },
    });
  }

  async findByIssueId(issueId: IssueId): Promise<Photo[]> {
    const rows = await prisma.photo.findMany({
      where: { issue_id: issueId },
      orderBy: { uploaded_at: 'asc' },
    });

    return rows.map((row) =>
      Photo.reconstruct(
        PhotoId.create(row.photo_id),
        IssueId.create(row.issue_id),
        row.blob_key,
        row.photo_phase as PhotoPhase,
        row.uploaded_at,
        row.uploaded_by ?? null
      )
    );
  }

  async findById(id: PhotoId): Promise<Photo | null> {
    const row = await prisma.photo.findUnique({
      where: { photo_id: id },
    });
    if (!row) return null;
    return Photo.reconstruct(
      PhotoId.create(row.photo_id),
      IssueId.create(row.issue_id),
      row.blob_key,
      row.photo_phase as PhotoPhase,
      row.uploaded_at,
      row.uploaded_by ?? null
    );
  }

  async delete(id: PhotoId): Promise<void> {
    await prisma.photo.delete({
      where: { photo_id: id },
    });
  }
}
