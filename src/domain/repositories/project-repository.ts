import { Project, ProjectId } from '../models/project';

/**
 * Project リポジトリインターフェース
 * Project 集約の取得を担当
 */
export interface IProjectRepository {
  /**
   * Project ID から Project を取得
   */
  findById(id: ProjectId): Promise<Project | null>;

  /**
   * すべての Project を取得
   */
  findAll(): Promise<Project[]>;

  /**
   * Project を保存（新規作成または更新）
   */
  save(project: Project): Promise<void>;
}
