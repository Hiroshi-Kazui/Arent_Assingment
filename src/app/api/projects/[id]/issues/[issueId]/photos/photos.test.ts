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

vi.mock('@/api/utils/error-handler', () => ({
  handleError: vi.fn((error: unknown) => {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }),
  successResponse: vi.fn((data: unknown, status = 200) =>
    NextResponse.json(data, { status })
  ),
}));

import { requireRole } from '@/api/utils/auth';
import { getCommandHandlers } from '@/application/di';
import { POST } from './route';

function mockAuthSuccess(role: string) {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'user-001', role },
  });
}

function mockAuthForbidden() {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  });
}

function createMultipartRequest(
  url: string,
  formData: FormData
): Request {
  return new Request(url, {
    method: 'POST',
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/projects/{id}/issues/{issueId}/photos', () => {
  // API-PHT-001: 許可外拡張子を送ると 400 が返る
  it('.bmp ファイルを送ると HTTP 400 が返り Invalid file extension が含まれる', async () => {
    // Arrange
    mockAuthSuccess('WORKER');
    const formData = new FormData();
    const bmpFile = new File(['fake data'], 'photo.bmp', { type: 'image/bmp' });
    formData.append('file', bmpFile);
    formData.append('photoPhase', 'AFTER');

    const request = createMultipartRequest(
      'http://localhost/api/projects/p1/issues/i1/photos',
      formData
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid file extension');
  });

  // API-AUT-007: WORKER ロールで写真アップロードが成功する
  it('Worker ロールで有効な jpg ファイルを送ると HTTP 201 が返る', async () => {
    // Arrange
    mockAuthSuccess('WORKER');
    (getCommandHandlers as ReturnType<typeof vi.fn>).mockReturnValue({
      addPhoto: {
        execute: vi.fn().mockResolvedValue('photo-new-001'),
      },
    });
    const formData = new FormData();
    const jpgFile = new File(['fake image data'], 'photo.jpg', {
      type: 'image/jpeg',
    });
    formData.append('file', jpgFile);
    formData.append('photoPhase', 'AFTER');

    const request = createMultipartRequest(
      'http://localhost/api/projects/p1/issues/i1/photos',
      formData
    );
    const params = Promise.resolve({ id: 'p1', issueId: 'i1' });

    // Act
    const response = await POST(request, { params });

    // Assert
    expect(response.status).toBe(201);
  });
});
