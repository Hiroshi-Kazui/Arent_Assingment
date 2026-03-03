import bcrypt from 'bcryptjs';
import { CreateUserInput } from '../dto/user-dto';
import prisma from '../../infrastructure/prisma/prisma-client';

export class CreateUserHandler {
  async execute(input: CreateUserInput): Promise<{ userId: string }> {
    const userId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync(input.password, 10);

    await prisma.user.create({
      data: {
        user_id: userId,
        organization_id: input.organizationId,
        name: input.name,
        email: input.email,
        password_hash: passwordHash,
        role: input.role,
        is_active: true,
      },
    });

    return { userId };
  }
}
