import { ProjectListItemDto } from '../dto/project-dto';
import { PaginationParams, PaginatedResult, buildPaginatedResult } from '../dto/pagination';
import prisma from '../../infrastructure/prisma/prisma-client';
import { Prisma } from '@prisma/client';

/**
 * プロジェクト一覧を取得（ページネーション対応）
 * 各プロジェクトの指摘件数と進捗率を含む
 * ロールベースのスコープフィルタ対応
 */
export async function listProjects(
  pagination: PaginationParams,
  userRole?: string,
  organizationId?: string,
  userId?: string
): Promise<PaginatedResult<ProjectListItemDto>> {
  // Build where clause based on role
  const whereConditions: Prisma.ProjectWhereInput = {};

  if (userRole === 'SUPERVISOR' && organizationId) {
    // Supervisor: only projects belonging to their branch
    whereConditions.branch_id = organizationId;
  } else if (userRole === 'WORKER' && userId) {
    // Worker: only projects that have issues assigned to them
    whereConditions.issues = {
      some: {
        assignee_id: userId,
      },
    };
  }
  // ADMIN: no filter (sees all)

  const [projects, totalCount] = await Promise.all([
    prisma.project.findMany({
      where: whereConditions,
      include: {
        _count: {
          select: { issues: true },
        },
        issues: {
          select: { status: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.project.count({ where: whereConditions }),
  ]);

  const items: ProjectListItemDto[] = projects.map((project) => {
    // Calculate progress rate: AVG(DONE=50, CONFIRMED=100, else=0)
    let progressRate = 0;
    if (project.issues.length > 0) {
      const total = project.issues.reduce((sum, issue) => {
        if (issue.status === 'CONFIRMED') return sum + 100;
        if (issue.status === 'DONE') return sum + 50;
        return sum;
      }, 0);
      progressRate = Math.round(total / project.issues.length);
    }

    return {
      projectId: project.project_id,
      name: project.name,
      buildingId: project.building_id,
      branchId: project.branch_id ?? '',
      status: project.status,
      issueCount: project._count.issues,
      progressRate,
      startDate: project.start_date,
      dueDate: project.due_date,
    };
  });

  return buildPaginatedResult(items, totalCount, pagination);
}
