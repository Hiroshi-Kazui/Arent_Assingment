import { NextResponse } from 'next/server';
import {
  getIssueDetail,
} from '@/application/queries/get-issue-detail';
import { IssueId } from '@/domain/models/issue';
import { handleError, successResponse } from '@/api/utils/error-handler';

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
