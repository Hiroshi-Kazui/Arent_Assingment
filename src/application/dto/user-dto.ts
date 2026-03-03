export interface UserDto {
  userId: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'WORKER';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'WORKER';
}

export interface UpdateUserInput {
  userId: string;
  name?: string;
  email?: string;
  role?: 'ADMIN' | 'SUPERVISOR' | 'WORKER';
  organizationId?: string;
  isActive?: boolean;
}
