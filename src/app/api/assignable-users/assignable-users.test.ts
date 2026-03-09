import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/application/queries/list-assignable-users', () => ({
  listAssignableUsers: vi.fn().mockResolvedValue([
    { userId: 'user-001', name: 'User One', role: 'WORKER', activeIssueCount: 2 },
    { userId: 'user-002', name: 'User Two', role: 'WORKER', activeIssueCount: 0 },
  ]),
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

import { requireSession } from '@/api/utils/auth';
import { GET } from './route';

function mockSessionSuccess(role: string) {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role },
  });
}

function mockSessionUnauthorized() {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/assignable-users', () => {
  // API-API-009: GET /api/assignable-users - 正常取得
  it('Supervisor セッションで HTTP 200 が返りユーザー一覧を含む', async () => {
    // Arrange
    mockSessionSuccess('SUPERVISOR');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
  });

  it('Admin セッションでも HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(401);
  });
});
