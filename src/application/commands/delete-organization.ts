import { OrganizationId, OrganizationType } from '../../domain/models/organization';
import { IOrganizationRepository } from '../../domain/repositories/organization-repository';
import { DomainError } from '../../domain/errors/domain-error';
import prisma from '../../infrastructure/prisma/prisma-client';

export class OrganizationHasUsersError extends DomainError {
  constructor(organizationId: string) {
    super(`Organization ${organizationId} still has active users and cannot be deleted`);
    Object.setPrototypeOf(this, OrganizationHasUsersError.prototype);
  }
}

export class DeleteOrganizationHandler {
  constructor(private readonly repo: IOrganizationRepository) {}

  async execute(id: string): Promise<void> {
    const orgId = OrganizationId.create(id);
    const org = await this.repo.findById(orgId);

    if (!org) {
      throw new DomainError(`Organization not found: ${id}`);
    }

    if (org.type === OrganizationType.Headquarters) {
      throw new DomainError('Cannot delete headquarters organization');
    }

    const userCount = await prisma.user.count({
      where: { organization_id: id },
    });

    if (userCount > 0) {
      throw new OrganizationHasUsersError(id);
    }

    await this.repo.delete(orgId);
  }
}
