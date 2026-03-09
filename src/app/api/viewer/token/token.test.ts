import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getProviders: vi.fn(),
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
import { getProviders } from '@/application/di';
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
  // APS 環境変数をセット
  process.env.APS_CLIENT_ID = 'test-client-id';
  process.env.APS_CLIENT_SECRET = 'test-client-secret';
});

describe('GET /api/viewer/token', () => {
  // API-API-004: GET /api/viewer/token - HTTP 200 が返る
  it('認証済みセッションで HTTP 200 が返り token プロパティを含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getProviders as ReturnType<typeof vi.fn>).mockReturnValue({
      viewerTokenProvider: {
        getAccessToken: vi.fn().mockResolvedValue({
          token: 'test-access-token',
          expiresIn: 3600,
        }),
      },
    });

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('access_token');
    expect(body.access_token).toBe('test-access-token');
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
