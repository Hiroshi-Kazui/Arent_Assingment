import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock('@/application/queries/list-buildings', () => ({
  listBuildings: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, limit: 20, totalPages: 0 }),
}));

vi.mock('@/application/dto/pagination', () => ({
  parsePaginationParams: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
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

describe('GET /api/buildings', () => {
  // API-API-001: GET /api/buildings - HTTP 200 が返る
  it('認証済みセッションで HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request('http://localhost/api/buildings');

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();
    const request = new Request('http://localhost/api/buildings');

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(401);
  });
});
