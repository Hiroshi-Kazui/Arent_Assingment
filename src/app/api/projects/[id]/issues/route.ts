import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import {
  listIssues,
} from '@/application/queries/list-issues';
import { CreateIssueInput } from '@/application/dto/issue-dto';
import { ProjectId } from '@/domain/models/project';
import { handleError, successResponse } from '@/api/utils/error-handler';

interface Params {
  id: string;
}

/**
 * GET /api/projects/[id]/issues
 * 指定プロジェクトの Issue 一覧を取得
 * クエリパラメータ: ?floorId=xxx（オプション）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const projectId = ProjectId.create(id);
    const url = new URL(request.url);
    const floorId = url.searchParams.get('floorId') || undefined;

    const issues = await listIssues(
      projectId,
      floorId as any
    );
    return successResponse(issues);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/projects/[id]/issues
 * 新しい Issue を作成
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // リクエストバリデーション
    if (!body.floorId || !body.title || !body.description) {
      return NextResponse.json(
        {
          error: 'Missing required fields: floorId, title, description',
        },
        { status: 400 }
      );
    }

    if (!body.locationType) {
      return NextResponse.json(
        {
          error: 'Missing required field: locationType',
        },
        { status: 400 }
      );
    }

    if (
      body.locationType === 'worldPosition' &&
      (body.worldPositionX === undefined ||
        body.worldPositionY === undefined ||
        body.worldPositionZ === undefined)
    ) {
      return NextResponse.json(
        {
          error:
            'worldPosition requires worldPositionX/Y/Z',
        },
        { status: 400 }
      );
    }

    const input: CreateIssueInput = {
      projectId: id,
      floorId: body.floorId,
      title: body.title,
      description: body.description,
      issueType: body.issueType,
      locationType: body.locationType,
      dbId: body.dbId,
      worldPositionX: body.worldPositionX,
      worldPositionY: body.worldPositionY,
      worldPositionZ: body.worldPositionZ,
      reportedBy: body.reportedBy,
    };

    const handlers = getCommandHandlers();
    const issueId = await handlers.createIssue.execute(input);

    return successResponse(
      { issueId },
      201
    );
  } catch (error) {
    return handleError(error);
  }
}
