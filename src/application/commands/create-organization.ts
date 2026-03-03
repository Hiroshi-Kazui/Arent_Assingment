import { Organization, OrganizationId, OrganizationType } from '../../domain/models/organization';
import { IOrganizationRepository } from '../../domain/repositories/organization-repository';
import { CreateOrganizationInput } from '../dto/organization-dto';

export class CreateOrganizationHandler {
  constructor(private readonly repo: IOrganizationRepository) {}

  async execute(input: CreateOrganizationInput): Promise<Organization> {
    const id = OrganizationId.create(crypto.randomUUID());
    const parentId = OrganizationId.create(input.parentId);
    const org = Organization.create(id, input.name, OrganizationType.Branch, parentId);
    await this.repo.save(org);
    return org;
  }
}
