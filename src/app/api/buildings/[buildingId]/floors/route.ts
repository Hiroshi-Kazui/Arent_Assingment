import { listFloors } from '@/application/queries/list-floors';
import { BuildingId } from '@/domain/models/building';
import { parsePaginationParams } from '@/application/dto/pagination';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

interface Params {
  buildingId: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { buildingId: buildingIdParam } = await params;
    const buildingId = BuildingId.create(buildingIdParam);
    const url = new URL(request.url);
    const pagination = parsePaginationParams(url.searchParams);
    const result = await listFloors(buildingId, pagination);
    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
