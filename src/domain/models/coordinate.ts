import { DomainError } from '../errors/domain-error';

/**
 * 緯度・経度を表す Value Object
 * Building の位置を表現する
 */
export class Coordinate {
  private constructor(
    readonly latitude: number,
    readonly longitude: number
  ) {}

  /**
   * ファクトリメソッド - 緯度・経度の範囲バリデーション付き
   * @param latitude - 緯度 (-90 <= latitude <= 90)
   * @param longitude - 経度 (-180 <= longitude <= 180)
   */
  static create(latitude: number, longitude: number): Coordinate {
    if (latitude < -90 || latitude > 90) {
      throw new DomainError(
        `Invalid latitude: ${latitude}. Must be between -90 and 90.`
      );
    }

    if (longitude < -180 || longitude > 180) {
      throw new DomainError(
        `Invalid longitude: ${longitude}. Must be between -180 and 180.`
      );
    }

    return new Coordinate(latitude, longitude);
  }

  /**
   * 値の同値性判定
   */
  equals(other: Coordinate): boolean {
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude
    );
  }
}
