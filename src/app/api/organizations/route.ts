import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/infrastructure/auth/nextauth-options';
import { listOrganizations } from '@/application/queries/list-organizations';
import { getCommandHandlers } from '@/application/di';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orgs = await listOrganizations();
  return NextResponse.json(orgs);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, parentId } = body;

  if (!name || !parentId) {
    return NextResponse.json({ error: 'name and parentId are required' }, { status: 400 });
  }

  const handlers = getCommandHandlers();
  const org = await handlers.createOrganization.execute({ name, parentId });

  return NextResponse.json({
    organizationId: org.id,
    name: org.name,
    type: org.type,
    parentId: org.parentId,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  }, { status: 201 });
}
