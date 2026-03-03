import { Photo } from '../models/photo';
import { IssueId } from '../models/issue';

/**
 * Photo リポジトリインターフェース
 */
export interface IPhotoRepository {
  save(photo: Photo): Promise<void>;
  findByIssueId(issueId: IssueId): Promise<Photo[]>;
}
