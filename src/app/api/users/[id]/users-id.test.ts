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

function mockSession(role: string) {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'admin-001', role, email: 'admin@example.com', name: 'Admin User' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/users/{id}', () => {
  // API-USR-003: DELETE /api/users/{id} - Admin ロールで論理削除が成功する
  it('Admin ロールで論理削除が成功し HTTP 200 が返る', async () => {
    // Arrange
    mockSession('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      deactivateUser: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });
    const request = new Request('http://localhost/api/users/user-001', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'user-001' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ message: 'User deactivated' });
  });

  it('Supervisor ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockSession('SUPERVISOR');
    const request = new Request('http://localhost/api/users/user-001', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'user-001' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});
