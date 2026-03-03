import prisma from '../../infrastructure/prisma/prisma-client';
import { UserDto } from '../dto/user-dto';

export async function listAllUsers(): Promise<UserDto[]> {
  const users = await prisma.user.findMany({
    include: { organization: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  return users.map((u) => ({
    userId: u.user_id,
    organizationId: u.organization_id,
    organizationName: u.organization.name,
    name: u.name,
    email: u.email,
    role: u.role as 'ADMIN' | 'SUPERVISOR' | 'WORKER',
    isActive: u.is_active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }));
}
