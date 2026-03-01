import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';

interface Params {
  id: string;
  issueId: string;
}

const ALLOWED_PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length <= 1) {
    return '';
  }
  return parts[parts.length - 1].toLowerCase();
}

/**
 * POST /api/projects/[id]/issues/[issueId]/photos
 * Photo をアップロード
 * multipart/form-data で files[] (or file) と photoPhase を受け取る
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id, issueId } = await params;
    const formData = await request.formData();

    // ファイルと photoPhase を取得
    const files = [
      ...formData.getAll('files').filter((v): v is File => v instanceof File),
      ...formData.getAll('file').filter((v): v is File => v instanceof File),
    ];
    const photoPhase = formData.get('photoPhase') as string;

    // リクエストバリデーション
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: files' },
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

    const handlers = getCommandHandlers();
    const uploadedPhotos: Array<{ photoId: string; blobKey: string }> = [];

    for (const file of files) {
      const ext = getFileExtension(file.name);
      if (!ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          {
            error:
              'Invalid file extension. Allowed: .jpg, .jpeg, .png, .webp',
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const photoId = await handlers.addPhoto.execute({
        issueId,
        projectId: id,
        file: buffer,
        fileName: file.name,
        contentType: file.type,
        photoPhase: photoPhase as 'BEFORE' | 'AFTER',
      });

      uploadedPhotos.push({
        photoId,
        blobKey: `projects/${id}/issues/${issueId}/photos/${photoId}.${
          ext || 'bin'
        }`,
      });
    }

    return successResponse(
      {
        photoId: uploadedPhotos[0]?.photoId ?? null,
        blobKey: uploadedPhotos[0]?.blobKey ?? null,
        photoIds: uploadedPhotos.map((p) => p.photoId),
        photos: uploadedPhotos,
        uploadedCount: uploadedPhotos.length,
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
}
