import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { PhotoStorage } from '../../domain/repositories/photo-storage';
import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { Photo, PhotoId, PhotoPhase } from '../../domain/models/photo';
import { IssueId } from '../../domain/models/issue';
import { AddPhotoInput } from '../dto/issue-dto';
import { randomUUID } from 'crypto';

/**
 * Photo アップロードコマンド
 * ① PhotoId生成 → ② BlobKey生成 → ③ PhotoStorage.upload → ④ DB保存
 */
export class AddPhotoHandler {
  constructor(
    private issueRepository: IIssueRepository,
    private photoStorage: PhotoStorage,
    private photoRepository: IPhotoRepository
  ) {}

  async execute(input: AddPhotoInput): Promise<string> {
    const issueId = IssueId.create(input.issueId);

    // Issue が存在するか確認
    const issue = await this.issueRepository.findById(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    // PhotoId を生成
    const photoId = PhotoId.create(randomUUID());

    // ファイル拡張子を取得
    const ext = this.getFileExtension(input.fileName);

    // BlobKey を生成
    const blobKey = `projects/${input.projectId}/issues/${input.issueId}/photos/${photoId}.${ext}`;

    // PhotoStorage にアップロード
    await this.photoStorage.upload(
      blobKey,
      input.file,
      input.contentType
    );

    const photo = Photo.create(
      photoId,
      issueId,
      blobKey,
      input.photoPhase === 'AFTER'
        ? PhotoPhase.After
        : PhotoPhase.Before
    );
    await this.photoRepository.save(photo);

    return photoId;
  }

  /**
   * ファイル名から拡張子を抽出
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
    return 'bin';
  }
}
