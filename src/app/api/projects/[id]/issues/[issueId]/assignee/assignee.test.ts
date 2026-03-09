import { describe, it, expect, vi, beforeEach } from 'vitest';

// モックセットアップ
vi.mock('@/api/utils/auth', () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock('@/application/di', () => ({
  getCommandHandlers: vi.fn(),
}));

vi.mock('@/api/utils/error-handler', () => ({
  handleError: vi.fn((error: unknown) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }),
  successResponse: vi.fn((data: unknown) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json(data, { status: 200 });
  }),
}));

import { requireRole } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';
import { NextResponse } from 'next/server';
import { PATCH } from './route';

function mockAuthSuccess(role: string) {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, email: 'test@example.com' },
  });
}

function mockAuthForbidden() {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/projects/{id}/issues/{issueId}/assignee', () => {
  // APP-ASG-001: Supervisor による正常系
  it('Supervisor セッションで assignIssue.execute() が呼ばれ HTTP 200 が返る', async () => {
    // Arrange
    mockAuthSuccess('SUPERVISOR');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      assignIssue: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    });
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1/assignee',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: 'user-1' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const handlers = (getCommandHandlers as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handlers.assignIssue.execute).toHaveBeenCalled();
  });

  // API-ASG-001: Worker が PATCH /assignee を呼ぶと 403 が返る
  it('Worker ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockAuthForbidden();
    const request = new Request(
      'http://localhost/api/projects/p1/issues/i1/assignee',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: 'user-1' }),
      }
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await PATCH(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });
});
