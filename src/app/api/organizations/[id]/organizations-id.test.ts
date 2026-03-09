import { describe, it, expect, vi, beforeEach } from 'vitest';

// モックセットアップ
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/infrastructure/auth/nextauth-options', () => ({
  authOptions: {},
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getCommandHandlers } from '@/application/di';
import { DELETE } from './route';
import { DomainError } from '@/domain/errors/domain-error';
import { OrganizationHasUsersError } from '@/application/commands/delete-organization';

function mockSession(role: string) {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, email: 'test@example.com', name: 'Test User' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/organizations/{id}', () => {
  // API-ORG-003: DELETE /api/organizations/{id} で HQ を削除しようとすると 403 が返る
  it('HQ 組織を削除しようとすると HTTP 403 が返る', async () => {
    // Arrange
    mockSession('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      deleteOrganization: {
        execute: vi.fn().mockRejectedValue(
          new DomainError('Cannot delete headquarters organization')
        ),
      },
    });
    const request = new Request('http://localhost/api/organizations/hq-id', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'hq-id' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });

  // API-ORG-004: DELETE /api/organizations/{id} でユーザー所属 Branch を削除しようとすると 409 が返る
  it('ユーザーが所属する Branch 組織を削除しようとすると HTTP 409 が返る', async () => {
    // Arrange
    mockSession('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      deleteOrganization: {
        execute: vi.fn().mockRejectedValue(
          new OrganizationHasUsersError('branch-id')
        ),
      },
    });
    const request = new Request('http://localhost/api/organizations/branch-id', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'branch-id' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(409);
  });

  it('Admin 以外は HTTP 403 が返る', async () => {
    // Arrange
    mockSession('SUPERVISOR');
    const request = new Request('http://localhost/api/organizations/org-id', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'org-id' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});
