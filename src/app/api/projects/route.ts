import { NextResponse } from 'next/server';
import { listProjects } from '@/application/queries/list-projects';
import { parsePaginationParams } from '@/application/dto/pagination';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession, requireRole } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const url = new URL(request.url);
    const pagination = parsePaginationParams(url.searchParams);
    const result = await listProjects(
      pagination,
      auth.user.role,
      auth.user.organizationId,
      auth.user.id
    );
    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    const body = await request.json();

    if (!body.buildingId || !body.name || !body.startDate || !body.dueDate || !body.branchId) {
      return NextResponse.json(
        { error: 'Missing required fields: buildingId, name, startDate, dueDate, branchId' },
        { status: 400 }
      );
    }

    const handlers = getCommandHandlers();
    const projectId = await handlers.createProject.execute({
      buildingId: body.buildingId,
      name: body.name,
      startDate: body.startDate,
      dueDate: body.dueDate,
      branchId: body.branchId,
      plan: body.plan,
    });

    return successResponse({ projectId }, 201);
  } catch (error) {
    return handleError(error);
  }
}
