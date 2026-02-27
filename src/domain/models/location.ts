import { DomainError } from '../errors/domain-error';

/**
 * 指摘対象の位置情報を表す Value Object
 * 部材指摘（DbId）と空間指摘（WorldPosition）の2つのパターンに対応
 */
export type LocationType = DbIdLocation | WorldPositionLocation;

/**
 * 部材指摘の位置情報 - BIM要素を特定
 */
export interface DbIdLocation {
  readonly type: 'dbId';
  readonly dbId: string;
}

/**
 * 空間指摘の位置情報 - 3D座標で特定
 */
export interface WorldPositionLocation {
  readonly type: 'worldPosition';
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Location ファクトリクラス
 * バリデーション付きで Location を生成
 */
export class Location {
  private constructor(readonly value: LocationType) {}

  /**
   * DbId ベースの Location を生成
   */
  static createFromDbId(dbId: string): Location {
    if (!dbId || dbId.trim().length === 0) {
      throw new DomainError('dbId must not be empty');
    }

    return new Location({
      type: 'dbId',
      dbId,
    });
  }

  /**
   * WorldPosition ベースの Location を生成
   */
  static createFromWorldPosition(
    x: number,
    y: number,
    z: number
  ): Location {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new DomainError(
        'World position coordinates must be finite numbers'
      );
    }

    return new Location({
      type: 'worldPosition',
      x,
      y,
      z,
    });
  }

  /**
   * LocationType から Location を再構築（永続化層から復元）
   */
  static reconstruct(value: LocationType): Location {
    return new Location(value);
  }

  /**
   * DbId 位置か判定
   */
  isDbId(): boolean {
    return this.value.type === 'dbId';
  }

  /**
   * WorldPosition 位置か判定
   */
  isWorldPosition(): boolean {
    return this.value.type === 'worldPosition';
  }

  /**
   * 値の同値性判定
   */
  equals(other: Location): boolean {
    if (this.value.type !== other.value.type) {
      return false;
    }

    if (this.value.type === 'dbId') {
      return (this.value as DbIdLocation).dbId ===
        (other.value as DbIdLocation).dbId;
    }

    const thisPos = this.value as WorldPositionLocation;
    const otherPos = other.value as WorldPositionLocation;
    return (
      thisPos.x === otherPos.x &&
      thisPos.y === otherPos.y &&
      thisPos.z === otherPos.z
    );
  }
}
