import { PhotoStorage } from '../../domain/repositories/photo-storage';
import minioClient from './minio-client';

/**
 * MinIO を使用した Photo Storage の実装
 */
export class MinioPhotoStorage implements PhotoStorage {
  private bucketName: string;
  private bucketInitialized = false;

  constructor(bucketName: string = 'photos') {
    this.bucketName = bucketName;
  }

  /**
   * バケットが存在しない場合は作成する（冪等）
   */
  private async ensureBucket(): Promise<void> {
    if (this.bucketInitialized) return;

    const exists = await minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await minioClient.makeBucket(this.bucketName);
    }
    this.bucketInitialized = true;
  }

  async upload(
    key: string,
    file: Buffer,
    contentType: string
  ): Promise<void> {
    await this.ensureBucket();

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
    // 有効期限を秒で計算（1時間）
    const expirationSeconds = 60 * 60;

    return minioClient.presignedGetObject(
      this.bucketName,
      key,
      expirationSeconds
    );
  }

  async delete(key: string): Promise<void> {
    await minioClient.removeObject(this.bucketName, key);
  }
}
