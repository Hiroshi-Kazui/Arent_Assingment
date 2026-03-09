import { describe, it, expect, vi, beforeEach } from 'vitest';

// モックセットアップ
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/infrastructure/auth/nextauth-options', () => ({
  authOptions: {},
}));

import { getServerSession } from 'next-auth';
import { GET } from './route';

function mockSession(role: string) {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: {
      id: 'user-001',
      name: 'Test User',
      role,
      organizationId: 'org-001',
      email: 'test@example.com',
    },
  });
}

function mockNoSession() {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/auth/me', () => {
  // API-API-005: GET /api/auth/me - HTTP 200 が返る
  it('認証済みセッションで HTTP 200 が返りユーザー情報を含む', async () => {
    // Arrange
    mockSession('ADMIN');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('userId', 'user-001');
    expect(body).toHaveProperty('role', 'ADMIN');
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockNoSession();

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(401);
  });
});
