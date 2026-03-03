import { OrganizationId } from './organization';

/**
 * User ID - ブランド型で型安全性を確保
 */
export type UserId = string & { readonly __brand: 'UserId' };

export const UserId = {
  create: (value: string): UserId => {
    if (!value || value.trim().length === 0) {
      throw new Error('UserId must not be empty');
    }
    return value as UserId;
  },
};

/**
 * User Role 列挙型
 */
export enum UserRole {
  Admin = 'ADMIN',
  Supervisor = 'SUPERVISOR',
  Worker = 'WORKER',
}

/**
 * User エンティティ
 * パスワードハッシュはDomainモデルに含めない（Infrastructure層の関心事）
 */
export class User {
  private constructor(
    readonly id: UserId,
    readonly organizationId: OrganizationId,
    readonly name: string,
    readonly email: string,
    readonly role: UserRole,
    readonly isActive: boolean,
    readonly createdAt: Date,
    readonly updatedAt: Date
  ) {}

  static create(
    id: UserId,
    organizationId: OrganizationId,
    name: string,
    email: string,
    role: UserRole
  ): User {
    if (!name || name.trim().length === 0) {
      throw new Error('User name must not be empty');
    }
    if (!email || !email.includes('@')) {
      throw new Error('User email must be valid');
    }
    const now = new Date();
    return new User(id, organizationId, name, email, role, true, now, now);
  }

  static reconstruct(
    id: UserId,
    organizationId: OrganizationId,
    name: string,
    email: string,
    role: UserRole,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  ): User {
    return new User(id, organizationId, name, email, role, isActive, createdAt, updatedAt);
  }

  isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }

  isSupervisor(): boolean {
    return this.role === UserRole.Supervisor;
  }

  isWorker(): boolean {
    return this.role === UserRole.Worker;
  }
}
