import { getElementFloor } from '@/application/queries/get-element-floor';
import { BuildingId } from '@/domain/models/building';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';
import { NextResponse } from 'next/server';

interface Params {
  buildingId: string;
  dbId: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { buildingId: buildingIdParam, dbId: dbIdParam } = await params;
    const buildingId = BuildingId.create(buildingIdParam);
    const dbId = parseInt(dbIdParam, 10);

    if (isNaN(dbId)) {
      return NextResponse.json(
        { error: 'dbId must be a number' },
        { status: 400 }
      );
    }

    const result = await getElementFloor(buildingId, dbId);

    if (!result) {
      return NextResponse.json(
        { error: 'Element floor mapping not found' },
        { status: 404 }
      );
    }

    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
