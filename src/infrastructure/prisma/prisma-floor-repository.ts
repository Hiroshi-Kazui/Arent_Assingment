import { IFloorRepository } from '../../domain/repositories/floor-repository';
import { Floor, FloorId } from '../../domain/models/floor';
import { BuildingId } from '../../domain/models/building';
import prisma from './prisma-client';

/**
 * Prisma を使用した Floor Repository の実装
 */
export class PrismaFloorRepository implements IFloorRepository {
  async findByBuildingId(buildingId: BuildingId): Promise<Floor[]> {
    const records = await prisma.floor.findMany({
      where: { building_id: buildingId },
      orderBy: { floor_number: 'asc' },
    });

    return records.map((record) => this.mapToDomainModel(record));
  }

  async bulkUpsert(floors: Floor[]): Promise<Floor[]> {
    const results = await prisma.$transaction(
      floors.map((f) =>
        prisma.floor.upsert({
          where: {
            building_id_floor_number: {
              building_id: f.buildingId,
              floor_number: f.floorNumber,
            },
          },
          update: {
            name: f.name,
            elevation: f.elevation,
          },
          create: {
            floor_id: f.id,
            building_id: f.buildingId,
            name: f.name,
            floor_number: f.floorNumber,
            elevation: f.elevation,
          },
        })
      )
    );
    return results.map((r) => this.mapToDomainModel(r));
  }

  /**
   * Prisma Floor モデルを Domain Floor に変換
   */
  private mapToDomainModel(record: any): Floor {
    return Floor.reconstruct(
      record.floor_id as FloorId,
      record.building_id as BuildingId,
      record.name,
      record.floor_number,
      record.elevation != null ? Number(record.elevation) : null
    );
  }
}
