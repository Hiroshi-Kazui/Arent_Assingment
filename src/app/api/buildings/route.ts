import { NextResponse } from 'next/server';
import { listBuildings } from '@/application/queries/list-buildings';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

export async function GET() {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const buildings = await listBuildings();
    return successResponse(buildings);
  } catch (error) {
    return handleError(error);
  }
}
