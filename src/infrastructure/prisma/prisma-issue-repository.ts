import { IIssueRepository } from '../../domain/repositories/issue-repository';
import {
  Issue,
  IssueId,
  IssueStatus,
  IssuePriority,
} from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';
import { FloorId } from '../../domain/models/floor';
import { Location } from '../../domain/models/location';
import prisma from './prisma-client';

/**
 * Prisma を使用した Issue Repository の実装
 * Prisma モデル ↔ Domain Issue モデルのマッピングを担当
 */
export class PrismaIssueRepository implements IIssueRepository {
  async save(issue: Issue): Promise<void> {
    const location = issue.location.value;

    const dbId =
      location.type === 'dbId' ? location.dbId : undefined;
    const [x, y, z] =
      location.type === 'worldPosition'
        ? [location.x, location.y, location.z]
        : [undefined, undefined, undefined];

    await prisma.issue.upsert({
      where: { issue_id: issue.id },
      update: {
        title: issue.title,
        description: issue.description,
        issue_type: issue.issueType,
        reported_by: issue.reportedBy,
        priority: issue.priority,
        status: issue.status,
        location_type: location.type,
        db_id: dbId ? parseInt(dbId, 10) : null,
        world_position_x: x !== undefined ? String(x) : null,
        world_position_y: y !== undefined ? String(y) : null,
        world_position_z: z !== undefined ? String(z) : null,
        updated_at: issue.updatedAt,
      },
      create: {
        issue_id: issue.id,
        project_id: issue.projectId,
        floor_id: issue.floorId,
        title: issue.title,
        description: issue.description,
        issue_type: issue.issueType,
        reported_by: issue.reportedBy,
        priority: issue.priority,
        status: issue.status,
        location_type: location.type,
        db_id: dbId ? parseInt(dbId, 10) : null,
        world_position_x: x !== undefined ? String(x) : null,
        world_position_y: y !== undefined ? String(y) : null,
        world_position_z: z !== undefined ? String(z) : null,
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
      },
    });
  }

  async findById(id: IssueId): Promise<Issue | null> {
    const record = await prisma.issue.findUnique({
      where: { issue_id: id },
    });

    if (!record) {
      return null;
    }

    return this.mapToDomainModel(record);
  }

  async findByProjectId(projectId: ProjectId): Promise<Issue[]> {
    const records = await prisma.issue.findMany({
      where: { project_id: projectId },
    });

    return records.map((record) => this.mapToDomainModel(record));
  }

  async findByProjectIdAndFloorId(
    projectId: ProjectId,
    floorId: FloorId
  ): Promise<Issue[]> {
    const records = await prisma.issue.findMany({
      where: {
        project_id: projectId,
        floor_id: floorId,
      },
    });

    return records.map((record) => this.mapToDomainModel(record));
  }

  /**
   * Prisma Issue モデルを Domain Issue に変換
   */
  private mapToDomainModel(record: any): Issue {
    // Location の再構築
    let location: Location;
    if (record.location_type === 'dbId' && record.db_id) {
      location = Location.createFromDbId(String(record.db_id));
    } else if (
      record.location_type === 'worldPosition' &&
      record.world_position_x &&
      record.world_position_y &&
      record.world_position_z
    ) {
      location = Location.createFromWorldPosition(
        Number(record.world_position_x),
        Number(record.world_position_y),
        Number(record.world_position_z)
      );
    } else {
      throw new Error(
        `Invalid location data for issue ${record.issue_id}`
      );
    }

    return Issue.reconstruct(
      record.issue_id as IssueId,
      record.project_id as ProjectId,
      record.floor_id as FloorId,
      record.title,
      record.description,
      record.issue_type ?? undefined,
      Number(record.reported_by),
      location,
      record.priority as IssuePriority,
      record.status as IssueStatus,
      record.created_at,
      record.updated_at
    );
  }
}
