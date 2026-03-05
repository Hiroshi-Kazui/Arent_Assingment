import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { PhotoStorage } from '../../domain/repositories/photo-storage';
import { PhotoId } from '../../domain/models/photo';
import { PhotoDeleteForbiddenError } from '../../domain/errors/photo-delete-forbidden';
import { DeletePhotoInput } from '../dto/issue-dto';

/**
 * Photo 削除コマンド
 * Blob削除 → DB削除
 */
export class DeletePhotoHandler {
  constructor(
    private photoRepository: IPhotoRepository,
    private photoStorage: PhotoStorage
  ) {}

  async execute(input: DeletePhotoInput): Promise<void> {
    const photoId = PhotoId.create(input.photoId);
    const photo = await this.photoRepository.findById(photoId);
    if (!photo) {
      throw new Error(`Photo not found: ${input.photoId}`);
    }

    // 権限チェック: Worker は自分がアップロードした写真のみ削除可能
    if (input.userRole === 'WORKER') {
      if (!photo.uploadedBy || photo.uploadedBy !== input.userId) {
        throw new PhotoDeleteForbiddenError();
      }
    }

    // Blob 削除 → DB 削除
    await this.photoStorage.delete(photo.blobKey);
    await this.photoRepository.delete(photo.id);
  }
}
