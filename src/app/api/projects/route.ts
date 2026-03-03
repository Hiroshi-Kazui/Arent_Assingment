import { NextResponse } from 'next/server';
import { listProjects } from '@/application/queries/list-projects';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

export async function GET() {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const projects = await listProjects();
    return successResponse(projects);
  } catch (error) {
    return handleError(error);
  }
}
