import { describe, it, expect } from 'vitest';
import { Location, DbIdLocation, WorldPositionLocation } from './location';
import { DomainError } from '../errors/domain-error';

describe('Location Value Object', () => {
  describe('Location.createFromDbId()', () => {
    // DOM-DOM-001: Location.createFromDbId() で DbId ベースの Location が生成される
    it('DbId ベースの Location が生成され type と dbId が正しい', () => {
      // Arrange
      const dbId = 'element-123';

      // Act
      const location = Location.createFromDbId(dbId);

      // Assert
      expect(location.value.type).toBe('dbId');
      expect((location.value as DbIdLocation).dbId).toBe('element-123');
    });

    // DOM-DOM-003: Location.createFromDbId() で空文字を渡すと DomainError がスローされる
    it('空文字を渡すと DomainError がスローされる', () => {
      // Act & Assert
      expect(() => Location.createFromDbId('')).toThrow(DomainError);
      expect(() => Location.createFromDbId('')).toThrow('dbId must not be empty');
    });
  });

  describe('Location.createFromWorldPosition()', () => {
    // DOM-DOM-002: Location.createFromWorldPosition() で WorldPosition ベースの Location が生成される
    it('WorldPosition ベースの Location が生成され type と座標値が正しい', () => {
      // Arrange
      const x = 1.0;
      const y = 2.0;
      const z = 3.0;

      // Act
      const location = Location.createFromWorldPosition(x, y, z);

      // Assert
      expect(location.value.type).toBe('worldPosition');
      const pos = location.value as WorldPositionLocation;
      expect(pos.x).toBe(1.0);
      expect(pos.y).toBe(2.0);
      expect(pos.z).toBe(3.0);
    });

    // DOM-DOM-004: Location.createFromWorldPosition() で非有限値を渡すと DomainError がスローされる
    it('z 座標に Infinity を渡すと DomainError がスローされる', () => {
      // Act & Assert
      expect(() => Location.createFromWorldPosition(1.0, 2.0, Infinity)).toThrow(DomainError);
      expect(() => Location.createFromWorldPosition(1.0, 2.0, Infinity)).toThrow(
        'World position coordinates must be finite numbers'
      );
    });
  });

  describe('Location.equals()', () => {
    // DOM-DOM-005: Location.equals() が同値の DbId Location で true を返す
    it('同じ dbId を持つ DbId Location 同士で equals() が true を返す', () => {
      // Arrange
      const loc1 = Location.createFromDbId('elem-1');
      const loc2 = Location.createFromDbId('elem-1');

      // Act
      const result = loc1.equals(loc2);

      // Assert
      expect(result).toBe(true);
    });

    it('異なる dbId を持つ DbId Location 同士で equals() が false を返す', () => {
      // Arrange
      const loc1 = Location.createFromDbId('elem-1');
      const loc2 = Location.createFromDbId('elem-2');

      // Act
      const result = loc1.equals(loc2);

      // Assert
      expect(result).toBe(false);
    });

    it('同じ座標の WorldPosition Location 同士で equals() が true を返す', () => {
      // Arrange
      const loc1 = Location.createFromWorldPosition(1.0, 2.0, 3.0);
      const loc2 = Location.createFromWorldPosition(1.0, 2.0, 3.0);

      // Act
      const result = loc1.equals(loc2);

      // Assert
      expect(result).toBe(true);
    });

    it('DbId と WorldPosition 型の Location では equals() が false を返す', () => {
      // Arrange
      const loc1 = Location.createFromDbId('elem-1');
      const loc2 = Location.createFromWorldPosition(1.0, 2.0, 3.0);

      // Act
      const result = loc1.equals(loc2);

      // Assert
      expect(result).toBe(false);
    });
  });
});
