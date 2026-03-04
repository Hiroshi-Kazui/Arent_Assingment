import { IIssueRepository } from '../../domain/repositories/issue-repository';
import {
  Issue,
  IssueId,
  IssueType,
  IssuePriority,
} from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';
import { FloorId } from '../../domain/models/floor';
import { UserId } from '../../domain/models/user';
import { Location } from '../../domain/models/location';
import { CreateIssueInput } from '../dto/issue-dto';
import { randomUUID } from 'crypto';

/**
 * 文字列から IssueType 列挙値へ変換
 * 大文字・小文字を正規化してマッピングする
 */
function parseIssueType(value: string | undefined): IssueType | undefined {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  const valid = Object.values(IssueType) as string[];
  if (valid.includes(normalized)) {
    return normalized as IssueType;
  }
  return undefined;
}

/**
 * Issue 作成コマンド
 */
export class CreateIssueHandler {
  constructor(private issueRepository: IIssueRepository) {}

  async execute(input: CreateIssueInput): Promise<string> {
    // Issue ID を生成
    const issueId = IssueId.create(randomUUID());
    const projectId = ProjectId.create(input.projectId);
    const floorId = FloorId.create(input.floorId);

    // Location を構築
    let location: Location;
    if (input.locationType === 'dbId' && input.dbId) {
      location = Location.createFromDbId(input.dbId);
    } else if (
      input.locationType === 'worldPosition' &&
      input.worldPositionX !== undefined &&
      input.worldPositionY !== undefined &&
      input.worldPositionZ !== undefined
    ) {
      location = Location.createFromWorldPosition(
        input.worldPositionX,
        input.worldPositionY,
        input.worldPositionZ
      );
    } else {
      throw new Error('Invalid location data');
    }

    // Issue 集約を生成
    if (!input.dueDate) {
      throw new Error('dueDate is required');
    }

    const dueDate = new Date(input.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new Error('Invalid dueDate');
    }

    const issueType = parseIssueType(input.issueType);
    const reportedByUserId = UserId.create(input.reportedBy);

    let issue: Issue;
    if (input.assigneeId) {
      const assigneeUserId = UserId.create(input.assigneeId);
      issue = Issue.createWithAssignee(
        issueId,
        projectId,
        floorId,
        input.title,
        input.description,
        issueType,
        reportedByUserId,
        location,
        dueDate,
        assigneeUserId,
        IssuePriority.Medium
      );
    } else {
      issue = Issue.create(
        issueId,
        projectId,
        floorId,
        input.title,
        input.description,
        issueType,
        reportedByUserId,
        location,
        dueDate,
        IssuePriority.Medium
      );
    }

    // Issue を永続化
    await this.issueRepository.save(issue);

    return issueId;
  }
}
