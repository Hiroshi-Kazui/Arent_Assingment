import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import prisma from '@/infrastructure/prisma/prisma-client';

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

    // 業務ルール: 指摘写真（BEFORE）は必須
    const beforeCount = await prisma.photo.count({
      where: { issue_id: issueId, photo_phase: 'BEFORE' },
    });
    if (beforeCount === 0) {
      return NextResponse.json(
        {
          error:
            'At least one BEFORE photo is required before changing issue status',
        },
        { status: 400 }
      );
    }

    // 業務ルール: 完了報告（DONE）時は完了写真（AFTER）が必須
    if (normalizedStatus === 'DONE') {
      const afterCount = await prisma.photo.count({
        where: { issue_id: issueId, photo_phase: 'AFTER' },
      });
      if (afterCount === 0) {
        return NextResponse.json(
          {
            error:
              'At least one AFTER photo is required to mark an issue as DONE',
          },
          { status: 400 }
        );
      }
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
