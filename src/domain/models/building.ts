import { Coordinate } from './coordinate';

/**
 * Building ID - ブランド型で型安全性を確保
 */
export type BuildingId = string & { readonly __brand: 'BuildingId' };

export const BuildingId = {
  create: (value: string): BuildingId => {
    if (!value || value.trim().length === 0) {
      throw new Error('BuildingId must not be empty');
    }
    return value as BuildingId;
  },
};

/**
 * Building エンティティ
 * 施工現場の建築プロジェクト全体を表現
 */
export class Building {
  private constructor(
    readonly id: BuildingId,
    readonly name: string,
    readonly address: string,
    readonly coordinate: Coordinate,
    readonly modelUrn: string
  ) {}

  /**
   * ファクトリメソッド - 新規作成
   */
  static create(
    id: BuildingId,
    name: string,
    address: string,
    coordinate: Coordinate,
    modelUrn: string
  ): Building {
    if (!name || name.trim().length === 0) {
      throw new Error('Building name must not be empty');
    }

    if (!address || address.trim().length === 0) {
      throw new Error('Building address must not be empty');
    }

    if (!modelUrn || modelUrn.trim().length === 0) {
      throw new Error('Building modelUrn must not be empty');
    }

    return new Building(id, name, address, coordinate, modelUrn);
  }

  /**
   * 永続化層から復元
   */
  static reconstruct(
    id: BuildingId,
    name: string,
    address: string,
    coordinate: Coordinate,
    modelUrn: string
  ): Building {
    return new Building(id, name, address, coordinate, modelUrn);
  }
}
