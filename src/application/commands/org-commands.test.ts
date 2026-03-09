import { describe, it, expect, vi } from 'vitest';
import { CreateOrganizationHandler } from './create-organization';
import {
  DeleteOrganizationHandler,
  OrganizationHasUsersError,
} from './delete-organization';
import { IOrganizationRepository } from '../../domain/repositories/organization-repository';
import {
  Organization,
  OrganizationId,
  OrganizationType,
} from '../../domain/models/organization';
import { DomainError } from '../../domain/errors/domain-error';

// NOTE: DeleteOrganizationHandler は prisma を直接参照するため、
// vi.mock でモジュールをモックする必要がある。

vi.mock('../../infrastructure/prisma/prisma-client', () => ({
  default: {
    user: {
      count: vi.fn(),
    },
  },
}));

import prisma from '../../infrastructure/prisma/prisma-client';

function createMockOrgRepository(org: Organization | null = null): IOrganizationRepository {
  return {
    findById: vi.fn().mockResolvedValue(org),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createHQOrg(): Organization {
  return Organization.reconstruct(
    OrganizationId.create('hq-org-id'),
    '本社',
    OrganizationType.Headquarters,
    undefined,
    new Date('2026-01-01'),
    new Date('2026-01-01')
  );
}

function createBranchOrg(): Organization {
  return Organization.reconstruct(
    OrganizationId.create('branch-org-id'),
    '東京支部',
    OrganizationType.Branch,
    OrganizationId.create('hq-org-id'),
    new Date('2026-01-01'),
    new Date('2026-01-01')
  );
}

describe('DeleteOrganizationHandler - 統合テスト', () => {
  // APP-ORG-001: DeleteOrganizationHandler で HQ 組織を削除しようとすると DomainError
  it('HQ 組織を削除しようとすると DomainError がスローされる', async () => {
    // Arrange
    const hqOrg = createHQOrg();
    const repo = createMockOrgRepository(hqOrg);
    const handler = new DeleteOrganizationHandler(repo);

    // Act & Assert
    await expect(handler.execute('hq-org-id')).rejects.toThrow(DomainError);
    await expect(handler.execute('hq-org-id')).rejects.toThrow(
      'Cannot delete headquarters organization'
    );
  });

  // APP-ORG-002: DeleteOrganizationHandler でユーザーが所属する Branch 組織を削除しようとすると OrganizationHasUsersError
  it('ユーザーが所属する Branch 組織を削除しようとすると OrganizationHasUsersError がスローされる', async () => {
    // Arrange
    const branchOrg = createBranchOrg();
    const repo = createMockOrgRepository(branchOrg);
    const handler = new DeleteOrganizationHandler(repo);
    // prisma.user.count モックを 1 を返すよう設定
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    // Act & Assert
    await expect(handler.execute('branch-org-id')).rejects.toThrow(OrganizationHasUsersError);
  });

  it('ユーザーが所属しない Branch 組織は正常に削除される', async () => {
    // Arrange
    const branchOrg = createBranchOrg();
    const repo = createMockOrgRepository(branchOrg);
    const handler = new DeleteOrganizationHandler(repo);
    (prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    // Act
    await handler.execute('branch-org-id');

    // Assert
    expect(repo.delete).toHaveBeenCalled();
  });
});

describe('CreateOrganizationHandler - 統合テスト', () => {
  // APP-ORG-005: HQ type を指定して CreateOrganizationHandler を呼ぶとバリデーションエラー
  it('parentId が undefined の場合バリデーションエラーがスローされる（HQ 型組織の作成禁止）', async () => {
    // Arrange
    const repo = createMockOrgRepository();
    const handler = new CreateOrganizationHandler(repo);

    // Act & Assert
    // CreateOrganizationInput の parentId は必須。undefined を渡すと OrganizationId.create() でエラーになる
    // HQ 組織は parentId なしで作成されるが、ハンドラは常に Branch 型のみ作成でき
    // かつ parentId の検証でエラーになるため、HQ 型の組織は作成不可
    await expect(
      handler.execute({ name: '本社2', parentId: undefined as unknown as string })
    ).rejects.toThrow();
    // repo.save が呼ばれていないことを確認（HQ 組織が作成されていない）
    expect(repo.save).not.toHaveBeenCalled();
  });

  // APP-ORG-004: CreateOrganizationHandler は BRANCH 型の組織のみ作成できる
  it('BRANCH 型の組織のみが作成され repo.save() に渡される', async () => {
    // Arrange
    const repo = createMockOrgRepository();
    const handler = new CreateOrganizationHandler(repo);

    // Act
    await handler.execute({ name: '大阪支部', parentId: 'hq-id' });

    // Assert
    expect(repo.save).toHaveBeenCalledOnce();
    const savedOrg = (repo.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as Organization;
    expect(savedOrg.type).toBe(OrganizationType.Branch);
    expect(savedOrg.name).toBe('大阪支部');
  });
});
