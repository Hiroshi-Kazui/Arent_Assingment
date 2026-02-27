import { BuildingId } from './building';

/**
 * Floor ID - ブランド型で型安全性を確保
 */
export type FloorId = string & { readonly __brand: 'FloorId' };

export const FloorId = {
  create: (value: string): FloorId => {
    if (!value || value.trim().length === 0) {
      throw new Error('FloorId must not be empty');
    }
    return value as FloorId;
  },
};

/**
 * Floor エンティティ
 * Building に属する階層情報
 */
export class Floor {
  private constructor(
    readonly id: FloorId,
    readonly buildingId: BuildingId,
    readonly name: string,
    readonly floorNumber: number
  ) {}

  /**
   * ファクトリメソッド - 新規作成
   */
  static create(
    id: FloorId,
    buildingId: BuildingId,
    name: string,
    floorNumber: number
  ): Floor {
    if (!name || name.trim().length === 0) {
      throw new Error('Floor name must not be empty');
    }

    if (!Number.isInteger(floorNumber)) {
      throw new Error('Floor number must be an integer');
    }

    return new Floor(id, buildingId, name, floorNumber);
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    id: FloorId,
    buildingId: BuildingId,
    name: string,
    floorNumber: number
  ): Floor {
    return new Floor(id, buildingId, name, floorNumber);
  }
}
