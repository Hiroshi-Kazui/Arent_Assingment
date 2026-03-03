import { IssueId } from './issue';
import { IssueStatus } from './issue';
import { UserId } from './user';

export type StatusChangeLogId = string & { readonly __brand: 'StatusChangeLogId' };

export const StatusChangeLogId = {
  create: (value: string): StatusChangeLogId => {
    if (!value || value.trim().length === 0) {
      throw new Error('StatusChangeLogId must not be empty');
    }
    return value as StatusChangeLogId;
  },
};

export class StatusChangeLog {
  private constructor(
    readonly id: StatusChangeLogId,
    readonly issueId: IssueId,
    readonly fromStatus: IssueStatus,
    readonly toStatus: IssueStatus,
    readonly changedBy: UserId,
    readonly comment: string | undefined,
    readonly changedAt: Date
  ) {}

  static create(
    id: StatusChangeLogId,
    issueId: IssueId,
    fromStatus: IssueStatus,
    toStatus: IssueStatus,
    changedBy: UserId,
    comment?: string
  ): StatusChangeLog {
    return new StatusChangeLog(id, issueId, fromStatus, toStatus, changedBy, comment, new Date());
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    id: StatusChangeLogId,
    issueId: IssueId,
    fromStatus: IssueStatus,
    toStatus: IssueStatus,
    changedBy: UserId,
    changedAt: Date,
    comment?: string
  ): StatusChangeLog {
    return new StatusChangeLog(id, issueId, fromStatus, toStatus, changedBy, comment, changedAt);
  }
}
