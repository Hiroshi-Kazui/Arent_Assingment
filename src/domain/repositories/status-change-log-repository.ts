import { StatusChangeLog } from '../models/status-change-log';
import { IssueId } from '../models/issue';

export interface IStatusChangeLogRepository {
  save(log: StatusChangeLog): Promise<void>;
  findByIssueId(issueId: IssueId): Promise<StatusChangeLog[]>;
}
