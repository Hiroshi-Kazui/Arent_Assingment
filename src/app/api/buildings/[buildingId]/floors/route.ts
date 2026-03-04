import { listFloors } from '@/application/queries/list-floors';
import { BuildingId } from '@/domain/models/building';
import { parsePaginationParams } from '@/application/dto/pagination';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';
import prisma from '@/infrastructure/prisma/prisma-client';

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

/**
 * PATCH /api/buildings/{buildingId}/floors
 * フロアの elevation を一括更新（Viewer BoundingBox から推定した値を反映）
 * Body: { elevations: { floorId: string, elevation: number }[] }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { buildingId: buildingIdParam } = await params;
    const body = await request.json();
    const elevations: { floorId: string; elevation: number }[] = body.elevations ?? [];

    if (elevations.length === 0) {
      return successResponse({ error: 'elevations array is required' }, 400);
    }

    await prisma.$transaction(
      elevations.map((e) =>
        prisma.floor.update({
          where: { floor_id: e.floorId },
          data: { elevation: e.elevation },
        })
      )
    );

    console.log(
      `[floors PATCH] Updated elevations for ${elevations.length} floors in building ${buildingIdParam}`
    );

    return successResponse({ updated: elevations.length });
  } catch (error) {
    return handleError(error);
  }
}
