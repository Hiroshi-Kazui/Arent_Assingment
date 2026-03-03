/**
 * Organization ID - ブランド型で型安全性を確保
 */
export type OrganizationId = string & { readonly __brand: 'OrganizationId' };

export const OrganizationId = {
  create: (value: string): OrganizationId => {
    if (!value || value.trim().length === 0) {
      throw new Error('OrganizationId must not be empty');
    }
    return value as OrganizationId;
  },
};

/**
 * Organization Type 列挙型
 */
export enum OrganizationType {
  Headquarters = 'HEADQUARTERS',
  Branch = 'BRANCH',
}

/**
 * Organization エンティティ
 */
export class Organization {
  private constructor(
    readonly id: OrganizationId,
    readonly name: string,
    readonly type: OrganizationType,
    readonly parentId: OrganizationId | undefined,
    readonly createdAt: Date,
    readonly updatedAt: Date
  ) {}

  static create(
    id: OrganizationId,
    name: string,
    type: OrganizationType,
    parentId?: OrganizationId
  ): Organization {
    if (!name || name.trim().length === 0) {
      throw new Error('Organization name must not be empty');
    }
    const now = new Date();
    return new Organization(id, name, type, parentId, now, now);
  }

  static reconstruct(
    id: OrganizationId,
    name: string,
    type: OrganizationType,
    parentId: OrganizationId | undefined,
    createdAt: Date,
    updatedAt: Date
  ): Organization {
    return new Organization(id, name, type, parentId, createdAt, updatedAt);
  }
}
