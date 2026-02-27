/**
 * 依存注入コンテナ
 * Repository、Storage、Provider、Command/Queryハンドラのバインド
 */

import { PrismaIssueRepository } from '../infrastructure/prisma/prisma-issue-repository';
import { PrismaProjectRepository } from '../infrastructure/prisma/prisma-project-repository';
import { PrismaBuildingRepository } from '../infrastructure/prisma/prisma-building-repository';
import { PrismaFloorRepository } from '../infrastructure/prisma/prisma-floor-repository';
import { PrismaPhotoRepository } from '../infrastructure/prisma/prisma-photo-repository';
import { MinioPhotoStorage } from '../infrastructure/minio/minio-photo-storage';
import { ApsTokenProvider } from '../infrastructure/aps/aps-token-provider';

import { CreateIssueHandler } from './commands/create-issue';
import { UpdateIssueStatusHandler } from './commands/update-issue-status';
import { AddPhotoHandler } from './commands/add-photo';

/**
 * Repository インスタンスを取得
 */
export function getRepositories() {
  return {
    issue: new PrismaIssueRepository(),
    project: new PrismaProjectRepository(),
    building: new PrismaBuildingRepository(),
    floor: new PrismaFloorRepository(),
    photo: new PrismaPhotoRepository(),
  };
}

/**
 * Storage インスタンスを取得
 */
export function getStorages() {
  const bucketName = process.env.MINIO_BUCKET_NAME || 'photos';
  return {
    photoStorage: new MinioPhotoStorage(bucketName),
  };
}

/**
 * Provider インスタンスを取得
 */
export function getProviders() {
  const clientId = process.env.APS_CLIENT_ID || '';
  const clientSecret = process.env.APS_CLIENT_SECRET || '';
  return {
    viewerTokenProvider: new ApsTokenProvider(clientId, clientSecret),
  };
}

/**
 * Command ハンドラを取得
 */
export function getCommandHandlers() {
  const repos = getRepositories();
  const storages = getStorages();

  return {
    createIssue: new CreateIssueHandler(repos.issue),
    updateIssueStatus: new UpdateIssueStatusHandler(repos.issue),
    addPhoto: new AddPhotoHandler(
      repos.issue,
      storages.photoStorage,
      repos.photo
    ),
  };
}

/**
 * Query ハンドラ用のヘルパー
 * Query はシンプルな関数なので、直接インポートして使用
 * 必要に応じてこのファイルで export
 */
export function getQueryHandlers() {
  const storages = getStorages();
  return {
    photoStorage: storages.photoStorage,
  };
}
