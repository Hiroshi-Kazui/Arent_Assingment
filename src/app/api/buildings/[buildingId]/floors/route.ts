import { NextResponse } from 'next/server';
import { listFloors } from '@/application/queries/list-floors';
import { BuildingId } from '@/domain/models/building';
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
    const floors = await listFloors(buildingId);
    return successResponse(floors);
  } catch (error) {
    return handleError(error);
  }
}
