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

  /**
   * Floor を一括 upsert（initialize-model 用）
   * @returns upsert された Floor の配列
   */
  bulkUpsert(floors: Floor[]): Promise<Floor[]>;
}
