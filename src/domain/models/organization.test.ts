import { describe, it, expect } from 'vitest';
import { Organization, OrganizationId, OrganizationType } from './organization';

describe('Organization ドメインモデル', () => {
  describe('Organization.create()', () => {
    // DOM-ORG-001: Organization.create() で Branch 組織が生成できる
    it('Branch 型の Organization が正常に生成される', () => {
      // Arrange
      const id = OrganizationId.create('org-001');
      const parentId = OrganizationId.create('hq-001');

      // Act
      const org = Organization.create(id, '東京支部', OrganizationType.Branch, parentId);

      // Assert
      expect(org.type).toBe(OrganizationType.Branch);
      expect(org.name).toBe('東京支部');
    });

    it('Headquarters 型の Organization が正常に生成される', () => {
      // Arrange
      const id = OrganizationId.create('org-002');

      // Act
      const org = Organization.create(id, '本社', OrganizationType.Headquarters);

      // Assert
      expect(org.type).toBe(OrganizationType.Headquarters);
      expect(org.name).toBe('本社');
    });

    // DOM-ORG-002: Organization.create() で name 空文字を渡すと Error がスローされる
    it('name に空文字を渡すと Error がスローされる', () => {
      // Arrange
      const id = OrganizationId.create('org-003');
      const parentId = OrganizationId.create('hq-001');

      // Act & Assert
      expect(() =>
        Organization.create(id, '', OrganizationType.Branch, parentId)
      ).toThrow('Organization name must not be empty');
    });
  });
});
