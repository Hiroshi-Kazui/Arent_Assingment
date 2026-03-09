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

vi.mock('@/application/queries/list-issues', () => ({
  listIssues: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, limit: 20, totalPages: 0 }),
}));

vi.mock('@/infrastructure/prisma/prisma-client', () => ({
  default: {},
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
import { listIssues } from '@/application/queries/list-issues';
import { POST, GET } from './route';

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

function mockSessionSuccess(role: string) {
  (requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role, organizationId: 'org-001' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/projects/{id}/issues', () => {
  // API-AUT-001: Admin で Issue 作成が成功する
  it('Admin ロールで multipart/form-data に必須フィールドと BEFORE 写真を送ると HTTP 201 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      createIssue: {
        execute: vi.fn().mockResolvedValue('new-issue-id'),
      },
      addPhoto: {
        execute: vi.fn().mockResolvedValue('new-photo-id'),
      },
    });

    const formData = new FormData();
    formData.append('floorId', 'floor-001');
    formData.append('title', 'テスト指摘');
    formData.append('description', 'テスト説明');
    formData.append('dueDate', '2026-12-31');
    formData.append('locationType', 'dbId');
    formData.append('dbId', 'elem-001');
    formData.append('photoPhase', 'BEFORE');
    const jpgFile = new File(['fake image data'], 'photo.jpg', {
      type: 'image/jpeg',
    });
    formData.append('file', jpgFile);

    const request = new Request(
      'http://localhost/api/projects/p1/issues',
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'p1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(201);
  });

  // API-AUT-002: Worker ロールでは 403 が返る
  it('Worker ロールで HTTP 403 が返る', async () => {
    // Arrange
    mockRoleForbidden();
    const formData = new FormData();
    const request = new Request(
      'http://localhost/api/projects/p1/issues',
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'p1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(403);
  });

  // API-PHT-002: Issue 作成で写真ファイルなしだと 400 が返る
  it('multipart/form-data で写真ファイルなしだと HTTP 400 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    const formData = new FormData();
    formData.append('floorId', 'floor-001');
    formData.append('title', 'テスト指摘');
    formData.append('description', 'テスト説明');
    formData.append('dueDate', '2026-12-31');
    formData.append('locationType', 'dbId');
    formData.append('dbId', 'elem-001');
    formData.append('photoPhase', 'BEFORE');
    // ファイルなし

    const request = new Request(
      'http://localhost/api/projects/p1/issues',
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'p1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('At least one BEFORE photo is required');
  });

  // API-API-006: dueDate なしだと 400 が返る
  it('dueDate がない場合 HTTP 400 が返る', async () => {
    // Arrange
    mockRoleSuccess('ADMIN');
    const formData = new FormData();
    formData.append('floorId', 'floor-001');
    formData.append('title', 'テスト指摘');
    formData.append('description', 'テスト説明');
    // dueDate を省略
    formData.append('locationType', 'dbId');
    formData.append('dbId', 'elem-001');
    const jpgFile = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
    formData.append('file', jpgFile);
    formData.append('photoPhase', 'BEFORE');

    const request = new Request(
      'http://localhost/api/projects/p1/issues',
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'p1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(400);
  });

  // API-API-001: multipart/form-data を受け付ける (POST /api/projects/{id}/issues)
  it('Content-Type: multipart/form-data のリクエストが受け付けられる', async () => {
    // Arrange
    mockRoleSuccess('SUPERVISOR');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      createIssue: {
        execute: vi.fn().mockResolvedValue('new-issue-id'),
      },
      addPhoto: {
        execute: vi.fn().mockResolvedValue('new-photo-id'),
      },
    });

    const formData = new FormData();
    formData.append('floorId', 'floor-001');
    formData.append('title', 'テスト指摘');
    formData.append('description', 'テスト説明');
    formData.append('dueDate', '2026-12-31');
    formData.append('locationType', 'dbId');
    formData.append('dbId', 'elem-001');
    formData.append('photoPhase', 'BEFORE');
    const jpgFile = new File(['fake image'], 'before.jpg', { type: 'image/jpeg' });
    formData.append('file', jpgFile);

    const request = new Request(
      'http://localhost/api/projects/p1/issues',
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'p1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(201);
  });
});

describe('GET /api/projects/{id}/issues', () => {
  // API-API-005: floorId + status フィルタが動作する
  it('floorId と status フィルタを指定すると listIssues が対応する引数で呼ばれる', async () => {
    // Arrange
    mockSessionSuccess('ADMIN');
    const listIssuesMock = listIssues as ReturnType<typeof vi.fn>;
    listIssuesMock.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const request = new Request(
      'http://localhost/api/projects/p1/issues?floorId=f1&status=OPEN,IN_PROGRESS'
    );
    const params = Promise.resolve({ id: 'p1' });

    // Act
    const response = await GET(request, { params });

    // Assert
    expect(response.status).toBe(200);
    expect(listIssuesMock).toHaveBeenCalledWith(
      expect.anything(),
      'f1',
      expect.anything(),
      expect.arrayContaining(['OPEN', 'IN_PROGRESS']),
      expect.any(String),
      expect.any(String)
    );
  });
});
