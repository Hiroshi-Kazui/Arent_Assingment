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
    data: Buffer | Blob,
    contentType: string
  ): Promise<string> {
    // Blob をBuffer に変換
    const buffer = data instanceof Blob
      ? await this.blobToBuffer(data)
      : data;

    // MinIO にアップロード
    await minioClient.putObject(
      this.bucketName,
      key,
      buffer,
      buffer.length,
      {
        'Content-Type': contentType,
      }
    );

    // URL を返却（内部では key を返すことで、後で署名付きURLを生成可能にする）
    return key;
  }

  async getSignedUrl(
    key: string,
    expirationMinutes: number = 60
  ): Promise<string> {
    // 有効期限を秒で計算（最大7日）
    const expirationSeconds = Math.min(
      expirationMinutes * 60,
      7 * 24 * 60 * 60
    );

    return minioClient.presignedGetObject(
      this.bucketName,
      key,
      expirationSeconds
    );
  }

  /**
   * Blob を Buffer に変換
   */
  private async blobToBuffer(blob: Blob): Promise<Buffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
