import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { IssueId } from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';

export interface DeleteIssueInput {
  issueId: string;
  projectId: string;
}

export class DeleteIssueHandler {
  constructor(private issueRepository: IIssueRepository) {}

  async execute(input: DeleteIssueInput): Promise<void> {
    const issueId = IssueId.create(input.issueId);
    const projectId = ProjectId.create(input.projectId);

    const issue = await this.issueRepository.findById(issueId);
    if (!issue) throw new Error(`Issue not found: ${issueId}`);
    if (issue.projectId !== projectId) {
      throw new Error(`Issue does not belong to project ${projectId}`);
    }

    await this.issueRepository.delete(issueId);
  }
}
