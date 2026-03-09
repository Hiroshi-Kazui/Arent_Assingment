import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock('@/application/queries/list-floors', () => ({
  listFloors: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, limit: 20, totalPages: 0 }),
}));

vi.mock('@/application/dto/pagination', () => ({
  parsePaginationParams: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
}));

vi.mock('@/infrastructure/prisma/prisma-client', () => ({
  default: {
    floor: {
      update: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
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

import { requireSession } from '@/api/utils/auth';
import { GET, PATCH } from './route';

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

describe('GET /api/buildings/{buildingId}/floors', () => {
  // API-API-002: GET /api/buildings/{buildingId}/floors - HTTP 200 が返る
  it('認証済みセッションで HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request('http://localhost/api/buildings/building-001/floors');
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();
    const request = new Request('http://localhost/api/buildings/building-001/floors');
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/buildings/{buildingId}/floors', () => {
  // API-API-012: PATCH /api/buildings/{buildingId}/floors - フロア情報更新成功
  it('Admin セッションで elevations を送ると HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request('http://localhost/api/buildings/building-001/floors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elevations: [{ floorId: 'floor-001', elevation: 3.5 }],
      }),
    });
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });
});
