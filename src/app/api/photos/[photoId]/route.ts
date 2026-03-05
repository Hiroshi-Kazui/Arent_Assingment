import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireRole } from '@/api/utils/auth';
import { PhotoDeleteForbiddenError } from '@/domain/errors/photo-delete-forbidden';

interface Params {
  photoId: string;
}

/**
 * DELETE /api/photos/[photoId]
 * 写真を削除（Admin/Supervisor: 全写真、Worker: 自分がアップロードした写真のみ）
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireRole('ADMIN', 'SUPERVISOR', 'WORKER');
    if ('error' in auth) return auth.error;

    const { photoId } = await params;
    const handlers = getCommandHandlers();

    await handlers.deletePhoto.execute({
      photoId,
      userId: auth.user.id,
      userRole: auth.user.role,
    });

    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof PhotoDeleteForbiddenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    return handleError(error);
  }
}
