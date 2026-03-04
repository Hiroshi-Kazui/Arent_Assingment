import { IElementFloorMappingRepository } from '../../domain/repositories/element-floor-mapping-repository';
import { ElementFloorMapping } from '../../domain/models/element-floor-mapping';
import { BuildingId } from '../../domain/models/building';
import { FloorId } from '../../domain/models/floor';
import prisma from './prisma-client';

const CHUNK_SIZE = 500;

/**
 * Prisma を使用した ElementFloorMapping Repository の実装
 */
export class PrismaElementFloorMappingRepository
  implements IElementFloorMappingRepository
{
  async findByBuildingIdAndDbId(
    buildingId: BuildingId,
    dbId: number
  ): Promise<ElementFloorMapping | null> {
    const record = await prisma.elementFloorMapping.findUnique({
      where: {
        building_id_db_id: { building_id: buildingId, db_id: dbId },
      },
    });

    if (!record) return null;
    return this.mapToDomainModel(record);
  }

  async findByBuildingId(
    buildingId: BuildingId
  ): Promise<ElementFloorMapping[]> {
    const records = await prisma.elementFloorMapping.findMany({
      where: { building_id: buildingId },
    });
    return records.map((r) => this.mapToDomainModel(r));
  }

  async countByBuildingId(buildingId: BuildingId): Promise<number> {
    return prisma.elementFloorMapping.count({
      where: { building_id: buildingId },
    });
  }

  async bulkUpsert(mappings: ElementFloorMapping[]): Promise<number> {
    let count = 0;

    for (let i = 0; i < mappings.length; i += CHUNK_SIZE) {
      const chunk = mappings.slice(i, i + CHUNK_SIZE);

      await prisma.$transaction(
        chunk.map((m) =>
          prisma.elementFloorMapping.upsert({
            where: {
              building_id_db_id: {
                building_id: m.buildingId,
                db_id: m.dbId,
              },
            },
            update: {
              floor_id: m.floorId,
              bounding_box_min_z: m.boundingBoxMinZ,
            },
            create: {
              building_id: m.buildingId,
              db_id: m.dbId,
              floor_id: m.floorId,
              bounding_box_min_z: m.boundingBoxMinZ,
            },
          })
        )
      );

      count += chunk.length;
    }

    return count;
  }

  async deleteByBuildingId(buildingId: BuildingId): Promise<void> {
    await prisma.elementFloorMapping.deleteMany({
      where: { building_id: buildingId },
    });
  }

  private mapToDomainModel(record: any): ElementFloorMapping {
    return ElementFloorMapping.reconstruct(
      record.building_id as BuildingId,
      record.db_id,
      record.floor_id as FloorId,
      record.bounding_box_min_z != null
        ? Number(record.bounding_box_min_z)
        : null
    );
  }
}
