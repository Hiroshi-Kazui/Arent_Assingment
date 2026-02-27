import { PhotoDto } from './photo-dto';

/**
 * Issue 作成入力
 */
export interface CreateIssueInput {
  projectId: string;
  floorId: string;
  title: string;
  description: string;
  issueType?: string;
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  reportedBy?: string;
}

/**
 * Issue ステータス更新入力
 */
export interface UpdateIssueStatusInput {
  issueId: string;
  projectId: string;
  newStatus: 'OPEN' | 'IN_PROGRESS' | 'DONE';
}

/**
 * Issue リスト表示用DTO
 */
export interface IssueListItemDto {
  issueId: string;
  title: string;
  issueType?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  priority: string;
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  reportedBy?: string;
  createdAt: Date;
}

/**
 * Issue 詳細表示用DTO
 */
export interface IssueDetailDto extends IssueListItemDto {
  projectId: string;
  description: string;
  floorId: string;
  photos: PhotoDto[];
}

/**
 * Photo アップロード入力
 */
export interface AddPhotoInput {
  issueId: string;
  projectId: string;
  file: Buffer;
  fileName: string;
  contentType: string;
  photoPhase: 'BEFORE' | 'AFTER';
}
