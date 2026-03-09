import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

vi.mock('@/api/utils/error-handler', () => ({
  handleError: vi.fn((error: unknown) => {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }),
  successResponse: vi.fn((data: unknown) => NextResponse.json(data, { status: 200 })),
}));

import { requireSession } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';
import { PATCH } from './route';

function mockSessionUser(role: string) {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, email: 'test@example.com' },
  });
}

function mockSessionUnauthorized() {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

function mockUpdateIssueStatus(executeMock: ReturnType<typeof vi.fn>) {
  (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
    updateIssueStatus: { execute: executeMock },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/projects/{id}/issues/{issueId}/status', () => {
  // API-AUT-005: Worker が CONFIRMED を指定すると 403
  it('Worker が CONFIRMED を指定すると HTTP 403 が返る', async () => {
    // Arrange
    mockSessionUser('WORKER');
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'Workers cannot approve issues' });
  });

  // API-AUT-006: Admin/Supervisor が CONFIRMED を指定できる
  it('Supervisor が CONFIRMED を指定すると HTTP 200 が返る', async () => {
    // Arrange
    mockSessionUser('SUPERVISOR');
    const executeMock = vi.fn().mockResolvedValue(undefined);
    mockUpdateIssueStatus(executeMock);
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(200);
  });

  // API-API-002: PATCH で PascalCase ステータスが受け付けられる
  it('PascalCase の InProgress が受け付けられ IN_PROGRESS に変換される', async () => {
    // Arrange
    mockSessionUser('WORKER');
    const executeMock = vi.fn().mockResolvedValue(undefined);
    mockUpdateIssueStatus(executeMock);
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'InProgress' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(200);
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'IN_PROGRESS' })
    );
  });

  // API-API-003: 無効なステータスを渡すと 400 が返る
  it('無効なステータス INVALID_STATUS を渡すと HTTP 400 が返る', async () => {
    // Arrange
    mockSessionUser('WORKER');
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1/status',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INVALID_STATUS' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(400);
  });
});
