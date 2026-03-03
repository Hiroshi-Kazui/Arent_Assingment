import { describe, it, expect } from 'vitest';
import { Location } from './location';

describe('Location.createFromDbId', () => {
  it('有効なdbIdからLocationを生成できる', () => {
    const loc = Location.createFromDbId('123');
    expect(loc.isDbId()).toBe(true);
    expect(loc.isWorldPosition()).toBe(false);
    expect(loc.value).toEqual({ type: 'dbId', dbId: '123' });
  });

  it('空文字列のdbIdは拒否される', () => {
    expect(() => Location.createFromDbId('')).toThrow('dbId must not be empty');
  });

  it('空白のみのdbIdは拒否される', () => {
    expect(() => Location.createFromDbId('   ')).toThrow('dbId must not be empty');
  });
});

describe('Location.createFromWorldPosition', () => {
  it('有限座標からLocationを生成できる', () => {
    const loc = Location.createFromWorldPosition(1.0, 2.5, -3.0);
    expect(loc.isDbId()).toBe(false);
    expect(loc.isWorldPosition()).toBe(true);
    expect(loc.value).toEqual({ type: 'worldPosition', x: 1.0, y: 2.5, z: -3.0 });
  });

  it('ゼロ座標を許容する', () => {
    const loc = Location.createFromWorldPosition(0, 0, 0);
    expect(loc.isWorldPosition()).toBe(true);
  });

  it('負の座標を許容する', () => {
    const loc = Location.createFromWorldPosition(-10.5, -20.0, -5.5);
    expect(loc.isWorldPosition()).toBe(true);
  });

  it('Infinityは拒否される', () => {
    expect(() => Location.createFromWorldPosition(Infinity, 0, 0))
      .toThrow('World position coordinates must be finite numbers');
  });

  it('-Infinityは拒否される', () => {
    expect(() => Location.createFromWorldPosition(0, -Infinity, 0))
      .toThrow('World position coordinates must be finite numbers');
  });

  it('NaNは拒否される', () => {
    expect(() => Location.createFromWorldPosition(0, 0, NaN))
      .toThrow('World position coordinates must be finite numbers');
  });
});

describe('Location.reconstruct', () => {
  it('DbIdLocationから復元できる', () => {
    const loc = Location.reconstruct({ type: 'dbId', dbId: 'elem-42' });
    expect(loc.isDbId()).toBe(true);
  });

  it('WorldPositionLocationから復元できる', () => {
    const loc = Location.reconstruct({ type: 'worldPosition', x: 1, y: 2, z: 3 });
    expect(loc.isWorldPosition()).toBe(true);
  });
});

describe('Location.equals', () => {
  it('同じdbIdのLocationは等しい', () => {
    const a = Location.createFromDbId('42');
    const b = Location.createFromDbId('42');
    expect(a.equals(b)).toBe(true);
  });

  it('異なるdbIdのLocationは等しくない', () => {
    const a = Location.createFromDbId('42');
    const b = Location.createFromDbId('99');
    expect(a.equals(b)).toBe(false);
  });

  it('同じWorldPositionのLocationは等しい', () => {
    const a = Location.createFromWorldPosition(1, 2, 3);
    const b = Location.createFromWorldPosition(1, 2, 3);
    expect(a.equals(b)).toBe(true);
  });

  it('異なるWorldPositionのLocationは等しくない', () => {
    const a = Location.createFromWorldPosition(1, 2, 3);
    const b = Location.createFromWorldPosition(1, 2, 4);
    expect(a.equals(b)).toBe(false);
  });

  it('タイプが異なるLocationは等しくない', () => {
    const a = Location.createFromDbId('42');
    const b = Location.createFromWorldPosition(1, 2, 3);
    expect(a.equals(b)).toBe(false);
  });
});
