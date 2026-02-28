import { IIssueRepository } from '../../domain/repositories/issue-repository';
import {
  Issue,
  IssueId,
  IssuePriority,
} from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';
import { FloorId } from '../../domain/models/floor';
import { Location } from '../../domain/models/location';
import { CreateIssueInput } from '../dto/issue-dto';
import { randomUUID } from 'crypto';

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
    const issue = Issue.create(
      issueId,
      projectId,
      floorId,
      input.title,
      input.description,
      input.issueType,
      1,
      location
    );

    // Issue を永続化
    await this.issueRepository.save(issue);

    return issueId;
  }
}
