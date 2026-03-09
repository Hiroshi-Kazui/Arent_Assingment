import { describe, it, expect } from 'vitest';
import { User, UserId, UserRole } from './user';
import { OrganizationId } from './organization';

describe('User ドメインモデル', () => {
  describe('User.create()', () => {
    // DOM-USR-001: User.create() で isActive=true の User が生成される
    it('isActive=true、指定ロールの User が生成される', () => {
      // Arrange
      const id = UserId.create('user-001');
      const orgId = OrganizationId.create('org-001');

      // Act
      const user = User.create(id, orgId, '田中太郎', 'tanaka@example.com', UserRole.Worker);

      // Assert
      expect(user.isActive).toBe(true);
      expect(user.role).toBe(UserRole.Worker);
    });

    // DOM-USR-002: User.create() で無効なメールアドレスを渡すと Error がスローされる
    it('@ を含まないメールアドレスを渡すと Error がスローされる', () => {
      // Arrange
      const id = UserId.create('user-002');
      const orgId = OrganizationId.create('org-001');

      // Act & Assert
      expect(() =>
        User.create(id, orgId, '田中太郎', 'invalid-email', UserRole.Worker)
      ).toThrow('User email must be valid');
    });
  });
});
