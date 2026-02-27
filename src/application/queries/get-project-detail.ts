import { ProjectDetailDto } from '../dto/project-dto';
import { ProjectId } from '../../domain/models/project';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Project の詳細を取得
 */
export async function getProjectDetail(
  projectId: ProjectId
): Promise<ProjectDetailDto | null> {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    include: {
      building: true,
    },
  });

  if (!project) {
    return null;
  }

  return {
    projectId: project.project_id,
    name: project.name,
    buildingId: project.building_id,
    status: project.status,
    startDate: project.start_date,
    dueDate: project.due_date,
    building: {
      buildingId: project.building.building_id,
      name: project.building.name,
      address: project.building.address,
      modelUrn: project.building.model_urn,
    },
  };
}
