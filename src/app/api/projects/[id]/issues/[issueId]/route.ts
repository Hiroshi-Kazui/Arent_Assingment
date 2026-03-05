import { NextResponse } from 'next/server';
import {
  getIssueDetail,
} from '@/application/queries/get-issue-detail';
import { IssueId } from '@/domain/models/issue';
import { getCommandHandlers } from '@/application/di';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession, requireRole } from '@/api/utils/auth';

interface Params {
  id: string;
  issueId: string;
}

/**
 * GET /api/projects/[id]/issues/[issueId]
 * Issue の詳細を取得（Photos 含む）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const { id, issueId: issueIdParam } = await params;
    const issueId = IssueId.create(issueIdParam);
    const detail = await getIssueDetail(issueId);

    if (!detail) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    if (detail.projectId !== id) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    return successResponse(detail);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/projects/[id]/issues/[issueId]
 * 指摘のタイトル・説明を更新（Admin / Supervisor のみ）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireRole('ADMIN', 'SUPERVISOR');
    if ('error' in auth) return auth.error;

    const { id, issueId: issueIdParam } = await params;
    const body = await request.json();
    const { title, description } = body as { title?: string; description?: string };

    if (!title && !description) {
      return NextResponse.json(
        { error: 'title or description is required' },
        { status: 400 }
      );
    }

    const handlers = getCommandHandlers();

    if (title && title.trim().length > 0) {
      await handlers.updateIssueTitle.execute({
        issueId: issueIdParam,
        projectId: id,
        title: title.trim(),
      });
    }

    if (description && description.trim().length > 0) {
      await handlers.updateIssueDescription.execute({
        issueId: issueIdParam,
        projectId: id,
        description: description.trim(),
      });
    }

    return successResponse({ message: 'Issue updated successfully' });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/projects/[id]/issues/[issueId]
 * 指摘を削除（Supervisor のみ）
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const auth = await requireRole('SUPERVISOR');
    if ('error' in auth) return auth.error;

    const { id, issueId: issueIdParam } = await params;
    const handlers = getCommandHandlers();
    await handlers.deleteIssue.execute({ issueId: issueIdParam, projectId: id });

    return successResponse({ message: 'Issue deleted successfully' });
  } catch (error) {
    return handleError(error);
  }
}
