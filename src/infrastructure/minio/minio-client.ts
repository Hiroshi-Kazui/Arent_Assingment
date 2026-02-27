import { Client as MinioClient } from 'minio';

/**
 * MinIO Client シングルトン
 */
let minioClient: MinioClient;

function createMinioClient(): MinioClient {
  const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  const accessKey = process.env.MINIO_ROOT_USER || 'minioadmin';
  const secretKey = process.env.MINIO_ROOT_PASSWORD || 'minioadmin_password';

  // endpoint から ホストとポートを抽出
  const url = new URL(endpoint);
  const host = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : 9000;
  const useSSL = url.protocol === 'https:';

  return new MinioClient({
    endPoint: host,
    port,
    useSSL,
    accessKey,
    secretKey,
  });
}

if (process.env.NODE_ENV === 'production') {
  minioClient = createMinioClient();
} else {
  // Development/Test環境ではグローバル変数でキャッシュ
  const globalWithMinio = global as typeof globalThis & {
    minioClient: MinioClient;
  };

  if (!globalWithMinio.minioClient) {
    globalWithMinio.minioClient = createMinioClient();
  }

  minioClient = globalWithMinio.minioClient;
}

export default minioClient;
