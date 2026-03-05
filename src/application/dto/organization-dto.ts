export interface OrganizationDto {
  organizationId: string;
  name: string;
  type: 'HEADQUARTERS' | 'BRANCH';
  parentId?: string;
  userCount: number;
  projectCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationInput {
  name: string;
  parentId: string;
}

export interface UpdateOrganizationInput {
  organizationId: string;
  name: string;
}
