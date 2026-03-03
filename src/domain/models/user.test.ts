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
