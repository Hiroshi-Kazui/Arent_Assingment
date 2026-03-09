import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/infrastructure/auth/nextauth-options', () => ({
  authOptions: {},
}));

vi.mock('@/application/queries/list-organizations', () => ({
  listOrganizations: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getCommandHandlers } from '@/application/di';

// Route ハンドラを動的 import（モックが先に設定されている必要がある）
import { GET, POST } from './route';

function mockSession(role: string) {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, email: 'test@example.com', name: 'Test User' },
  });
}

function mockNoSession() {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/organizations', () => {
  // API-ORG-001: GET /api/organizations - Admin ロールで正常に一覧取得できる
  it('Admin ロールで HTTP 200 が返る', async () => {
    // Arrange
    mockSession('ADMIN');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
  });

  // API-ORG-002: GET /api/organizations - Supervisor/Worker ロールでは 403 が返る
  it('Supervisor ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockSession('SUPERVISOR');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(403);
  });

  it('Worker ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockSession('WORKER');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(403);
  });
});

describe('POST /api/organizations', () => {
  it('Admin ロールで正常にリクエストが処理される', async () => {
    // Arrange
    mockSession('ADMIN');
    const mockOrg = {
      id: 'org-new-001',
      name: '大阪支部',
      type: 'BRANCH',
      parentId: 'hq-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      createOrganization: {
        execute: vi.fn().mockResolvedValue(mockOrg),
      },
    });
    const request = new Request('http://localhost/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '大阪支部', parentId: 'hq-id' }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(201);
  });

  it('name が未指定の場合 HTTP 400 が返る', async () => {
    // Arrange
    mockSession('ADMIN');
    const request = new Request('http://localhost/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: 'hq-id' }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });
});
