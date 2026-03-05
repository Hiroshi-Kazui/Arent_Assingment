import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { IPhotoRepository } from '../../domain/repositories/photo-repository';
import { IStatusChangeLogRepository } from '../../domain/repositories/status-change-log-repository';
import { IssueId } from '../../domain/models/issue';
import { PhotoPhase } from '../../domain/models/photo';
import { ProjectId } from '../../domain/models/project';
import { UserId } from '../../domain/models/user';
import { StatusChangeLog, StatusChangeLogId } from '../../domain/models/status-change-log';
import { UpdateIssueStatusInput } from '../dto/issue-dto';
import { InvalidStatusTransitionError } from '../../domain/errors/invalid-status-transition-error';
import { randomUUID } from 'crypto';

/**
 * Issue ステータス更新コマンド
 * Domain集約の状態遷移メソッドを経由し、不正遷移は例外で通知
 */
export class UpdateIssueStatusHandler {
  constructor(
    private issueRepository: IIssueRepository,
    private photoRepository: IPhotoRepository,
    private statusChangeLogRepository: IStatusChangeLogRepository
  ) {}

  async execute(input: UpdateIssueStatusInput): Promise<void> {
    const issueId = IssueId.create(input.issueId);
    const projectId = ProjectId.create(input.projectId);
    const changedBy = UserId.create(input.changedBy);

    const issue = await this.issueRepository.findById(issueId);
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`);
    }

    if (issue.projectId !== projectId) {
      throw new Error(
        `Issue does not belong to project ${projectId}`
      );
    }

    // ビジネスルール: 担当者以外はステータス変更不可。
    // ただし DONE→承認/否認、CONFIRMED→再指摘(OPEN) は例外
    const isDoneReview = issue.isDone() && (input.newStatus === 'CONFIRMED' || input.newStatus === 'OPEN');
    const isReissue = issue.isConfirmed() && input.newStatus === 'OPEN';
    if (issue.assigneeId && issue.assigneeId !== changedBy && !isDoneReview && !isReissue) {
      throw new Error('担当者以外はステータスを変更できません');
    }

    // ビジネスルール: InProgress → Done は是正後写真（After）が1枚以上必要
    if (input.newStatus === 'DONE') {
      const photos = await this.photoRepository.findByIssueId(issueId);
      const afterPhotos = photos.filter((p) => p.phase === PhotoPhase.After);
      if (afterPhotos.length === 0) {
        throw new Error('是正完了には是正後写真が1枚以上必要です');
      }
    }

    // コメント必須チェック（否認・再指摘時）
    if (
      (issue.isDone() && input.newStatus === 'OPEN') ||
      (issue.isConfirmed() && input.newStatus === 'OPEN')
    ) {
      if (!input.comment || input.comment.trim().length === 0) {
        throw new Error('否認・再指摘にはコメントが必須です');
      }
    }

    // 再指摘時は否認時写真(REJECTION)が1枚以上必要
    if (issue.isConfirmed() && input.newStatus === 'OPEN') {
      const photos = await this.photoRepository.findByIssueId(issueId);
      const rejectionPhotos = photos.filter((p) => p.phase === PhotoPhase.Rejection);
      if (rejectionPhotos.length === 0) {
        throw new Error('再指摘には否認時写真が1枚以上必要です');
      }
    }

    const fromStatus = issue.status;
    let updatedIssue = issue;

    // 状態遷移を実行（Domain層で不正遷移は例外が発生）
    if (issue.isOpen() && input.newStatus === 'IN_PROGRESS') {
      updatedIssue = issue.startWork();
    } else if (issue.isInProgress() && input.newStatus === 'DONE') {
      updatedIssue = issue.complete();
    } else if (issue.isInProgress() && input.newStatus === 'OPEN') {
      updatedIssue = issue.rejectWork();
    } else if (issue.isDone() && input.newStatus === 'IN_PROGRESS') {
      updatedIssue = issue.reopenAfterCompletion();
    } else if (issue.isDone() && input.newStatus === 'CONFIRMED') {
      updatedIssue = issue.confirm();
    } else if (issue.isDone() && input.newStatus === 'OPEN') {
      updatedIssue = issue.rejectCompletion();
    } else if (issue.isConfirmed() && input.newStatus === 'OPEN') {
      updatedIssue = issue.reissue();
    } else {
      throw new InvalidStatusTransitionError(
        issue.status,
        input.newStatus
      );
    }

    await this.issueRepository.save(updatedIssue);

    // StatusChangeLog 記録
    const log = StatusChangeLog.create(
      StatusChangeLogId.create(randomUUID()),
      issueId,
      fromStatus,
      updatedIssue.status,
      changedBy,
      input.comment
    );
    await this.statusChangeLogRepository.save(log);
  }
}
