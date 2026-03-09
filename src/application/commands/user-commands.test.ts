import { describe, it, expect, vi } from 'vitest';

// NOTE: APP-USR-001 / APP-ARC-003:
// CreateUserHandler は prisma を直接参照するため、vi.mock でモジュールをモックする。
// APP-ARC-003 は「レイヤー違反の検知」テストであり、
// CreateUserHandler が prisma を直接インポートしていることを静的確認する。

vi.mock('../../infrastructure/prisma/prisma-client', () => {
  const createMock = vi.fn();
  return {
    default: {
      user: {
        create: createMock,
      },
    },
  };
});

import prisma from '../../infrastructure/prisma/prisma-client';
import { CreateUserHandler } from './create-user';
import bcrypt from 'bcryptjs';

describe('CreateUserHandler - 統合テスト', () => {
  // APP-USR-001: CreateUserHandler が bcrypt でパスワードハッシュ化して保存する
  it('prisma.user.create() に渡された password_hash が平文と異なり bcrypt で検証できる', async () => {
    // Arrange
    const capturedData: Record<string, unknown>[] = [];
    (prisma.user.create as ReturnType<typeof vi.fn>).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        capturedData.push(data);
        return Promise.resolve({ user_id: 'new-user-id' });
      }
    );

    const handler = new CreateUserHandler();

    // Act
    await handler.execute({
      name: '田中太郎',
      email: 'tanaka@example.com',
      password: 'plain-text-pw',
      role: 'WORKER',
      organizationId: 'org-001',
    });

    // Assert
    expect(capturedData).toHaveLength(1);
    const savedData = capturedData[0];
    expect(savedData.password_hash).not.toBe('plain-text-pw');
    expect(bcrypt.compareSync('plain-text-pw', savedData.password_hash as string)).toBe(true);
  });
});

describe('アーキテクチャ原則 - レイヤー違反の検知 (APP-ARC-003)', () => {
  // APP-ARC-003: CreateUserHandler が Domain 集約を経由せず prisma を直接参照している (レイヤー違反の検知)
  it('CreateUserHandler のソースコードが prisma を直接インポートしていることが確認できる', async () => {
    // Arrange: ソースコードの import 文を動的に確認する
    // この静的検査は、違反が存在することを明示的に文書化するためのテスト
    // (将来 UserRepository 経由に改善後はこのテストを変更すること)
    // Fixed: Windows環境で new URL().pathname が /C:/... を返し、readFileSync が C:\C:\... と解釈するため fileURLToPath を使用
    const { fileURLToPath } = await import('url');
    const sourceContent = await import('fs').then(fs =>
      fs.readFileSync(
        fileURLToPath(new URL('./create-user.ts', import.meta.url)),
        'utf-8'
      )
    );

    // Assert: レイヤー違反 - Application 層が Infrastructure 層を直接参照
    expect(sourceContent).toContain("import prisma from '../../infrastructure/prisma/prisma-client'");
  });
});

describe('アーキテクチャ原則 - レイヤー違反の検知 (APP-ARC-004)', () => {
  // APP-ARC-004: DeleteOrganizationHandler が prisma を直接参照している (レイヤー違反の検知)
  it('DeleteOrganizationHandler のソースコードが prisma を直接インポートしていることが確認できる', async () => {
    // Arrange: ソースコードの import 文を動的に確認する
    // Fixed: Windows環境で new URL().pathname が /C:/... を返し、readFileSync が C:\C:\... と解釈するため fileURLToPath を使用
    const { fileURLToPath: fileURLToPath2 } = await import('url');
    const sourceContent = await import('fs').then(fs =>
      fs.readFileSync(
        fileURLToPath2(new URL('./delete-organization.ts', import.meta.url)),
        'utf-8'
      )
    );

    // Assert: レイヤー違反 - Application 層が Infrastructure 層を直接参照
    expect(sourceContent).toContain("import prisma from '../../infrastructure/prisma/prisma-client'");
  });
});
