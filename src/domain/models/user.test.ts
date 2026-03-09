import { describe, it, expect } from 'vitest';
import { User, UserId, UserRole } from './user';
import { OrganizationId } from './organization';

const orgId = OrganizationId.create('org-1');
const userId = UserId.create('user-1');

describe('UserId', () => {
  it('有効な文字列からIDを生成できる', () => {
    expect(UserId.create('abc')).toBe('abc');
  });

  it('空文字列は拒否される', () => {
    expect(() => UserId.create('')).toThrow('UserId must not be empty');
  });

  it('空白のみの文字列は拒否される', () => {
    expect(() => UserId.create('   ')).toThrow('UserId must not be empty');
  });
});

describe('User.create', () => {
  it('有効な値からUserを生成できる', () => {
    const user = User.create(userId, orgId, '田中太郎', 'tanaka@example.com', UserRole.Supervisor);
    expect(user.id).toBe(userId);
    expect(user.name).toBe('田中太郎');
    expect(user.email).toBe('tanaka@example.com');
    expect(user.role).toBe(UserRole.Supervisor);
    expect(user.isActive).toBe(true);
  });

  it('名前が空の場合は拒否される', () => {
    expect(() =>
      User.create(userId, orgId, '', 'a@example.com', UserRole.Worker)
    ).toThrow('User name must not be empty');
  });

  it('名前が空白のみの場合は拒否される', () => {
    expect(() =>
      User.create(userId, orgId, '   ', 'a@example.com', UserRole.Worker)
    ).toThrow('User name must not be empty');
  });

  it('@を含まないメールアドレスは拒否される', () => {
    expect(() =>
      User.create(userId, orgId, '名前', 'invalid-email', UserRole.Worker)
    ).toThrow('User email must be valid');
  });
});

describe('User.reconstruct', () => {
  it('isActive=falseで復元できる', () => {
    const now = new Date();
    const user = User.reconstruct(userId, orgId, '名前', 'a@example.com', UserRole.Worker, false, now, now);
    expect(user.isActive).toBe(false);
  });
});

describe('User - ビジネスルール（phase0 §0.3）', () => {
  it('B4: メールアドレスの形式バリデーション（一意性はDB層で保証）', () => {
    // phase0: 「メールアドレス（ログイン用、一意）」
    // Domain層では形式チェック、DB層(Prisma @unique)で一意性を保証
    expect(() =>
      User.create(userId, orgId, '名前', 'invalid', UserRole.Worker)
    ).toThrow('User email must be valid');

    expect(() =>
      User.create(userId, orgId, '名前', '', UserRole.Worker)
    ).toThrow('User email must be valid');
  });

  it('B5: ユーザー無効化はisActive=falseで表現（論理削除）', () => {
    // api-design: 「物理削除ではなくisActive: falseに更新」
    // DeactivateUserHandlerがprisma.user.updateでis_active: falseを設定
    const now = new Date();
    const activeUser = User.reconstruct(userId, orgId, '名前', 'a@b.com', UserRole.Worker, true, now, now);
    expect(activeUser.isActive).toBe(true);

    const deactivatedUser = User.reconstruct(userId, orgId, '名前', 'a@b.com', UserRole.Worker, false, now, now);
    expect(deactivatedUser.isActive).toBe(false);
  });
});

describe('ロール判定メソッド', () => {
  it('AdminユーザーはisAdmin()がtrue', () => {
    const user = User.create(userId, orgId, '管理者', 'admin@example.com', UserRole.Admin);
    expect(user.isAdmin()).toBe(true);
    expect(user.isSupervisor()).toBe(false);
    expect(user.isWorker()).toBe(false);
  });

  it('SupervisorユーザーはisSupervisor()がtrue', () => {
    const user = User.create(userId, orgId, '監督', 'sup@example.com', UserRole.Supervisor);
    expect(user.isAdmin()).toBe(false);
    expect(user.isSupervisor()).toBe(true);
    expect(user.isWorker()).toBe(false);
  });

  it('WorkerユーザーはisWorker()がtrue', () => {
    const user = User.create(userId, orgId, '作業者', 'worker@example.com', UserRole.Worker);
    expect(user.isAdmin()).toBe(false);
    expect(user.isSupervisor()).toBe(false);
    expect(user.isWorker()).toBe(true);
  });
});
