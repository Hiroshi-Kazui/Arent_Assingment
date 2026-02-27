import { FloorListItemDto } from '../dto/floor-dto';
import { BuildingId } from '../../domain/models/building';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Building に属するすべての Floor 一覧を取得
 * 各フロアの指摘件数を含む
 */
export async function listFloors(
  buildingId: BuildingId
): Promise<FloorListItemDto[]> {
  const floors = await prisma.floor.findMany({
    where: { building_id: buildingId },
    include: {
      _count: {
        select: { issues: true },
      },
    },
    orderBy: { floor_number: 'asc' },
  });

  return floors.map((floor) => ({
    floorId: floor.floor_id,
    name: floor.name,
    floorNumber: floor.floor_number,
    issueCount: floor._count.issues,
  }));
}
