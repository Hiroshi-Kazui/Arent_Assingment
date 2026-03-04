import { IssueListItemDto } from '../dto/issue-dto';
import { ProjectId } from '../../domain/models/project';
import { FloorId } from '../../domain/models/floor';
import { PaginationParams, PaginatedResult, buildPaginatedResult } from '../dto/pagination';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Project の指摘一覧を取得（ページネーション対応）
 * floorId でフィルタ対応
 */
export async function listIssues(
  projectId: ProjectId,
  floorId?: FloorId,
  pagination?: PaginationParams
): Promise<PaginatedResult<IssueListItemDto>> {
  const where: { project_id: string; floor_id?: string } = { project_id: projectId };
  if (floorId) {
    where.floor_id = floorId;
  }

  const skip = pagination ? (pagination.page - 1) * pagination.limit : undefined;
  const take = pagination?.limit;

  const [issues, totalCount] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { due_date: 'asc' },
      skip,
      take,
    }),
    prisma.issue.count({ where }),
  ]);

  const items = issues.map((issue) => ({
    issueId: issue.issue_id,
    title: issue.title,
    issueType: issue.issue_type ?? undefined,
    dueDate: issue.due_date.toISOString(),
    status: issue.status as 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED',
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
    reportedBy: issue.reported_by,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  }));

  const params = pagination ?? { page: 1, limit: totalCount || 1 };
  return buildPaginatedResult(items, totalCount, params);
}
