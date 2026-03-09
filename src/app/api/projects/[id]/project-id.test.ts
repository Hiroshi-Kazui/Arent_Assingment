import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

vi.mock('@/application/queries/get-project-detail', () => ({
  getProjectDetail: vi.fn(),
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
import { getProjectDetail } from '@/application/queries/get-project-detail';
import { GET, PATCH } from './route';

function mockSessionSuccess(role: string) {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role },
  });
}

function mockRoleSuccess(role: string) {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role },
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

describe('GET /api/projects/{id}', () => {
  // API-API-018: GET /api/projects/{id} - HTTP 200
  it('Admin セッションで HTTP 200 が返り id/name/status/progressRate を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getProjectDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'project-001',
      name: 'テストプロジェクト',
      status: 'ACTIVE',
      progressRate: 45,
      buildingId: 'building-001',
      startDate: '2026-01-01',
      dueDate: '2026-12-31',
    });

    const request = new Request('http://localhost/api/projects/project-001');
    const params = Promise.resolve({ id: 'project-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('id', 'project-001');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('status');
  });

  it('プロジェクトが見つからない場合 HTTP 404 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getProjectDetail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new Request('http://localhost/api/projects/non-existent');
    const params = Promise.resolve({ id: 'non-existent' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/projects/{id}', () => {
  // API-API-019: PATCH /api/projects/{id} - Admin でプロジェクト更新成功
  it('Admin セッションでプロジェクト更新が成功し HTTP 200 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      updateProject: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });

    const request = new Request('http://localhost/api/projects/project-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新後', status: 'ACTIVE' }),
    });
    const params = Promise.resolve({ id: 'project-001' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });

  it('Supervisor/Worker ロールでは 403 が返る', async () => {
    // Arrange
    mockRoleForbidden();

    const request = new Request('http://localhost/api/projects/project-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '更新後', status: 'ACTIVE' }),
    });
    const params = Promise.resolve({ id: 'project-001' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});
