import { IProjectRepository } from '../../domain/repositories/project-repository';
import { Project, ProjectId, ProjectStatus } from '../../domain/models/project';
import { BuildingId } from '../../domain/models/building';
import { OrganizationId } from '../../domain/models/organization';
import { randomUUID } from 'crypto';

export interface CreateProjectInput {
  buildingId: string;
  name: string;
  startDate: string;
  dueDate: string;
  branchId: string;
  plan?: string;
}

export class CreateProjectHandler {
  constructor(private projectRepository: IProjectRepository) {}

  async execute(input: CreateProjectInput): Promise<string> {
    const projectId = ProjectId.create(randomUUID());
    const buildingId = BuildingId.create(input.buildingId);
    const branchId = OrganizationId.create(input.branchId);

    const startDate = new Date(input.startDate);
    const dueDate = new Date(input.dueDate);

    if (Number.isNaN(startDate.getTime())) {
      throw new Error('Invalid startDate');
    }
    if (Number.isNaN(dueDate.getTime())) {
      throw new Error('Invalid dueDate');
    }

    const project = Project.create(
      projectId,
      buildingId,
      input.name,
      startDate,
      dueDate,
      ProjectStatus.Planning,
      branchId,
      input.plan ?? ''
    );

    await this.projectRepository.save(project);
    return projectId;
  }
}
