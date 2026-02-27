import { Floor, FloorId } from '../models/floor';
import { BuildingId } from '../models/building';

/**
 * Floor リポジトリインターフェース
 * Floor エンティティの取得を担当
 */
export interface IFloorRepository {
  /**
   * Building に属するすべての Floor を取得
   */
  findByBuildingId(buildingId: BuildingId): Promise<Floor[]>;
}
