import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

interface Params {
  id: string;
  issueId: string;
}

/**
 * PATCH /api/projects/[id]/issues/[issueId]/status
 * Issue のステータスを更新
 * リクエストボディ: { status: string, comment?: string }
 * changedBy はセッションから自動取得（クライアント値を信用しない）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { id, issueId } = await params;
    const body = await request.json();

    // リクエストバリデーション
    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    const inputStatus = String(body.status);
    const statusMap: Record<string, 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED'> = {
      POINT_OUT: 'POINT_OUT',
      OPEN: 'OPEN',
      IN_PROGRESS: 'IN_PROGRESS',
      DONE: 'DONE',
      CONFIRMED: 'CONFIRMED',
      PointOut: 'POINT_OUT',
      Open: 'OPEN',
      InProgress: 'IN_PROGRESS',
      Done: 'DONE',
      Confirmed: 'CONFIRMED',
    };
    const normalizedStatus = statusMap[inputStatus];
    if (!normalizedStatus) {
      return NextResponse.json(
        {
          error:
            'Invalid status. Must be one of: PointOut, Open, InProgress, Done, Confirmed',
        },
        { status: 400 }
      );
    }

    // 承認(CONFIRMED)は Admin/Supervisor のみ
    if (normalizedStatus === 'CONFIRMED' && auth.user.role === 'WORKER') {
      return NextResponse.json(
        { error: 'Workers cannot approve issues' },
        { status: 403 }
      );
    }

    const handlers = getCommandHandlers();
    await handlers.updateIssueStatus.execute({
      issueId,
      projectId: id,
      newStatus: normalizedStatus,
      comment: body.comment ?? undefined,
      changedBy: auth.user.id,
    });

    return successResponse({
      message: 'Status updated successfully',
    });
  } catch (error) {
    return handleError(error);
  }
}
