import { ProjectListItemDto } from '../dto/project-dto';
import { PaginationParams, PaginatedResult, buildPaginatedResult } from '../dto/pagination';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * プロジェクト一覧を取得（ページネーション対応）
 * 各プロジェクトの指摘件数を含む
 */
export async function listProjects(
  pagination: PaginationParams
): Promise<PaginatedResult<ProjectListItemDto>> {
  const [projects, totalCount] = await Promise.all([
    prisma.project.findMany({
      include: {
        _count: {
          select: { issues: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.project.count(),
  ]);

  const items = projects.map((project) => ({
    projectId: project.project_id,
    name: project.name,
    buildingId: project.building_id,
    status: project.status,
    issueCount: project._count.issues,
    startDate: project.start_date,
    dueDate: project.due_date,
  }));

  return buildPaginatedResult(items, totalCount, pagination);
}
