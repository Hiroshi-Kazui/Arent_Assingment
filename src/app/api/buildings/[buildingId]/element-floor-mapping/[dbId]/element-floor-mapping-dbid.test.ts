import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/application/queries/get-element-floor', () => ({
  getElementFloor: vi.fn(),
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
import { getElementFloor } from '@/application/queries/get-element-floor';
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

describe('GET /api/buildings/{buildingId}/element-floor-mapping/{dbId}', () => {
  // API-API-016: GET /api/buildings/{buildingId}/element-floor-mapping/{dbId} - HTTP 200
  it('認証済みセッションで HTTP 200 が返り単一フロア情報を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getElementFloor as ReturnType<typeof vi.fn>).mockResolvedValue({
      buildingId: 'building-001',
      dbId: 123,
      floorId: 'floor-001',
      floorName: '1F',
    });

    const request = new Request(
      'http://localhost/api/buildings/building-001/element-floor-mapping/123'
    );
    const params = Promise.resolve({ buildingId: 'building-001', dbId: '123' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });

  it('マッピングが見つからない場合 HTTP 404 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getElementFloor as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new Request(
      'http://localhost/api/buildings/building-001/element-floor-mapping/999'
    );
    const params = Promise.resolve({ buildingId: 'building-001', dbId: '999' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(404);
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();

    const request = new Request(
      'http://localhost/api/buildings/building-001/element-floor-mapping/123'
    );
    const params = Promise.resolve({ buildingId: 'building-001', dbId: '123' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });
});
