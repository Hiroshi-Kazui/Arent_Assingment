import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireRole } from '@/api/utils/auth';

interface Params {
  buildingId: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireRole('ADMIN', 'SUPERVISOR');
    if ('error' in auth) return auth.error;

    const { buildingId } = await params;
    const body = await request.json();

    if (!Array.isArray(body.levels) || body.levels.length === 0) {
      return successResponse({ error: 'levels array is required' }, 400);
    }

    if (!Array.isArray(body.elements)) {
      return successResponse({ error: 'elements array is required' }, 400);
    }

    const handlers = getCommandHandlers();
    const result = await handlers.initializeModel.execute({
      buildingId,
      levels: body.levels,
      elements: body.elements,
    });

    return successResponse(result, 201);
  } catch (error) {
    return handleError(error);
  }
}
