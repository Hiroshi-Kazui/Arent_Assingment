import { NextResponse } from 'next/server';
import { listBuildings } from '@/application/queries/list-buildings';
import { handleError, successResponse } from '@/api/utils/error-handler';

export async function GET() {
  try {
    const buildings = await listBuildings();
    return successResponse(buildings);
  } catch (error) {
    return handleError(error);
  }
}
