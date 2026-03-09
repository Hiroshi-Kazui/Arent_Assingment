import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock('@/application/queries/list-projects', () => ({
  listProjects: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  }),
}));

vi.mock('@/application/dto/pagination', () => ({
  parsePaginationParams: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
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

import { requireRole, requireSession } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';
import { GET, POST } from './route';

function mockSessionSuccess(role: string) {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, organizationId: 'org-001' },
  });
}

function mockSessionUnauthorized() {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

function mockRoleSuccess(role: string) {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, organizationId: 'org-001' },
  });
}

function mockRoleForbidden() {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/projects', () => {
  // API-API-008: 全ロールでアクセス可能
  it('Admin ロールで HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request('http://localhost/api/projects');

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it('Worker ロールでも HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('WORKER');
    const request = new Request('http://localhost/api/projects');

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
  });

  // API-AUT-012: 未認証リクエストは 401 が返る
  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();
    const request = new Request('http://localhost/api/projects');

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(401);
  });

  // API-API-004: ページネーションパラメータを受け付ける
  it('page=2&limit=5 を指定すると HTTP 200 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const request = new Request('http://localhost/api/projects?page=2&limit=5');

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
  });
});

describe('POST /api/projects', () => {
  // API-AUT-003: Admin で Project 作成が成功する
  it('Admin ロールで必須フィールドを送ると HTTP 201 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      createProject: {
        execute: vi.fn().mockResolvedValue('new-project-id'),
      },
    });
    const request = new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'building-001',
        name: '新プロジェクト',
        startDate: '2026-01-01',
        dueDate: '2026-12-31',
        branchId: 'branch-001',
      }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(201);
  });

  // API-AUT-004: Supervisor/Worker ロールでは 403 が返る
  it('Supervisor ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockRoleForbidden();
    const request = new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'building-001',
        name: '新プロジェクト',
        startDate: '2026-01-01',
        dueDate: '2026-12-31',
        branchId: 'branch-001',
      }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(403);
  });
});
