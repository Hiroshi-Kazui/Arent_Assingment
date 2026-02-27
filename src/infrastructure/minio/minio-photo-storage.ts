import { PhotoStorage } from '../../domain/repositories/photo-storage';
import minioClient from './minio-client';

/**
 * MinIO を使用した Photo Storage の実装
 */
export class MinioPhotoStorage implements PhotoStorage {
  private bucketName: string;

  constructor(bucketName: string = 'photos') {
    this.bucketName = bucketName;
  }

  async upload(
    key: string,
    file: Buffer,
    contentType: string
  ): Promise<void> {
    // MinIO にアップロード
    await minioClient.putObject(
      this.bucketName,
      key,
      file,
      file.length,
      {
        'Content-Type': contentType,
      }
    );
  }

  async getUrl(key: string): Promise<string> {
    // 有効期限を秒で計算（最大7日）
    const expirationSeconds = 60 * 60;

    return minioClient.presignedGetObject(
      this.bucketName,
      key,
      expirationSeconds
    );
  }
}
