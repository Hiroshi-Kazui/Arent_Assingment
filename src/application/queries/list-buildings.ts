import { BuildingDto } from '../dto/building-dto';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * すべての Building 一覧を取得
 */
export async function listBuildings(): Promise<BuildingDto[]> {
  const buildings = await prisma.building.findMany({
    orderBy: { created_at: 'desc' },
  });

  return buildings.map((building) => ({
    buildingId: building.building_id,
    name: building.name,
    address: building.address,
    latitude: building.latitude.toString(),
    longitude: building.longitude.toString(),
    modelUrn: building.model_urn,
  }));
}
