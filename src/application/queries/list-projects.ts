import { ProjectListItemDto } from '../dto/project-dto';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * すべてのプロジェクト一覧を取得
 * 各プロジェクトの指摘件数を含む
 */
export async function listProjects(): Promise<ProjectListItemDto[]> {
  const projects = await prisma.project.findMany({
    include: {
      _count: {
        select: { issues: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return projects.map((project) => ({
    projectId: project.project_id,
    name: project.name,
    buildingId: project.building_id,
    status: project.status,
    issueCount: project._count.issues,
    startDate: project.start_date,
    dueDate: project.due_date,
  }));
}
