import { IBuildingRepository } from '../../domain/repositories/building-repository';
import { IFloorRepository } from '../../domain/repositories/floor-repository';
import { IElementFloorMappingRepository } from '../../domain/repositories/element-floor-mapping-repository';
import { BuildingId } from '../../domain/models/building';
import { Floor, FloorId } from '../../domain/models/floor';
import { ElementFloorMapping } from '../../domain/models/element-floor-mapping';
import { randomUUID } from 'crypto';

export interface LevelInput {
  name: string;
  elevation: number;
}

export interface ElementInput {
  dbId: number;
  boundingBoxMinZ: number;
}

export interface InitializeModelInput {
  buildingId: string;
  levels: LevelInput[];
  elements: ElementInput[];
}

export interface InitializeModelOutput {
  floorsCreated: number;
  mappingsCreated: number;
}

/**
 * モデル初期化コマンド
 * APS Viewer から取得した Level 情報と部材 BoundingBox を受け取り、
 * Floor テーブルと ElementFloorMapping テーブルを永続化する
 */
export class InitializeModelHandler {
  constructor(
    private buildingRepository: IBuildingRepository,
    private floorRepository: IFloorRepository,
    private elementFloorMappingRepository: IElementFloorMappingRepository
  ) {}

  async execute(input: InitializeModelInput): Promise<InitializeModelOutput> {
    const buildingId = BuildingId.create(input.buildingId);

    // 1. Building の存在検証
    const building = await this.buildingRepository.findById(buildingId);
    if (!building) {
      throw new Error(`Building not found: ${input.buildingId}`);
    }

    if (input.levels.length === 0) {
      throw new Error('At least one level is required');
    }

    // 2. levels → Floor に upsert（elevation 順にソートして floor_number 自動採番）
    const sortedLevels = [...input.levels].sort(
      (a, b) => a.elevation - b.elevation
    );

    const floors = sortedLevels.map((level, index) =>
      Floor.create(
        FloorId.create(randomUUID()),
        buildingId,
        level.name,
        index + 1,
        level.elevation
      )
    );

    const upsertedFloors = await this.floorRepository.bulkUpsert(floors);

    // 3. 既存マッピングをクリーンアップ
    await this.elementFloorMappingRepository.deleteByBuildingId(buildingId);

    // 4. 各 element の boundingBoxMinZ を levels の elevation と比較してフロア判定
    //    判定ロジック: Floor = { f | Elevation_f <= boundingBoxMinZ < Elevation_{f+1} }
    const elevations = sortedLevels.map((l) => l.elevation);
    const mappings: ElementFloorMapping[] = [];

    for (const element of input.elements) {
      const floorIndex = findFloorIndex(element.boundingBoxMinZ, elevations);
      if (floorIndex === -1) continue;

      const floor = upsertedFloors[floorIndex];
      mappings.push(
        ElementFloorMapping.create(
          buildingId,
          element.dbId,
          floor.id,
          element.boundingBoxMinZ
        )
      );
    }

    // 5. ElementFloorMapping に一括 upsert
    const mappingsCreated =
      mappings.length > 0
        ? await this.elementFloorMappingRepository.bulkUpsert(mappings)
        : 0;

    return {
      floorsCreated: upsertedFloors.length,
      mappingsCreated,
    };
  }
}

/**
 * boundingBoxMinZ がどのフロアに属するか判定
 * Elevation_f <= boundingBoxMinZ < Elevation_{f+1} を満たす f のインデックスを返す
 * 最上階以上の場合は最上階に割り当てる
 * どの階にも属さない場合は -1
 */
function findFloorIndex(
  boundingBoxMinZ: number,
  elevations: number[]
): number {
  if (elevations.length === 0) return -1;

  // 最低 elevation 未満の場合は最低階に割り当て
  if (boundingBoxMinZ < elevations[0]) {
    return 0;
  }

  // 最上階 elevation 以上の場合は最上階に割り当て
  if (boundingBoxMinZ >= elevations[elevations.length - 1]) {
    return elevations.length - 1;
  }

  // 中間の場合: Elevation_f <= z < Elevation_{f+1}
  for (let i = 0; i < elevations.length - 1; i++) {
    if (boundingBoxMinZ >= elevations[i] && boundingBoxMinZ < elevations[i + 1]) {
      return i;
    }
  }

  return -1;
}
