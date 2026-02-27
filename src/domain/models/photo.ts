import { IssueId } from './issue';

/**
 * Photo ID - ブランド型で型安全性を確保
 */
export type PhotoId = string & { readonly __brand: 'PhotoId' };

export const PhotoId = {
  create: (value: string): PhotoId => {
    if (!value || value.trim().length === 0) {
      throw new Error('PhotoId must not be empty');
    }
    return value as PhotoId;
  },
};

/**
 * Photo Phase 列挙型
 * Before: 指摘時点での状況を示す写真
 * After: 是正後の状況を示す写真
 */
export enum PhotoPhase {
  Before = 'BEFORE',
  After = 'AFTER',
}

/**
 * Photo エンティティ
 * Issue に紐づく写真を管理
 */
export class Photo {
  private constructor(
    readonly id: PhotoId,
    readonly issueId: IssueId,
    readonly blobKey: string,
    readonly phase: PhotoPhase,
    readonly uploadedAt: Date
  ) {}

  /**
   * ファクトリメソッド - 新規作成
   */
  static create(
    id: PhotoId,
    issueId: IssueId,
    blobKey: string,
    phase: PhotoPhase
  ): Photo {
    if (!blobKey || blobKey.trim().length === 0) {
      throw new Error('Photo blobKey must not be empty');
    }

    return new Photo(id, issueId, blobKey, phase, new Date());
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    id: PhotoId,
    issueId: IssueId,
    blobKey: string,
    phase: PhotoPhase,
    uploadedAt: Date
  ): Photo {
    return new Photo(id, issueId, blobKey, phase, uploadedAt);
  }

  /**
   * Before フェーズか判定
   */
  isBefore(): boolean {
    return this.phase === PhotoPhase.Before;
  }

  /**
   * After フェーズか判定
   */
  isAfter(): boolean {
    return this.phase === PhotoPhase.After;
  }
}
