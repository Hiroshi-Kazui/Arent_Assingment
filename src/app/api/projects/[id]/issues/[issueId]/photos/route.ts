import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';

interface Params {
  id: string;
  issueId: string;
}

/**
 * POST /api/projects/[id]/issues/[issueId]/photos
 * Photo をアップロード
 * multipart/form-data で file と photoPhase を受け取る
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id, issueId } = await params;
    const formData = await request.formData();

    // ファイルと photoPhase を取得
    const file = formData.get('file') as File;
    const photoPhase = formData.get('photoPhase') as string;

    // リクエストバリデーション
    if (!file) {
      return NextResponse.json(
        { error: 'Missing required field: file' },
        { status: 400 }
      );
    }

    if (!photoPhase) {
      return NextResponse.json(
        { error: 'Missing required field: photoPhase' },
        { status: 400 }
      );
    }

    if (!['BEFORE', 'AFTER'].includes(photoPhase)) {
      return NextResponse.json(
        {
          error: `Invalid photoPhase: ${photoPhase}. Must be BEFORE or AFTER`,
        },
        { status: 400 }
      );
    }

    // File を Buffer に変換
    const buffer = Buffer.from(await file.arrayBuffer());

    const handlers = getCommandHandlers();
    const photoId = await handlers.addPhoto.execute({
      issueId,
      projectId: id,
      file: buffer,
      fileName: file.name,
      contentType: file.type,
      photoPhase: photoPhase as 'BEFORE' | 'AFTER',
    });

    return successResponse(
      {
        photoId,
        blobKey: `projects/${id}/issues/${issueId}/photos/${photoId}.${
          file.name.split('.').pop() || 'bin'
        }`,
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
}
