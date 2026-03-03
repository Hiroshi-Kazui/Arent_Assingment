import { UpdateUserInput } from '../dto/user-dto';
import prisma from '../../infrastructure/prisma/prisma-client';

export class UpdateUserHandler {
  async execute(input: UpdateUserInput): Promise<void> {
    await prisma.user.update({
      where: { user_id: input.userId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.organizationId !== undefined && { organization_id: input.organizationId }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
        updated_at: new Date(),
      },
    });
  }
}
