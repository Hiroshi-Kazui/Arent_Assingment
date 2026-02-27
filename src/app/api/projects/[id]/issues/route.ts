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
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          error:
            'Issue registration requires multipart/form-data with at least one BEFORE photo',
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const floorId = String(formData.get('floorId') || '');
    const title = String(formData.get('title') || '');
    const description = String(formData.get('description') || '');
    const issueType = String(formData.get('issueType') || '') || undefined;
    const locationType = String(formData.get('locationType') || '');
    const dbId = String(formData.get('dbId') || '') || undefined;
    const worldPositionX = formData.get('worldPositionX');
    const worldPositionY = formData.get('worldPositionY');
    const worldPositionZ = formData.get('worldPositionZ');
    const reportedBy = String(formData.get('reportedBy') || '') || undefined;
    const files = formData
      .getAll('files')
      .filter((v): v is File => v instanceof File);

    // リクエストバリデーション
    if (!floorId || !title || !description) {
      return NextResponse.json(
        {
          error: 'Missing required fields: floorId, title, description',
        },
        { status: 400 }
      );
    }

    if (!locationType) {
      return NextResponse.json(
        {
          error: 'Missing required field: locationType',
        },
        { status: 400 }
      );
    }
    if (!['dbId', 'worldPosition'].includes(locationType)) {
      return NextResponse.json(
        {
          error: 'Invalid locationType. Must be dbId or worldPosition',
        },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: 'At least one BEFORE photo is required when creating an issue',
        },
        { status: 400 }
      );
    }

    if (
      locationType === 'worldPosition' &&
      (worldPositionX === null || worldPositionY === null || worldPositionZ === null)
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
      floorId,
      title,
      description,
      issueType,
      locationType: locationType as 'dbId' | 'worldPosition',
      dbId,
      worldPositionX: worldPositionX !== null ? Number(worldPositionX) : undefined,
      worldPositionY: worldPositionY !== null ? Number(worldPositionY) : undefined,
      worldPositionZ: worldPositionZ !== null ? Number(worldPositionZ) : undefined,
      reportedBy,
    };

    const handlers = getCommandHandlers();
    const issueId = await handlers.createIssue.execute(input);

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await handlers.addPhoto.execute({
        issueId,
        projectId: id,
        file: buffer,
        fileName: file.name,
        contentType: file.type,
        photoPhase: 'BEFORE',
      });
    }

    return successResponse(
      { issueId },
      201
    );
  } catch (error) {
    return handleError(error);
  }
}
