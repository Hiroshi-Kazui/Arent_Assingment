import { getProviders, getRepositories } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';
import { BuildingId } from '@/domain/models/building';
import { Floor, FloorId } from '@/domain/models/floor';
import { ApsModelMetadataService } from '@/infrastructure/aps/aps-model-metadata';
import { randomUUID } from 'crypto';

interface Params {
  buildingId: string;
}

/**
 * POST/GET /api/buildings/{buildingId}/sync-levels
 * APS Model Derivative API からレベル名を取得し、Floor テーブルを同期する
 * elevation は null（Viewer 起動時に BoundingBox から補完される）
 */
export async function GET(
  _request: Request,
  context: { params: Promise<Params> }
) {
  return syncLevels(context);
}

export async function POST(
  _request: Request,
  context: { params: Promise<Params> }
) {
  return syncLevels(context);
}

async function syncLevels({ params }: { params: Promise<Params> }) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { buildingId: buildingIdParam } = await params;
    const buildingId = BuildingId.create(buildingIdParam);

    const repos = getRepositories();
    const providers = getProviders();

    const building = await repos.building.findById(buildingId);
    if (!building) {
      return successResponse({ error: 'Building not found' }, 404);
    }

    if (!building.modelUrn || building.modelUrn === 'default-model-urn') {
      return successResponse({ error: 'Building has no valid model URN' }, 400);
    }

    // APS Model Derivative API からレベル名一覧を取得
    const metadataService = new ApsModelMetadataService(providers.viewerTokenProvider);
    const levelNames = await metadataService.getLevelNames(building.modelUrn);

    if (levelNames.length === 0) {
      return successResponse({ error: 'No levels found in model metadata' }, 404);
    }

    // 基準レベル（設計GL等）はフロアではないので除外
    const REFERENCE_LEVELS = new Set(['設計gl', 'gl', 'design gl']);
    const filteredNames = levelNames.filter(
      (name) => !REFERENCE_LEVELS.has(name.toLowerCase().trim())
    );

    // レベル名から floorNumber を決定
    const floors = filteredNames.map((name) => {
      const floorNumber = floorNumberFromName(name);
      return Floor.create(
        FloorId.create(randomUUID()),
        buildingId,
        name,
        floorNumber,
        null // elevation は Viewer 起動時に BoundingBox から補完
      );
    });

    // floorNumber 順にソートして upsert
    floors.sort((a, b) => a.floorNumber - b.floorNumber);

    const upsertedFloors = await repos.floor.bulkUpsert(floors);

    console.log(
      `[sync-levels] Synced ${upsertedFloors.length} floors for building ${buildingIdParam}:`,
      upsertedFloors.map((f) => `${f.name} (floorNumber=${f.floorNumber})`).join(', ')
    );

    return successResponse({
      floorsCreated: upsertedFloors.length,
      floors: upsertedFloors.map((f) => ({
        floorId: f.id,
        name: f.name,
        floorNumber: f.floorNumber,
        elevation: f.elevation,
      })),
    }, 200);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * フロア名から floorNumber を決定
 *
 * PIT → -1, 設計GL → 0, 1F → 1, 2F → 2, ..., 7F → 7, RFL → 最上階+1
 */
function floorNumberFromName(name: string): number {
  const lower = name.toLowerCase().trim();

  if (lower === 'pit') return -1;
  if (lower === '設計gl' || lower === 'gl') return 0;
  if (lower === 'rfl' || lower === 'rf' || lower === 'roof') return 8;

  // B1F, B2F → 地下
  const basement = lower.match(/^b(\d+)f?$/);
  if (basement) return -parseInt(basement[1]);

  // 1F, 2F, ..., 12F
  const above = lower.match(/^(\d+)f?$/);
  if (above) return parseInt(above[1]);

  // フォールバック
  return 99;
}
