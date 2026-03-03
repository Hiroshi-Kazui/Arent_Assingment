import { Organization, OrganizationId } from '../../domain/models/organization';
import { IOrganizationRepository } from '../../domain/repositories/organization-repository';
import { UpdateOrganizationInput } from '../dto/organization-dto';
import { DomainError } from '../../domain/errors/domain-error';

export class UpdateOrganizationHandler {
  constructor(private readonly repo: IOrganizationRepository) {}

  async execute(input: UpdateOrganizationInput): Promise<void> {
    const id = OrganizationId.create(input.organizationId);
    const org = await this.repo.findById(id);
    if (!org) {
      throw new DomainError(`Organization not found: ${input.organizationId}`);
    }

    const updated = Organization.reconstruct(
      org.id,
      input.name,
      org.type,
      org.parentId,
      org.createdAt,
      new Date()
    );

    await this.repo.save(updated);
  }
}
