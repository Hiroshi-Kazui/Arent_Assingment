import { ProjectId } from './project';
import { FloorId } from './floor';
import { Location, LocationType } from './location';
import { UserId } from './user';
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
 * Issue Type 列挙型
 * 指摘の種別を表す
 * Quality: 品質不良 / Safety: 安全不備 / Construction: 施工不備 / Design: 設計変更
 */
export enum IssueType {
  Quality = 'QUALITY',
  Safety = 'SAFETY',
  Construction = 'CONSTRUCTION',
  Design = 'DESIGN',
}

/**
 * Issue Status 列挙型
 */
export enum IssueStatus {
  PointOut = 'POINT_OUT',
  Open = 'OPEN',
  InProgress = 'IN_PROGRESS',
  Done = 'DONE',
  Confirmed = 'CONFIRMED',
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
    readonly issueType: IssueType | undefined,
    readonly reportedBy: UserId,
    readonly location: Location,
    readonly priority: IssuePriority,
    readonly status: IssueStatus,
    readonly dueDate: Date,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly assigneeId: UserId | undefined = undefined
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
    issueType: IssueType | undefined,
    reportedBy: UserId,
    location: Location,
    dueDate: Date,
    priority: IssuePriority = IssuePriority.Medium
  ): Issue {
    if (!title || title.trim().length === 0) {
      throw new Error('Issue title must not be empty');
    }

    if (!description || description.trim().length === 0) {
      throw new Error('Issue description must not be empty');
    }
    if (Number.isNaN(dueDate.getTime())) {
      throw new Error('Issue dueDate is invalid');
    }

    const now = new Date();
    return new Issue(
      id,
      projectId,
      floorId,
      title,
      description,
      issueType,
      reportedBy,
      location,
      priority,
      IssueStatus.PointOut,
      dueDate,
      now,
      now,
      undefined
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
    issueType: IssueType | undefined,
    reportedBy: UserId,
    location: Location,
    priority: IssuePriority,
    status: IssueStatus,
    dueDate: Date,
    createdAt: Date,
    updatedAt: Date,
    assigneeId: UserId | undefined
  ): Issue {
    return new Issue(
      id,
      projectId,
      floorId,
      title,
      description,
      issueType,
      reportedBy,
      location,
      priority,
      status,
      dueDate,
      createdAt,
      updatedAt,
      assigneeId
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
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.InProgress,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
    );
  }

  /**
   * 状態遷移：InProgress → Done（是正完了）
   *
   * ビジネスルール: 是正後写真（After）が1枚以上必要。
   * ただし、この制約は Issue 集約の外側（Photo エンティティ）にある情報に依存するため、
   * Application 層の UpdateIssueStatusHandler で検証する。
   * （集約外部の情報を集約内で参照することは DDD の境界違反になる）
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
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.Done,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
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
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.Open,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
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
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.InProgress,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
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
      this.issueType,
      this.reportedBy,
      this.location,
      newPriority,
      this.status,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
    );
  }

  /**
   * 状態遷移：PointOut → Open（Assignee設定時）
   */
  assignTo(assigneeId: UserId): Issue {
    if (this.status !== IssueStatus.PointOut) {
      throw new InvalidStatusTransitionError(this.status, IssueStatus.Open);
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.Open,
      this.dueDate,
      this.createdAt,
      new Date(),
      assigneeId
    );
  }

  /**
   * 状態遷移：Done → Confirmed（Supervisor承認）
   */
  confirm(): Issue {
    if (this.status !== IssueStatus.Done) {
      throw new InvalidStatusTransitionError(this.status, IssueStatus.Confirmed);
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.Confirmed,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
    );
  }

  /**
   * 状態遷移：Done → Open（否認）
   */
  rejectCompletion(): Issue {
    if (this.status !== IssueStatus.Done) {
      throw new InvalidStatusTransitionError(this.status, IssueStatus.Open);
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.Open,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
    );
  }

  /**
   * 状態遷移：Confirmed → Open（再指摘）
   */
  reissue(): Issue {
    if (this.status !== IssueStatus.Confirmed) {
      throw new InvalidStatusTransitionError(this.status, IssueStatus.Open);
    }

    return new Issue(
      this.id,
      this.projectId,
      this.floorId,
      this.title,
      this.description,
      this.issueType,
      this.reportedBy,
      this.location,
      this.priority,
      IssueStatus.Open,
      this.dueDate,
      this.createdAt,
      new Date(),
      this.assigneeId
    );
  }

  /**
   * PointOut 状態か判定
   */
  isPointOut(): boolean {
    return this.status === IssueStatus.PointOut;
  }

  /**
   * Confirmed 状態か判定
   */
  isConfirmed(): boolean {
    return this.status === IssueStatus.Confirmed;
  }
}
