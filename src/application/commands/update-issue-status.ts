import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { IssueId } from '../../domain/models/issue';
import { PhotoPhase } from '../../domain/models/photo';
import { ProjectId } from '../../domain/models/project';
import { UpdateIssueStatusInput } from '../dto/issue-dto';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition-error';

/**
 * Issue ステータス更新コマンド
 * Domain集約の状態遷移メソッドを経由し、不正遷移は例外で通知
 */
export class UpdateIssueStatusHandler {
  constructor(
    private issueRepository: IIssueRepository,
    private photoRepository: IPhotoRepository
  ) {}

  async execute(input: UpdateIssueStatusInput): Promise<void> {
    const issueId = IssueId.create(input.issueId);
    const projectId = ProjectId.create(input.projectId);

    // Issue を取得
    const issue = await this.issueRepository.findById(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    // プロジェクト ID の一致確認
    if (issue.projectId !== projectId) {
      throw new Error(
        `Issue does not belong to project ${projectId}`
      );
    }

    // ビジネスルール: InProgress → Done は是正後写真（After）が1枚以上必要
    // Photo は Issue 集約の外側にあるため Application 層で検証する
    if (input.newStatus === 'DONE') {
      const photos = await this.photoRepository.findByIssueId(issueId);
      const afterPhotos = photos.filter((p) => p.phase === PhotoPhase.After);
      if (afterPhotos.length === 0) {
        throw new Error('是正完了には是正後写真が1枚以上必要です');
      }
    }

    // 状態遷移を実行（Domain層で不正遷移は例外が発生）
    let updatedIssue = issue;

    // 現在の状態と遷移先から適切なメソッドを選択
    if (issue.isOpen() && input.newStatus === 'IN_PROGRESS') {
      updatedIssue = issue.startWork(); // Open -> InProgress
    } else if (issue.isInProgress() && input.newStatus === 'DONE') {
      updatedIssue = issue.complete(); // InProgress -> Done
    } else if (issue.isInProgress() && input.newStatus === 'OPEN') {
      updatedIssue = issue.rejectWork(); // InProgress -> Open
    } else if (issue.isDone() && input.newStatus === 'IN_PROGRESS') {
      updatedIssue = issue.reopenAfterCompletion(); // Done -> InProgress
    } else {
      throw new InvalidStatusTransitionError(
        issue.status,
        input.newStatus
      );
    }

    // 更新後の Issue を永続化
    await this.issueRepository.save(updatedIssue);
  }
}
