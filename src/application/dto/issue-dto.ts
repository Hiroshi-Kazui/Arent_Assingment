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
  reportedBy: string;
  dueDate: string;
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  assigneeId?: string;
}

/**
 * Issue ステータス更新入力
 */
export interface UpdateIssueStatusInput {
  issueId: string;
  projectId: string;
  newStatus: 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED';
  comment?: string;
  changedBy: string;
}

/**
 * Issue タイトル更新入力
 */
export interface UpdateIssueTitleInput {
  issueId: string;
  projectId: string;
  title: string;
}

export interface UpdateIssueDescriptionInput {
  issueId: string;
  projectId: string;
  description: string;
}

/**
 * Issue 担当者割り当て入力
 */
export interface AssignIssueInput {
  issueId: string;
  projectId: string;
  assigneeId: string;
  changedBy: string;
}

/**
 * StatusChangeLog 表示用DTO
 */
export interface StatusChangeLogDto {
  logId: string;
  fromStatus: string;
  toStatus: string;
  changedByName: string;
  comment?: string;
  changedAt: string;
}

/**
 * Issue リスト表示用DTO
 */
export interface IssueListItemDto {
  issueId: string;
  title: string;
  issueType?: string;
  dueDate: string;
  status: 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED';
  priority: string;
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  reportedBy: string;
  assigneeId?: string;
  assigneeName?: string;
  floorName?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Issue 詳細表示用DTO
 */
export interface IssueDetailDto extends IssueListItemDto {
  projectId: string;
  description: string;
  floorId: string;
  floorName?: string;
  photos: PhotoDto[];
  assigneeId?: string;
  assigneeName?: string;
  statusChangeLogs: StatusChangeLogDto[];
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
  photoPhase: 'BEFORE' | 'AFTER' | 'REJECTION';
  uploadedBy: string;
}

/**
 * Photo 削除入力
 */
export interface DeletePhotoInput {
  photoId: string;
  userId: string;
  userRole: string;
}
