import { NextResponse } from 'next/server';
import { getProjectDetail } from '@/application/queries/get-project-detail';
import { ProjectId } from '@/domain/models/project';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession, requireRole } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';

interface Params {
  id: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const projectId = ProjectId.create(id);
    const project = await getProjectDetail(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return successResponse(project);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireRole('ADMIN');
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();

    const handlers = getCommandHandlers();
    await handlers.updateProject.execute({
      projectId: id,
      name: body.name,
      startDate: body.startDate,
      dueDate: body.dueDate,
      plan: body.plan,
      status: body.status,
    });

    return successResponse({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
