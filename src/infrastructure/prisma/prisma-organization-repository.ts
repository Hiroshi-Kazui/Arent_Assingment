import { Organization, OrganizationId, OrganizationType } from '../../domain/models/organization';
import { IOrganizationRepository } from '../../domain/repositories/organization-repository';
import prisma from './prisma-client';

export class PrismaOrganizationRepository implements IOrganizationRepository {
  async findById(id: OrganizationId): Promise<Organization | null> {
    const record = await prisma.organization.findUnique({
      where: { organization_id: id },
    });

    if (!record) {
      return null;
    }

    return this.mapToDomainModel(record);
  }

  async findAll(): Promise<Organization[]> {
    const records = await prisma.organization.findMany({
      orderBy: { created_at: 'asc' },
    });

    return records.map((record) => this.mapToDomainModel(record));
  }

  async save(org: Organization): Promise<void> {
    await prisma.organization.upsert({
      where: { organization_id: org.id },
      create: {
        organization_id: org.id,
        name: org.name,
        type: org.type,
        parent_id: org.parentId ?? null,
        created_at: org.createdAt,
        updated_at: org.updatedAt,
      },
      update: {
        name: org.name,
        updated_at: new Date(),
      },
    });
  }

  async delete(id: OrganizationId): Promise<void> {
    await prisma.organization.delete({
      where: { organization_id: id },
    });
  }

  private mapToDomainModel(record: {
    organization_id: string;
    name: string;
    type: string;
    parent_id: string | null;
    created_at: Date;
    updated_at: Date;
  }): Organization {
    return Organization.reconstruct(
      OrganizationId.create(record.organization_id),
      record.name,
      record.type as OrganizationType,
      record.parent_id ? OrganizationId.create(record.parent_id) : undefined,
      record.created_at,
      record.updated_at
    );
  }
}
