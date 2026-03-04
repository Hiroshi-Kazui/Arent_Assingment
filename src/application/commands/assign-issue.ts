import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { IStatusChangeLogRepository } from '../../domain/repositories/status-change-log-repository';
import { IssueId } from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';
import { UserId } from '../../domain/models/user';
import { StatusChangeLog, StatusChangeLogId } from '../../domain/models/status-change-log';
import { AssignIssueInput } from '../dto/issue-dto';
import { randomUUID } from 'crypto';

export class AssignIssueHandler {
  constructor(
    private issueRepository: IIssueRepository,
    private statusChangeLogRepository: IStatusChangeLogRepository
  ) {}

  async execute(input: AssignIssueInput): Promise<void> {
    const issueId = IssueId.create(input.issueId);
    const projectId = ProjectId.create(input.projectId);
    const assigneeId = UserId.create(input.assigneeId);
    const changedBy = UserId.create(input.changedBy);

    const issue = await this.issueRepository.findById(issueId);
    if (!issue) throw new Error(`Issue not found: ${issueId}`);
    if (issue.projectId !== projectId) throw new Error(`Issue does not belong to project ${projectId}`);

    const fromStatus = issue.status;
    const updatedIssue = issue.changeAssignee(assigneeId);

    await this.issueRepository.save(updatedIssue);

    // ステータスが変更された場合のみログ記録
    if (fromStatus !== updatedIssue.status) {
      const log = StatusChangeLog.create(
        StatusChangeLogId.create(randomUUID()),
        issueId,
        fromStatus,
        updatedIssue.status,
        changedBy
      );
      await this.statusChangeLogRepository.save(log);
    }
  }
}
