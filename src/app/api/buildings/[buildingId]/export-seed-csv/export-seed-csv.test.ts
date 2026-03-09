import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

// fs モジュールをモック（実際のファイル書き込みを避ける）
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('@/infrastructure/prisma/prisma-client', () => ({
  default: {
    floor: {
      findMany: vi.fn().mockResolvedValue([
        { floor_id: 'floor-001', building_id: 'building-001', name: '1F', floor_number: 1, elevation: 0 },
      ]),
    },
    elementFloorMapping: {
      findMany: vi.fn().mockResolvedValue([
        { building_id: 'building-001', db_id: 123, floor_id: 'floor-001', bounding_box_min_z: 0 },
      ]),
    },
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
import { POST } from './route';

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

describe('GET /api/buildings/{buildingId}/export-seed-csv', () => {
  // API-API-010: GET /api/buildings/{buildingId}/export-seed-csv - CSV エクスポート
  // 実装は POST メソッドで実装されているためPOSTでテスト
  it('認証済みセッションで HTTP 200 が返り CSV データ（エクスポート件数）を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request(
      'http://localhost/api/buildings/building-001/export-seed-csv',
      { method: 'POST' }
    );
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('floorsExported');
    expect(body).toHaveProperty('mappingsExported');
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();
    const request = new Request(
      'http://localhost/api/buildings/building-001/export-seed-csv',
      { method: 'POST' }
    );
    const params = Promise.resolve({ buildingId: 'building-001' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });
});
