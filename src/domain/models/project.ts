import { BuildingId } from './building';

/**
 * Project ID - ブランド型で型安全性を確保
 */
export type ProjectId = string & { readonly __brand: 'ProjectId' };

export const ProjectId = {
  create: (value: string): ProjectId => {
    if (!value || value.trim().length === 0) {
      throw new Error('ProjectId must not be empty');
    }
    return value as ProjectId;
  },
};

/**
 * Project Status 列挙型
 */
export enum ProjectStatus {
  Planning = 'PLANNING',
  Active = 'ACTIVE',
  Completed = 'COMPLETED',
}

/**
 * Project 集約ルート
 * 施工プロジェクト全体を管理
 */
export class Project {
  private constructor(
    readonly id: ProjectId,
    readonly buildingId: BuildingId,
    readonly name: string,
    readonly startDate: Date,
    readonly dueDate: Date,
    readonly status: ProjectStatus
  ) {}

  /**
   * ファクトリメソッド - 新規作成
   */
  static create(
    id: ProjectId,
    buildingId: BuildingId,
    name: string,
    startDate: Date,
    dueDate: Date,
    status: ProjectStatus = ProjectStatus.Active
  ): Project {
    if (!name || name.trim().length === 0) {
      throw new Error('Project name must not be empty');
    }

    if (startDate >= dueDate) {
      throw new Error('Start date must be before due date');
    }

    return new Project(id, buildingId, name, startDate, dueDate, status);
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    id: ProjectId,
    buildingId: BuildingId,
    name: string,
    startDate: Date,
    dueDate: Date,
    status: ProjectStatus
  ): Project {
    return new Project(id, buildingId, name, startDate, dueDate, status);
  }

  /**
   * ステータス変更
   */
  changeStatus(newStatus: ProjectStatus): Project {
    return new Project(
      this.id,
      this.buildingId,
      this.name,
      this.startDate,
      this.dueDate,
      newStatus
    );
  }

  /**
   * 完了状態か判定
   */
  isCompleted(): boolean {
    return this.status === ProjectStatus.Completed;
  }
}
