import prisma from '../../infrastructure/prisma/prisma-client';
import { OrganizationDto } from '../dto/organization-dto';

export async function listOrganizations(): Promise<OrganizationDto[]> {
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { users: true, projects: true } } },
    orderBy: { created_at: 'asc' },
  });

  return orgs.map((o) => ({
    organizationId: o.organization_id,
    name: o.name,
    type: o.type as 'HEADQUARTERS' | 'BRANCH',
    parentId: o.parent_id ?? undefined,
    userCount: o._count.users,
    projectCount: o._count.projects,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  }));
}
