import { NextResponse } from 'next/server';
import { getPhotoUrl } from '@/application/queries/get-photo-url';
import { getQueryHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';

interface Params {
  photoId: string;
}

/**
 * GET /api/photos/[photoId]/url
 * Photo の署名付き URL を取得
 * クエリパラメータ: ?expirationMinutes=xxx（デフォルト: 60）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { photoId } = await params;
    const url = new URL(request.url);
    const expirationMinutes = parseInt(
      url.searchParams.get('expirationMinutes') || '60',
      10
    );

    const handlers = getQueryHandlers();
    const photoUrl = await getPhotoUrl(
      photoId,
      handlers.photoStorage,
      expirationMinutes
    );

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
