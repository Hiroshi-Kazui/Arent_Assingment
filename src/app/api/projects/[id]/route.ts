import { NextResponse } from 'next/server';
import { getProjectDetail } from '@/application/queries/get-project-detail';
import { ProjectId } from '@/domain/models/project';
import { handleError, successResponse } from '@/api/utils/error-handler';

interface Params {
  id: string;
}

/**
 * GET /api/projects/[id]
 * プロジェクト詳細を取得（building情報含む）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const projectId = ProjectId.create(id);
    const project = await getProjectDetail(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return successResponse(project);
  } catch (error) {
    return handleError(error);
  }
}
