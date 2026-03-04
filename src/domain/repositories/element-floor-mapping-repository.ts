import { BuildingId } from '../models/building';
import { ElementFloorMapping } from '../models/element-floor-mapping';

/**
 * ElementFloorMapping リポジトリインターフェース
 * BIM 部材とフロアの対応関係の永続化を担当
 */
export interface IElementFloorMappingRepository {
  /**
   * buildingId + dbId で単一マッピングを取得
   */
  findByBuildingIdAndDbId(
    buildingId: BuildingId,
    dbId: number
  ): Promise<ElementFloorMapping | null>;

  /**
   * buildingId に属する全マッピングを取得
   */
  findByBuildingId(buildingId: BuildingId): Promise<ElementFloorMapping[]>;

  /**
   * 指定 building のマッピング件数を取得（初期化済み確認用）
   */
  countByBuildingId(buildingId: BuildingId): Promise<number>;

  /**
   * マッピングを一括 upsert
   * @returns upsert された件数
   */
  bulkUpsert(mappings: ElementFloorMapping[]): Promise<number>;

  /**
   * buildingId に属する全マッピングを削除（再初期化用）
   */
  deleteByBuildingId(buildingId: BuildingId): Promise<void>;
}
