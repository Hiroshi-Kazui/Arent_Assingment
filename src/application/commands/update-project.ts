import { IProjectRepository } from '../../domain/repositories/project-repository';
import { ProjectId, ProjectStatus } from '../../domain/models/project';

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  startDate?: string;
  dueDate?: string;
  plan?: string;
  status?: string;
}

export class UpdateProjectHandler {
  constructor(private projectRepository: IProjectRepository) {}

  async execute(input: UpdateProjectInput): Promise<void> {
    const projectId = ProjectId.create(input.projectId);
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const name = input.name ?? project.name;
    const startDate = input.startDate ? new Date(input.startDate) : project.startDate;
    const dueDate = input.dueDate ? new Date(input.dueDate) : project.dueDate;
    const plan = input.plan ?? project.plan;
    const status = input.status
      ? (Object.values(ProjectStatus) as string[]).includes(input.status)
        ? (input.status as ProjectStatus)
        : project.status
      : project.status;

    const updated = project.updateDetails(name, startDate, dueDate, plan, status);
    await this.projectRepository.save(updated);
  }
}
