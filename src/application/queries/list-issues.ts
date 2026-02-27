import { IssueListItemDto } from '../dto/issue-dto';
import { ProjectId } from '../../domain/models/project';
import { FloorId } from '../../domain/models/floor';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Project の指摘一覧を取得
 * floorId でフィルタ対応
 */
export async function listIssues(
  projectId: ProjectId,
  floorId?: FloorId
): Promise<IssueListItemDto[]> {
  const where: any = { project_id: projectId };
  if (floorId) {
    where.floor_id = floorId;
  }

  const issues = await prisma.issue.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });

  return issues.map((issue) => ({
    issueId: issue.issue_id,
    title: issue.title,
    issueType: issue.issue_type ?? undefined,
    status: issue.status as 'OPEN' | 'IN_PROGRESS' | 'DONE',
    priority: issue.priority,
    locationType: issue.location_type as 'dbId' | 'worldPosition',
    dbId: issue.db_id ? String(issue.db_id) : undefined,
    worldPositionX: issue.world_position_x
      ? Number(issue.world_position_x)
      : undefined,
    worldPositionY: issue.world_position_y
      ? Number(issue.world_position_y)
      : undefined,
    worldPositionZ: issue.world_position_z
      ? Number(issue.world_position_z)
      : undefined,
    reportedBy: issue.reported_by ?? undefined,
    createdAt: issue.created_at,
  }));
}
