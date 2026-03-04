import prisma from '../../infrastructure/prisma/prisma-client';
import { BuildingId } from '../../domain/models/building';

export interface ElementFloorDto {
  floorId: string;
  floorName: string;
  floorNumber: number;
}

/**
 * 部材 dbId からフロア情報を取得する Query
 */
export async function getElementFloor(
  buildingId: BuildingId,
  dbId: number
): Promise<ElementFloorDto | null> {
  const record = await prisma.elementFloorMapping.findUnique({
    where: {
      building_id_db_id: {
        building_id: buildingId,
        db_id: dbId,
      },
    },
    include: {
      floor: true,
    },
  });

  if (!record) return null;

  return {
    floorId: record.floor.floor_id,
    floorName: record.floor.name,
    floorNumber: record.floor.floor_number,
  };
}

/**
 * 建物の全マッピングをフロア番号→dbId配列の形で取得する Query
 * フロントエンドでのフロアフィルタに使用
 */
export async function getElementFloorMappings(
  buildingId: BuildingId
): Promise<Record<number, number[]>> {
  const records = await prisma.elementFloorMapping.findMany({
    where: { building_id: buildingId },
    include: { floor: true },
  });

  const result: Record<number, number[]> = {};
  for (const record of records) {
    const floorNumber = record.floor.floor_number;
    if (!result[floorNumber]) {
      result[floorNumber] = [];
    }
    result[floorNumber].push(record.db_id);
  }

  return result;
}

/**
 * 建物のマッピング件数を取得（初期化済み確認用）
 */
export async function getElementFloorMappingCount(
  buildingId: BuildingId
): Promise<number> {
  return prisma.elementFloorMapping.count({
    where: { building_id: buildingId },
  });
}
