import { Building, BuildingId } from '../models/building';

/**
 * Building リポジトリインターフェース
 * Building エンティティの取得を担当
 */
export interface IBuildingRepository {
  /**
   * Building ID から Building を取得
   */
  findById(id: BuildingId): Promise<Building | null>;

  /**
   * すべての Building を取得
   */
  findAll(): Promise<Building[]>;
}
