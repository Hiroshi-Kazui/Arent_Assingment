import { Photo, PhotoId } from '../models/photo';
import { IssueId } from '../models/issue';

/**
 * Photo リポジトリインターフェース
 */
export interface IPhotoRepository {
  save(photo: Photo): Promise<void>;
  findById(id: PhotoId): Promise<Photo | null>;
  findByIssueId(issueId: IssueId): Promise<Photo[]>;
  delete(id: PhotoId): Promise<void>;
}
