import { BuildingId } from './building';
import { FloorId } from './floor';

/**
 * ElementFloorMapping エンティティ
 * BIM モデルの部材（dbId）とフロアの対応関係を保持
 * 複合キー: buildingId + dbId
 */
export class ElementFloorMapping {
  private constructor(
    readonly buildingId: BuildingId,
    readonly dbId: number,
    readonly floorId: FloorId,
    readonly boundingBoxMinZ: number | null
  ) {}

  /**
   * ファクトリメソッド - 新規作成
   */
  static create(
    buildingId: BuildingId,
    dbId: number,
    floorId: FloorId,
    boundingBoxMinZ: number | null
  ): ElementFloorMapping {
    if (dbId < 0 || !Number.isInteger(dbId)) {
      throw new Error('dbId must be a non-negative integer');
    }
    return new ElementFloorMapping(buildingId, dbId, floorId, boundingBoxMinZ);
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    buildingId: BuildingId,
    dbId: number,
    floorId: FloorId,
    boundingBoxMinZ: number | null
  ): ElementFloorMapping {
    return new ElementFloorMapping(buildingId, dbId, floorId, boundingBoxMinZ);
  }
}
