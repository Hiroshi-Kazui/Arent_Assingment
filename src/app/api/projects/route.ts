import { listProjects } from '@/application/queries/list-projects';
import { parsePaginationParams } from '@/application/dto/pagination';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const url = new URL(request.url);
    const pagination = parsePaginationParams(url.searchParams);
    const result = await listProjects(pagination);
    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
