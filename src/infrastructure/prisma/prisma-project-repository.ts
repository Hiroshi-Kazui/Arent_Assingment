import { IProjectRepository } from '../../domain/repositories/project-repository';
import {
  Project,
  ProjectId,
  ProjectStatus,
} from '../../domain/models/project';
import { BuildingId } from '../../domain/models/building';
import { OrganizationId } from '../../domain/models/organization';
import prisma from './prisma-client';

/**
 * Prisma を使用した Project Repository の実装
 */
export class PrismaProjectRepository implements IProjectRepository {
  async findById(id: ProjectId): Promise<Project | null> {
    const record = await prisma.project.findUnique({
      where: { project_id: id },
    });

    if (!record) {
      return null;
    }

    return this.mapToDomainModel(record);
  }

  async findAll(): Promise<Project[]> {
    const records = await prisma.project.findMany();
    return records.map((record) => this.mapToDomainModel(record));
  }

  /**
   * Prisma Project モデルを Domain Project に変換
   */
  private mapToDomainModel(record: any): Project {
    // status を ProjectStatus に変換
    const status = (
      Object.values(ProjectStatus) as string[]
    ).includes(record.status)
      ? (record.status as ProjectStatus)
      : ProjectStatus.Active;

    return Project.reconstruct(
      record.project_id as ProjectId,
      record.building_id as BuildingId,
      record.name,
      record.start_date,
      record.due_date,
      status,
      (record.branch_id ? OrganizationId.create(record.branch_id) : '' as OrganizationId),
      record.plan ?? ''
    );
  }

  async save(project: Project): Promise<void> {
    await prisma.project.upsert({
      where: { project_id: project.id },
      update: {
        building_id: project.buildingId,
        name: project.name,
        start_date: project.startDate,
        due_date: project.dueDate,
        status: project.status,
        branch_id: project.branchId || null,
        plan: project.plan,
      },
      create: {
        project_id: project.id,
        building_id: project.buildingId,
        name: project.name,
        start_date: project.startDate,
        due_date: project.dueDate,
        status: project.status,
        branch_id: project.branchId || null,
        plan: project.plan,
      },
    });
  }
}
