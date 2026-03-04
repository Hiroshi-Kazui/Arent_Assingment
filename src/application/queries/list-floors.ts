import { FloorListItemDto } from '../dto/floor-dto';
import { BuildingId } from '../../domain/models/building';
import { PaginationParams, PaginatedResult, buildPaginatedResult } from '../dto/pagination';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Building に属する Floor 一覧を取得（ページネーション対応）
 * 各フロアの指摘件数を含む
 */
export async function listFloors(
  buildingId: BuildingId,
  pagination: PaginationParams
): Promise<PaginatedResult<FloorListItemDto>> {
  const where = { building_id: buildingId as string };

  const [floors, totalCount] = await Promise.all([
    prisma.floor.findMany({
      where,
      include: {
        _count: {
          select: { issues: true },
        },
      },
      orderBy: { floor_number: 'asc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.floor.count({ where }),
  ]);

  const items = floors.map((floor) => ({
    floorId: floor.floor_id,
    name: floor.name,
    floorNumber: floor.floor_number,
    elevation: floor.elevation !== null && floor.elevation !== undefined
      ? Number(floor.elevation)
      : null,
    issueCount: floor._count.issues,
  }));

  return buildPaginatedResult(items, totalCount, pagination);
}
