import { IStatusChangeLogRepository } from '../../domain/repositories/status-change-log-repository';
import { StatusChangeLog, StatusChangeLogId } from '../../domain/models/status-change-log';
import { IssueId, IssueStatus } from '../../domain/models/issue';
import { UserId } from '../../domain/models/user';
import prisma from './prisma-client';

export class PrismaStatusChangeLogRepository implements IStatusChangeLogRepository {
  async save(log: StatusChangeLog): Promise<void> {
    await prisma.statusChangeLog.create({
      data: {
        log_id: log.id,
        issue_id: log.issueId,
        from_status: log.fromStatus,
        to_status: log.toStatus,
        changed_by: log.changedBy,
        comment: log.comment ?? null,
        changed_at: log.changedAt,
      },
    });
  }

  async findByIssueId(issueId: IssueId): Promise<StatusChangeLog[]> {
    const records = await prisma.statusChangeLog.findMany({
      where: { issue_id: issueId },
      orderBy: { changed_at: 'asc' },
    });

    return records.map((record) =>
      StatusChangeLog.reconstruct(
        record.log_id as StatusChangeLogId,
        record.issue_id as IssueId,
        record.from_status as IssueStatus,
        record.to_status as IssueStatus,
        record.changed_by as UserId,
        record.changed_at,
        record.comment ?? undefined
      )
    );
  }
}
