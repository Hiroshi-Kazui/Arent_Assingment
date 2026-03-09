import { describe, it, expect, vi, beforeEach } from 'vitest';

// モックセットアップ
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/infrastructure/auth/nextauth-options', () => ({
  authOptions: {},
}));

vi.mock('@/infrastructure/prisma/prisma-client', () => ({
  default: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ user_id: 'new-user-id' }),
    },
  },
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getCommandHandlers } from '@/application/di';
import { GET, POST } from './route';

function mockSession(role: string) {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, email: 'admin@example.com', name: 'Admin User' },
  });
}

function mockNoSession() {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/users', () => {
  // API-API-007: GET /api/users - Admin のみアクセス可能
  it('Admin ロールで HTTP 200 が返る', async () => {
    // Arrange
    mockSession('ADMIN');

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
  });

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

  // API-AUT-012: 未認証リクエストは 401 が返る
  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockNoSession();

    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(401);
  });
});

describe('POST /api/users', () => {
  // API-USR-001: POST /api/users - Admin ロールでユーザー作成が成功する
  it('Admin ロールでユーザー作成が成功し HTTP 201 が返る', async () => {
    // Arrange
    mockSession('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      createUser: {
        execute: vi.fn().mockResolvedValue({ userId: 'new-user-id' }),
      },
    });
    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '田中太郎',
        email: 'tanaka@example.com',
        password: 'password123',
        role: 'WORKER',
        organizationId: 'org-001',
      }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('userId');
  });

  // API-USR-002: POST /api/users - Supervisor ロールでは 403 が返る
  it('Supervisor ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockSession('SUPERVISOR');
    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '田中太郎',
        email: 'tanaka@example.com',
        password: 'password123',
        role: 'WORKER',
        organizationId: 'org-001',
      }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(403);
  });
});
