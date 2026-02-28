import { NextResponse } from 'next/server';
import { getCommandHandlers } from '@/application/di';
import {
  listIssues,
} from '@/application/queries/list-issues';
import { CreateIssueInput } from '@/application/dto/issue-dto';
import { ProjectId } from '@/domain/models/project';
import { handleError, successResponse } from '@/api/utils/error-handler';
import prisma from '@/infrastructure/prisma/prisma-client';

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
  let createdIssueId: string | null = null;
  try {
    const { id } = await params;
    const contentType = request.headers.get('content-type') || '';
    let floorId = '';
    let title = '';
    let description = '';
    let issueType: string | undefined;
    let locationType = '';
    let dbId: string | undefined;
    let worldPositionX: number | undefined;
    let worldPositionY: number | undefined;
    let worldPositionZ: number | undefined;
    let files: File[] = [];
    let photoPhase: 'BEFORE' | 'AFTER' = 'BEFORE';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      floorId = String(formData.get('floorId') || '');
      title = String(formData.get('title') || '');
      description = String(formData.get('description') || '');
      issueType = String(formData.get('issueType') || '') || undefined;
      locationType = String(formData.get('locationType') || '');
      dbId = String(formData.get('dbId') || '') || undefined;
      const worldXRaw = formData.get('worldPositionX');
      const worldYRaw = formData.get('worldPositionY');
      const worldZRaw = formData.get('worldPositionZ');
      worldPositionX = worldXRaw !== null ? Number(worldXRaw) : undefined;
      worldPositionY = worldYRaw !== null ? Number(worldYRaw) : undefined;
      worldPositionZ = worldZRaw !== null ? Number(worldZRaw) : undefined;
      const photoPhaseRaw = String(formData.get('photoPhase') || 'BEFORE');
      photoPhase = (['BEFORE', 'AFTER'].includes(photoPhaseRaw) ? photoPhaseRaw : 'BEFORE') as 'BEFORE' | 'AFTER';
      files = [
        ...formData.getAll('files').filter((v): v is File => v instanceof File),
        ...formData.getAll('file').filter((v): v is File => v instanceof File),
      ];
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      floorId = String(body.floorId || '');
      title = String(body.title || '');
      description = String(body.description || '');
      issueType = body.issueType ? String(body.issueType) : undefined;
      locationType = String(body.locationType || '');
      dbId = body.dbId ? String(body.dbId) : undefined;
      worldPositionX = body.worldPositionX !== undefined ? Number(body.worldPositionX) : undefined;
      worldPositionY = body.worldPositionY !== undefined ? Number(body.worldPositionY) : undefined;
      worldPositionZ = body.worldPositionZ !== undefined ? Number(body.worldPositionZ) : undefined;
    } else {
      return NextResponse.json(
        {
          error: 'Unsupported Content-Type. Use multipart/form-data or application/json',
        },
        { status: 415 }
      );
    }

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

    if (
      locationType === 'worldPosition' &&
      (worldPositionX === undefined ||
        worldPositionY === undefined ||
        worldPositionZ === undefined)
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
      worldPositionX,
      worldPositionY,
      worldPositionZ,
    };

    const handlers = getCommandHandlers();
    const issueId = await handlers.createIssue.execute(input);
    createdIssueId = issueId;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await handlers.addPhoto.execute({
        issueId,
        projectId: id,
        file: buffer,
        fileName: file.name,
        contentType: file.type,
        photoPhase,
      });
    }

    return successResponse(
      { issueId },
      201
    );
  } catch (error) {
    if (createdIssueId) {
      try {
        await prisma.issue.delete({ where: { issue_id: createdIssueId } });
      } catch {
        // ロールバック失敗はログのみで握り潰す（元エラーを優先）
      }
    }
    return handleError(error);
  }
}
