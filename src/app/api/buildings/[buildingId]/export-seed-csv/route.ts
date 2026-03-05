import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { requireSession } from '@/api/utils/auth';
import { handleError, successResponse } from '@/api/utils/error-handler';
import prisma from '@/infrastructure/prisma/prisma-client';

interface Params {
  buildingId: string;
}

/**
 * POST /api/buildings/{buildingId}/export-seed-csv
 * floors と element_floor_mapping を prisma/seeds/ 以下に CSV として書き出す。
 * ローカル開発専用。seed.ts でそのまま import できる形式で出力する。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { buildingId } = await params;

    const floors = await prisma.floor.findMany({
      where: { building_id: buildingId },
      orderBy: { floor_number: 'asc' },
    });

    const mappings = await prisma.elementFloorMapping.findMany({
      where: { building_id: buildingId },
    });

    const floorsCsv = [
      'floor_id,building_id,name,floor_number,elevation',
      ...floors.map(
        (f) =>
          `${f.floor_id},${f.building_id},${f.name},${f.floor_number},${f.elevation ?? ''}`
      ),
    ].join('\n');

    const mappingsCsv = [
      'building_id,db_id,floor_id,bounding_box_min_z',
      ...mappings.map(
        (m) =>
          `${m.building_id},${m.db_id},${m.floor_id},${m.bounding_box_min_z ?? ''}`
      ),
    ].join('\n');

    const seedsDir = path.join(process.cwd(), 'prisma', 'seeds');
    mkdirSync(seedsDir, { recursive: true });
    writeFileSync(path.join(seedsDir, 'floors.csv'), floorsCsv, 'utf-8');
    writeFileSync(
      path.join(seedsDir, 'element_floor_mapping.csv'),
      mappingsCsv,
      'utf-8'
    );

    console.log(
      `[export-seed-csv] Exported ${floors.length} floors and ${mappings.length} mappings for building ${buildingId}`
    );

    return successResponse({
      floorsExported: floors.length,
      mappingsExported: mappings.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
