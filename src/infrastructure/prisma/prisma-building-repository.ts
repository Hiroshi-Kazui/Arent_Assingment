import { IBuildingRepository } from '../../domain/repositories/building-repository';
import {
  Building,
  BuildingId,
} from '../../domain/models/building';
import { Coordinate } from '../../domain/models/coordinate';
import prisma from './prisma-client';

/**
 * Prisma を使用した Building Repository の実装
 */
export class PrismaBuildingRepository implements IBuildingRepository {
  async findById(id: BuildingId): Promise<Building | null> {
    const record = await prisma.building.findUnique({
      where: { building_id: id },
    });

    if (!record) {
      return null;
    }

    return this.mapToDomainModel(record);
  }

  async findAll(): Promise<Building[]> {
    const records = await prisma.building.findMany();
    return records.map((record) => this.mapToDomainModel(record));
  }

  /**
   * Prisma Building モデルを Domain Building に変換
   */
  private mapToDomainModel(record: any): Building {
    const coordinate = Coordinate.create(
      Number(record.latitude),
      Number(record.longitude)
    );

    return Building.reconstruct(
      record.building_id as BuildingId,
      record.name,
      record.address,
      coordinate,
      record.model_urn
    );
  }
}
