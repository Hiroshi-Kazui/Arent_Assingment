import {
  getElementFloorMappings,
  getElementFloorMappingCount,
} from '@/application/queries/get-element-floor';
import { BuildingId } from '@/domain/models/building';
import { ElementFloorMapping } from '@/domain/models/element-floor-mapping';
import { FloorId } from '@/domain/models/floor';
import { PrismaElementFloorMappingRepository } from '@/infrastructure/prisma/prisma-element-floor-mapping-repository';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';
import { NextResponse } from 'next/server';

interface Params {
  buildingId: string;
}

/**
 * GET /api/buildings/{buildingId}/element-floor-mapping
 * フロア番号 → dbId[] のマッピング全体を返す
 * ?count=true の場合はマッピング件数のみ返す（初期化済み確認用）
 */
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
    const countOnly = url.searchParams.get('count') === 'true';

    if (countOnly) {
      const count = await getElementFloorMappingCount(buildingId);
      return successResponse({ count });
    }

    const mappings = await getElementFloorMappings(buildingId);
    return successResponse({ mappings });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/buildings/{buildingId}/element-floor-mapping
 * フロントエンドで構築済みの dbId→floorId マッピングを一括永続化
 * リクエスト: { mappings: { dbId: number, floorId: string }[] }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { buildingId: buildingIdParam } = await params;
    const buildingId = BuildingId.create(buildingIdParam);

    const body = await request.json();

    if (!Array.isArray(body.mappings) || body.mappings.length === 0) {
      return NextResponse.json(
        { error: 'mappings array is required and must not be empty' },
        { status: 400 }
      );
    }

    const repo = new PrismaElementFloorMappingRepository();

    // 既存マッピングをクリーンアップ
    await repo.deleteByBuildingId(buildingId);

    // ドメインモデルに変換
    const domainMappings: ElementFloorMapping[] = [];
    for (const m of body.mappings) {
      if (typeof m.dbId !== 'number' || !m.floorId) continue;
      domainMappings.push(
        ElementFloorMapping.create(
          buildingId,
          m.dbId,
          FloorId.create(m.floorId),
          typeof m.boundingBoxMinZ === 'number' ? m.boundingBoxMinZ : null
        )
      );
    }

    if (domainMappings.length === 0) {
      return NextResponse.json(
        { error: 'No valid mappings provided' },
        { status: 400 }
      );
    }

    const count = await repo.bulkUpsert(domainMappings);

    return successResponse({ mappingsCreated: count }, 201);
  } catch (error) {
    return handleError(error);
  }
}
