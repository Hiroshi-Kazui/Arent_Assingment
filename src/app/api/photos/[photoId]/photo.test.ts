import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireRole: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

vi.mock('@/domain/errors/photo-delete-forbidden', () => ({
  PhotoDeleteForbiddenError: class PhotoDeleteForbiddenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PhotoDeleteForbiddenError';
    }
  },
}));

vi.mock('@/api/utils/error-handler', () => ({
  handleError: vi.fn((error: unknown) => {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }),
  successResponse: vi.fn((data: unknown, status = 200) =>
    NextResponse.json(data, { status })
  ),
}));

import { requireRole } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';
import { DELETE } from './route';

function mockRoleSuccess(role: string) {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role },
  });
}

function mockRoleForbidden() {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/photos/{photoId}', () => {
  // API-API-011: DELETE /api/photos/{photoId} - 写真削除成功
  it('Supervisor セッションで写真削除が成功し HTTP 200 が返る', async () => {
    // Arrange
    mockRoleSuccess('SUPERVISOR');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      deletePhoto: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });

    const request = new Request('http://localhost/api/photos/photo-001', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ photoId: 'photo-001' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('deleted', true);
  });

  it('Admin セッションでも写真削除が成功し HTTP 200 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      deletePhoto: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });

    const request = new Request('http://localhost/api/photos/photo-001', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ photoId: 'photo-001' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });

  it('未認証リクエストで HTTP 403 が返る', async () => {
    // Arrange
    mockRoleForbidden();

    const request = new Request('http://localhost/api/photos/photo-001', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ photoId: 'photo-001' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});
