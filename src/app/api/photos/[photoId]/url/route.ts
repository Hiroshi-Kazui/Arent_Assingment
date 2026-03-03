import { NextResponse } from 'next/server';
import { getPhotoUrl } from '@/application/queries/get-photo-url';
import { getQueryHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

interface Params {
  photoId: string;
}

/**
 * GET /api/photos/[photoId]/url
 * Photo の署名付き URL を取得
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { photoId } = await params;

    const handlers = getQueryHandlers();
    const photoUrl = await getPhotoUrl(photoId, handlers.photoStorage);

    if (!photoUrl) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    return successResponse({ url: photoUrl });
  } catch (error) {
    return handleError(error);
  }
}
