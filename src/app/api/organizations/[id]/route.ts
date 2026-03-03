import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/infrastructure/auth/nextauth-options';
import { getCommandHandlers } from '@/application/di';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const handlers = getCommandHandlers();
    await handlers.updateOrganization.execute({ organizationId: id, name: body.name });
    return NextResponse.json({ message: 'Organization updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const handlers = getCommandHandlers();
    await handlers.deleteOrganization.execute(id);
    return NextResponse.json({ message: 'Organization deleted' });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('users') || error.message.includes('HasUsers')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message.includes('headquarters') || error.message.includes('HEADQUARTERS') || error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
