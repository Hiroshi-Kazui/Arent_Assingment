import { describe, it, expect } from 'vitest';
import { Organization, OrganizationId, OrganizationType } from './organization';

describe('OrganizationId', () => {
  it('有効な文字列からIDを生成できる', () => {
    expect(OrganizationId.create('org-123')).toBe('org-123');
  });

  it('空文字列は拒否される', () => {
    expect(() => OrganizationId.create('')).toThrow('OrganizationId must not be empty');
  });

  it('空白のみの文字列は拒否される', () => {
    expect(() => OrganizationId.create('   ')).toThrow('OrganizationId must not be empty');
  });
});

describe('Organization.create', () => {
  it('本社（HQ）を親なしで生成できる', () => {
    const id = OrganizationId.create('hq-1');
    const org = Organization.create(id, '本社', OrganizationType.Headquarters);
    expect(org.id).toBe(id);
    expect(org.name).toBe('本社');
    expect(org.type).toBe(OrganizationType.Headquarters);
    expect(org.parentId).toBeUndefined();
  });

  it('支店（Branch）を親IDつきで生成できる', () => {
    const hqId = OrganizationId.create('hq-1');
    const branchId = OrganizationId.create('branch-1');
    const branch = Organization.create(branchId, '東京支店', OrganizationType.Branch, hqId);
    expect(branch.type).toBe(OrganizationType.Branch);
    expect(branch.parentId).toBe(hqId);
  });

  it('名前が空の場合は拒否される', () => {
    const id = OrganizationId.create('org-1');
    expect(() =>
      Organization.create(id, '', OrganizationType.Branch)
    ).toThrow('Organization name must not be empty');
  });

  it('名前が空白のみの場合は拒否される', () => {
    const id = OrganizationId.create('org-1');
    expect(() =>
      Organization.create(id, '   ', OrganizationType.Headquarters)
    ).toThrow('Organization name must not be empty');
  });

  it('生成時刻が設定される', () => {
    const before = new Date();
    const id = OrganizationId.create('org-1');
    const org = Organization.create(id, '本社', OrganizationType.Headquarters);
    const after = new Date();
    expect(org.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(org.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('Organization - ビジネスルール（phase0 §0.3, §0.13）', () => {
  it('B1: Domain層ではHeadquarters作成を許容（制約はApplication層で強制）', () => {
    // phase0: 「アプリから作成できる組織はBranch（支部）のみ。Headquarters typeは作成不可」
    // CreateOrganizationHandlerがOrganizationType.Branchをハードコードして強制
    // Domain層はシーダ用にHeadquarters作成が必要なため許容
    const id = OrganizationId.create('hq-test');
    const org = Organization.create(id, 'テスト本社', OrganizationType.Headquarters);
    expect(org.type).toBe(OrganizationType.Headquarters);
  });

  it('B1: Branch typeの組織は正常に作成できる', () => {
    const id = OrganizationId.create('branch-test');
    const hqId = OrganizationId.create('hq-1');
    const org = Organization.create(id, '大阪支店', OrganizationType.Branch, hqId);
    expect(org.type).toBe(OrganizationType.Branch);
    expect(org.parentId).toBe(hqId);
  });
});

describe('Organization.reconstruct', () => {
  it('全フィールドを指定して復元できる', () => {
    const id = OrganizationId.create('org-1');
    const parentId = OrganizationId.create('parent-1');
    const createdAt = new Date('2024-01-01');
    const updatedAt = new Date('2024-06-01');
    const org = Organization.reconstruct(id, '支店', OrganizationType.Branch, parentId, createdAt, updatedAt);
    expect(org.parentId).toBe(parentId);
    expect(org.createdAt).toBe(createdAt);
    expect(org.updatedAt).toBe(updatedAt);
  });

  it('parentIdなしで復元できる', () => {
    const id = OrganizationId.create('org-1');
    const now = new Date();
    const org = Organization.reconstruct(id, '本社', OrganizationType.Headquarters, undefined, now, now);
    expect(org.parentId).toBeUndefined();
  });
});
