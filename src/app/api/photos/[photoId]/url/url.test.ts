import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getQueryHandlers: vi.fn(),
}));

vi.mock('@/application/queries/get-photo-url', () => ({
  getPhotoUrl: vi.fn(),
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
import { getQueryHandlers } from '@/application/di';
import { getPhotoUrl } from '@/application/queries/get-photo-url';
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

describe('GET /api/photos/{photoId}/url', () => {
  // API-API-006: GET /api/photos/{photoId}/url - HTTP 200、署名付き URL 含む
  it('認証済みセッションで HTTP 200 が返り署名付き URL を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getQueryHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      photoStorage: {},
    });
    (getPhotoUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
      'https://minio.example.com/photos/photo-001.jpg?X-Amz-Signature=abc123'
    );

    const request = new Request('http://localhost/api/photos/photo-001/url');
    const params = Promise.resolve({ photoId: 'photo-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('url');
    expect(body.url).toContain('http');
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();

    const request = new Request('http://localhost/api/photos/photo-001/url');
    const params = Promise.resolve({ photoId: 'photo-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });

  it('写真が見つからない場合 HTTP 404 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getQueryHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      photoStorage: {},
    });
    (getPhotoUrl as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new Request('http://localhost/api/photos/non-existent/url');
    const params = Promise.resolve({ photoId: 'non-existent' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(404);
  });
});
