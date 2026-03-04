import { BuildingDto } from '../dto/building-dto';
import { PaginationParams, PaginatedResult, buildPaginatedResult } from '../dto/pagination';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * Building 一覧を取得（ページネーション対応）
 */
export async function listBuildings(
  pagination: PaginationParams
): Promise<PaginatedResult<BuildingDto>> {
  const [buildings, totalCount] = await Promise.all([
    prisma.building.findMany({
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.building.count(),
  ]);

  const items = buildings.map((building) => ({
    buildingId: building.building_id,
    name: building.name,
    address: building.address,
    latitude: building.latitude.toString(),
    longitude: building.longitude.toString(),
    modelUrn: building.model_urn,
  }));

  return buildPaginatedResult(items, totalCount, pagination);
}
