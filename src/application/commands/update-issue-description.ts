import { IIssueRepository } from '../../domain/repositories/issue-repository';
import { IssueId } from '../../domain/models/issue';
import { ProjectId } from '../../domain/models/project';
import { UpdateIssueDescriptionInput } from '../dto/issue-dto';

export class UpdateIssueDescriptionHandler {
  constructor(private issueRepository: IIssueRepository) {}

  async execute(input: UpdateIssueDescriptionInput): Promise<void> {
    const issueId = IssueId.create(input.issueId);
    const projectId = ProjectId.create(input.projectId);

    const issue = await this.issueRepository.findById(issueId);
    if (!issue) throw new Error(`Issue not found: ${issueId}`);
    if (issue.projectId !== projectId) throw new Error(`Issue does not belong to project ${projectId}`);

    const updatedIssue = issue.updateDescription(input.description);
    await this.issueRepository.save(updatedIssue);
  }
}
