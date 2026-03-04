/**
 * 依存注入コンテナ
 * Repository、Storage、Provider、Command/Queryハンドラのバインド
 */

import { PrismaIssueRepository } from '../infrastructure/prisma/prisma-issue-repository';
import { PrismaProjectRepository } from '../infrastructure/prisma/prisma-project-repository';
import { PrismaBuildingRepository } from '../infrastructure/prisma/prisma-building-repository';
import { PrismaFloorRepository } from '../infrastructure/prisma/prisma-floor-repository';
import { PrismaPhotoRepository } from '../infrastructure/prisma/prisma-photo-repository';
import { PrismaStatusChangeLogRepository } from '../infrastructure/prisma/prisma-status-change-log-repository';
import { PrismaOrganizationRepository } from '../infrastructure/prisma/prisma-organization-repository';
import { MinioPhotoStorage } from '../infrastructure/minio/minio-photo-storage';
import { ApsTokenProvider } from '../infrastructure/aps/aps-token-provider';

import { CreateIssueHandler } from './commands/create-issue';
import { UpdateIssueStatusHandler } from './commands/update-issue-status';
import { AddPhotoHandler } from './commands/add-photo';
import { AssignIssueHandler } from './commands/assign-issue';
import { CreateOrganizationHandler } from './commands/create-organization';
import { UpdateOrganizationHandler } from './commands/update-organization';
import { DeleteOrganizationHandler } from './commands/delete-organization';
import { CreateUserHandler } from './commands/create-user';
import { UpdateUserHandler } from './commands/update-user';
import { DeactivateUserHandler } from './commands/deactivate-user';
import { DeleteIssueHandler } from './commands/delete-issue';

// ApsTokenProvider はキャッシュを内部で持つため、シングルトンとして保持
// リクエストごとに新規インスタンスを生成するとキャッシュが無効になる
const globalWithProviders = global as typeof globalThis & {
  apsTokenProvider?: ApsTokenProvider;
};

function getApsTokenProvider(): ApsTokenProvider {
  if (!globalWithProviders.apsTokenProvider) {
    const clientId = process.env.APS_CLIENT_ID || '';
    const clientSecret = process.env.APS_CLIENT_SECRET || '';
    globalWithProviders.apsTokenProvider = new ApsTokenProvider(clientId, clientSecret);
  }
  return globalWithProviders.apsTokenProvider;
}

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
    statusChangeLog: new PrismaStatusChangeLogRepository(),
    organization: new PrismaOrganizationRepository(),
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
  return {
    viewerTokenProvider: getApsTokenProvider(),
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
    updateIssueStatus: new UpdateIssueStatusHandler(repos.issue, repos.photo, repos.statusChangeLog),
    addPhoto: new AddPhotoHandler(
      repos.issue,
      storages.photoStorage,
      repos.photo
    ),
    assignIssue: new AssignIssueHandler(repos.issue, repos.statusChangeLog),
    createOrganization: new CreateOrganizationHandler(repos.organization),
    updateOrganization: new UpdateOrganizationHandler(repos.organization),
    deleteOrganization: new DeleteOrganizationHandler(repos.organization),
    createUser: new CreateUserHandler(),
    updateUser: new UpdateUserHandler(),
    deactivateUser: new DeactivateUserHandler(),
    deleteIssue: new DeleteIssueHandler(repos.issue),
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
