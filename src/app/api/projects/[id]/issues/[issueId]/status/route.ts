import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';

interface Params {
  id: string;
  issueId: string;
}

/**
 * PATCH /api/projects/[id]/issues/[issueId]/status
 * Issue のステータスを更新
 * リクエストボディ: { status: "Open" | "InProgress" | "Done" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
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
    const statusMap: Record<string, 'OPEN' | 'IN_PROGRESS' | 'DONE'> = {
      OPEN: 'OPEN',
      IN_PROGRESS: 'IN_PROGRESS',
      DONE: 'DONE',
      Open: 'OPEN',
      InProgress: 'IN_PROGRESS',
      Done: 'DONE',
    };
    const normalizedStatus = statusMap[inputStatus];
    if (!normalizedStatus) {
      return NextResponse.json(
        {
          error:
            'Invalid status. Must be one of: Open, InProgress, Done',
        },
        { status: 400 }
      );
    }

    const handlers = getCommandHandlers();
    await handlers.updateIssueStatus.execute({
      issueId,
      projectId: id,
      newStatus: normalizedStatus,
    });

    return successResponse({
      message: 'Status updated successfully',
    });
  } catch (error) {
    return handleError(error);
  }
}
