import prisma from '../../infrastructure/prisma/prisma-client';

export class DeactivateUserHandler {
  async execute(userId: string): Promise<void> {
    await prisma.user.update({
      where: { user_id: userId },
      data: { is_active: false },
    });
  }
}
