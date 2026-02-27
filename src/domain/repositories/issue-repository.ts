import { Issue, IssueId } from '../models/issue';
import { ProjectId } from '../models/project';
import { FloorId } from '../models/floor';

/**
 * Issue リポジトリインターフェース
 * Issue 集約の永続化と取得を担当
 */
export interface IIssueRepository {
  /**
   * Issue を永続化
   */
  save(issue: Issue): Promise<void>;

  /**
   * Issue ID から Issue を取得
   */
  findById(id: IssueId): Promise<Issue | null>;

  /**
   * プロジェクト内のすべての Issue を取得
   */
  findByProjectId(projectId: ProjectId): Promise<Issue[]>;

  /**
   * プロジェクト内の特定の Floor に関連する Issue を取得
   */
  findByProjectIdAndFloorId(
    projectId: ProjectId,
    floorId: FloorId
  ): Promise<Issue[]>;
}
