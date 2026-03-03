import { User, UserId, UserRole } from '../../domain/models/user';
import { OrganizationId } from '../../domain/models/organization';
import { IUserRepository } from '../../domain/repositories/user-repository';
import prisma from './prisma-client';

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: { email },
    });

    if (!record) {
      return null;
    }

    return this.mapToDomainModel(record);
  }

  async findById(id: UserId): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: { user_id: id },
    });

    if (!record) {
      return null;
    }

    return this.mapToDomainModel(record);
  }

  async findAll(): Promise<User[]> {
    const records = await prisma.user.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });

    return records.map((record) => this.mapToDomainModel(record));
  }

  async save(user: User): Promise<void> {
    await prisma.user.upsert({
      where: { user_id: user.id },
      create: {
        user_id: user.id,
        organization_id: user.organizationId,
        name: user.name,
        email: user.email,
        password_hash: '',
        role: user.role,
        is_active: user.isActive,
      },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        organization_id: user.organizationId,
        is_active: user.isActive,
      },
    });
  }

  private mapToDomainModel(record: {
    user_id: string;
    organization_id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }): User {
    return User.reconstruct(
      UserId.create(record.user_id),
      OrganizationId.create(record.organization_id),
      record.name,
      record.email,
      record.role as UserRole,
      record.is_active,
      record.created_at,
      record.updated_at
    );
  }
}
