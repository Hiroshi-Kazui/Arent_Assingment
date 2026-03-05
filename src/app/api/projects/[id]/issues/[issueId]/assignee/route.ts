import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireRole } from '@/api/utils/auth';

interface Params {
  id: string;
  issueId: string;
}

/**
 * PATCH /api/projects/[id]/issues/[issueId]/assignee
 * Issue の担当者を割り当て（PointOut → Open への遷移を含む）
 * Supervisor のみ実行可能
 * リクエストボディ: { assigneeId: string }
 * changedBy はセッションから自動取得
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireRole('SUPERVISOR', 'ADMIN');
    if ('error' in auth) return auth.error;

    const { id, issueId } = await params;
    const body = await request.json();

    if (!body.assigneeId) {
      return NextResponse.json(
        { error: 'Missing required field: assigneeId' },
        { status: 400 }
      );
    }

    const handlers = getCommandHandlers();
    await handlers.assignIssue.execute({
      issueId,
      projectId: id,
      assigneeId: body.assigneeId,
      changedBy: auth.user.id,
    });

    return successResponse({ message: 'Assignee updated successfully' });
  } catch (error) {
    return handleError(error);
  }
}
