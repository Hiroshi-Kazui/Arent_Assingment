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

vi.mock('@/application/queries/get-issue-detail', () => ({
  getIssueDetail: vi.fn(),
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
import { DELETE, PATCH } from './route';

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

describe('DELETE /api/projects/{id}/issues/{issueId}', () => {
  // API-AUT-008: Supervisor ロールで削除が成功する
  it('Supervisor ロールで HTTP 200 が返る', async () => {
    // Arrange
    mockRoleSuccess('SUPERVISOR');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      deleteIssue: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1',
      { method: 'DELETE' }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ message: 'Issue deleted successfully' });
  });

  // API-AUT-009: Admin/Worker ロールでは 403 が返る
  it('Admin/Worker ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockRoleForbidden();
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1',
      { method: 'DELETE' }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await DELETE(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/projects/{id}/issues/{issueId}', () => {
  // API-AUT-010: Admin/Supervisor でタイトル更新が成功する
  it('Admin ロールでタイトル更新が成功し HTTP 200 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      updateIssueTitle: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
      updateIssueDescription: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新タイトル' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });

  // API-AUT-011: Worker ロールでは 403 が返る
  it('Worker ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockRoleForbidden();
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新タイトル' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});
