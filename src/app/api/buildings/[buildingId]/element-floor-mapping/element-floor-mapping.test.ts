import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/application/queries/get-element-floor', () => ({
  getElementFloorMappings: vi.fn().mockResolvedValue([
    { buildingId: 'building-001', dbId: 123, floorId: 'floor-001' },
  ]),
  getElementFloorMappingCount: vi.fn().mockResolvedValue(10),
}));

vi.mock('@/infrastructure/prisma/prisma-element-floor-mapping-repository', () => ({
  PrismaElementFloorMappingRepository: vi.fn().mockImplementation(() => ({
    deleteByBuildingId: vi.fn().mockResolvedValue(undefined),
    bulkUpsert: vi.fn().mockResolvedValue(5),
  })),
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

describe('GET /api/buildings/{buildingId}/element-floor-mapping', () => {
  // API-API-015: GET /api/buildings/{buildingId}/element-floor-mapping - HTTP 200
  it('認証済みセッションで HTTP 200 が返りフロアマッピング配列を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request(
      'http://localhost/api/buildings/building-001/element-floor-mapping'
    );
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('mappings');
    expect(Array.isArray(body.mappings)).toBe(true);
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();
    const request = new Request(
      'http://localhost/api/buildings/building-001/element-floor-mapping'
    );
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });
});
