import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/infrastructure/auth/nextauth-options';
import prisma from '@/infrastructure/prisma/prisma-client';
import { getCommandHandlers } from '@/application/di';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      organization_id: true,
      is_active: true,
      created_at: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    users.map((u) => ({
      userId: u.user_id,
      name: u.name,
      email: u.email,
      role: u.role,
      organizationId: u.organization_id,
      isActive: u.is_active,
      createdAt: u.created_at,
    }))
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password, role, organizationId } = body;

  if (!name || !email || !password || !role || !organizationId) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  try {
    const handlers = getCommandHandlers();
    const result = await handlers.createUser.execute({ name, email, password, role, organizationId });
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
