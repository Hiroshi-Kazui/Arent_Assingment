import { Photo } from '../models/photo';

/**
 * Photo リポジトリインターフェース
 */
export interface IPhotoRepository {
  save(photo: Photo): Promise<void>;
}
