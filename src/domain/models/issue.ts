import { ProjectId } from './project';
import { FloorId } from './floor';
import { Location, LocationType } from './location';
import {
  InvalidStatusTransitionError,
} from '../errors/invalid-status-transition-error';

/**
 * Issue ID - ブランド型で型安全性を確保
 */
export type IssueId = string & { readonly __brand: 'IssueId' };

export const IssueId = {
  create: (value: string): IssueId => {
    if (!value || value.trim().length === 0) {
      throw new Error('IssueId must not be empty');
    }
    return value as IssueId;
  },
};

/**
 * Issue Status 列挙型
 */
export enum IssueStatus {
  Open = 'OPEN',
  InProgress = 'IN_PROGRESS',
  Done = 'DONE',
}

/**
 * Issue 優先度列挙型
 */
export enum IssuePriority {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
  Critical = 'CRITICAL',
}

/**
 * Issue 集約ルート
 * 施工現場の指摘を管理
 * **状態遷移ロジックをこのクラス内に実装**
 */
export class Issue {
  private constructor(
    readonly id: IssueId,
    readonly projectId: ProjectId,
    readonly floorId: FloorId,
    readonly title: string,
    readonly description: string,
    readonly location: Location,
    readonly priority: IssuePriority,
    readonly status: IssueStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date
  ) {}

  /**
   * ファクトリメソッド - 新規作成
   */
  static create(
    id: IssueId,
    projectId: ProjectId,
    floorId: FloorId,
    title: string,
    description: string,
    location: Location,
    priority: IssuePriority = IssuePriority.Medium
  ): Issue {
    if (!title || title.trim().length === 0) {
      throw new Error('Issue title must not be empty');
    }

    if (!description || description.trim().length === 0) {
      throw new Error('Issue description must not be empty');
    }

    const now = new Date();
    return new Issue(
      id,
      projectId,
      floorId,
      title,
      description,
      location,
      priority,
      IssueStatus.Open,
      now,
      now
    );
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    id: IssueId,
    projectId: ProjectId,
    floorId: FloorId,
    title: string,
    description: string,
    location: Location,
    priority: IssuePriority,
    status: IssueStatus,
    createdAt: Date,
    updatedAt: Date
  ): Issue {
    return new Issue(
      id,
      projectId,
      floorId,
      title,
      description,
      location,
      priority,
      status,
      createdAt,
      updatedAt
    );
  }

  /**
   * 状態遷移：Open → InProgress（着手）
   */
  startWork(): Issue {
    if (this.status !== IssueStatus.Open) {
      throw new InvalidStatusTransitionError(
        this.status,
        IssueStatus.InProgress
      );
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.location,
      this.priority,
      IssueStatus.InProgress,
      this.createdAt,
      new Date()
    );
  }

  /**
   * 状態遷移：InProgress → Done（是正完了）
   */
  complete(): Issue {
    if (this.status !== IssueStatus.InProgress) {
      throw new InvalidStatusTransitionError(this.status, IssueStatus.Done);
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.location,
      this.priority,
      IssueStatus.Done,
      this.createdAt,
      new Date()
    );
  }

  /**
   * 状態遷移：InProgress → Open（差し戻し）
   */
  rejectWork(): Issue {
    if (this.status !== IssueStatus.InProgress) {
      throw new InvalidStatusTransitionError(this.status, IssueStatus.Open);
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.location,
      this.priority,
      IssueStatus.Open,
      this.createdAt,
      new Date()
    );
  }

  /**
   * 状態遷移：Done → InProgress（再指摘）
   */
  reopenAfterCompletion(): Issue {
    if (this.status !== IssueStatus.Done) {
      throw new InvalidStatusTransitionError(
        this.status,
        IssueStatus.InProgress
      );
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.location,
      this.priority,
      IssueStatus.InProgress,
      this.createdAt,
      new Date()
    );
  }

  /**
   * ビジネスルール：Open → Done は禁止
   * このメソッドは存在しない（呼び出す方法がない）
   */

  /**
   * Open 状態か判定
   */
  isOpen(): boolean {
    return this.status === IssueStatus.Open;
  }

  /**
   * InProgress 状態か判定
   */
  isInProgress(): boolean {
    return this.status === IssueStatus.InProgress;
  }

  /**
   * Done 状態か判定
   */
  isDone(): boolean {
    return this.status === IssueStatus.Done;
  }

  /**
   * 優先度を変更
   */
  changePriority(newPriority: IssuePriority): Issue {
    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.location,
      newPriority,
      this.status,
      this.createdAt,
      new Date()
    );
  }
}
