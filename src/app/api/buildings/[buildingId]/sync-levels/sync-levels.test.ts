import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getProviders: vi.fn(),
  getRepositories: vi.fn(),
}));

vi.mock('@/infrastructure/aps/aps-model-metadata', () => ({
  ApsModelMetadataService: vi.fn().mockImplementation(() => ({
    getLevelNames: vi.fn().mockResolvedValue(['1F', '2F', '3F']),
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
import { getProviders, getRepositories } from '@/application/di';
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

function mockRepositoriesWithBuilding() {
  (getRepositories as ReturnType<typeof vi.fn>).mockReturnValue({
    building: {
      findById: vi.fn().mockResolvedValue({
        id: 'building-001',
        name: 'Test Building',
        modelUrn: 'urn:adsk:wiprepo:test-model-urn',
      }),
    },
    floor: {
      bulkUpsert: vi.fn().mockResolvedValue([
        { id: 'floor-001', name: '1F', floorNumber: 1, elevation: null },
        { id: 'floor-002', name: '2F', floorNumber: 2, elevation: null },
        { id: 'floor-003', name: '3F', floorNumber: 3, elevation: null },
      ]),
    },
  });
  (getProviders as ReturnType<typeof vi.fn>).mockReturnValue({
    viewerTokenProvider: {
      getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token', expiresIn: 3600 }),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/buildings/{buildingId}/sync-levels', () => {
  // API-API-017: GET /api/buildings/{buildingId}/sync-levels - HTTP 200
  it('認証済みセッションで APS モックありの場合 HTTP 200 が返り同期レベル情報を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    mockRepositoriesWithBuilding();

    const request = new Request(
      'http://localhost/api/buildings/building-001/sync-levels'
    );
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('floorsCreated');
    expect(body).toHaveProperty('floors');
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();

    const request = new Request(
      'http://localhost/api/buildings/building-001/sync-levels'
    );
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });
});
