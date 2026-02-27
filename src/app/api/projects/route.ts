import { NextResponse } from 'next/server';
import { listProjects } from '@/application/queries/list-projects';
import { handleError, successResponse } from '@/api/utils/error-handler';

export async function GET() {
  try {
    const projects = await listProjects();
    return successResponse(projects);
  } catch (error) {
    return handleError(error);
  }
}
