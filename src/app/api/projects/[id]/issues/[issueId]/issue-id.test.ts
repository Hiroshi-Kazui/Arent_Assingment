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

import { requireSession } from '@/api/utils/auth';
import { getIssueDetail } from '@/application/queries/get-issue-detail';
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

describe('GET /api/projects/{id}/issues/{issueId}', () => {
  // API-API-020: GET /api/projects/{id}/issues/{issueId} - HTTP 200
  it('Admin セッションで HTTP 200 が返り issueId/title/status/photos を含む', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getIssueDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      issueId: 'issue-001',
      projectId: 'project-001',
      title: 'テスト指摘',
      status: 'OPEN',
      photos: [],
      floorId: 'floor-001',
      description: 'テスト説明',
    });

    const request = new Request(
      'http://localhost/api/projects/project-001/issues/issue-001'
    );
    const params = Promise.resolve({ id: 'project-001', issueId: 'issue-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('issueId', 'issue-001');
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('photos');
  });

  it('指摘が見つからない場合 HTTP 404 が返る', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    (getIssueDetail as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new Request(
      'http://localhost/api/projects/project-001/issues/non-existent'
    );
    const params = Promise.resolve({ id: 'project-001', issueId: 'non-existent' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(404);
  });

  it('未認証リクエストで HTTP 401 が返る', async () => {
    // Arrange
    mockSessionUnauthorized();

    const request = new Request(
      'http://localhost/api/projects/project-001/issues/issue-001'
    );
    const params = Promise.resolve({ id: 'project-001', issueId: 'issue-001' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(401);
  });
});
