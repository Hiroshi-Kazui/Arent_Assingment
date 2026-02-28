import { IssueDetailDto } from '../dto/issue-dto';
import { IssueId } from '../../domain/models/issue';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Issue の詳細を取得
 * Photos も含む
 */
export async function getIssueDetail(
  issueId: IssueId
): Promise<IssueDetailDto | null> {
  const issue = await prisma.issue.findUnique({
    where: { issue_id: issueId },
    include: {
      photos: {
        orderBy: { uploaded_at: 'desc' },
      },
    },
  });

  if (!issue) {
    return null;
  }

  return {
    issueId: issue.issue_id,
    projectId: issue.project_id,
    title: issue.title,
    description: issue.description,
    issueType: issue.issue_type ?? undefined,
    status: issue.status as 'OPEN' | 'IN_PROGRESS' | 'DONE',
    priority: issue.priority,
    locationType: issue.location_type as 'dbId' | 'worldPosition',
    dbId: issue.db_id ? String(issue.db_id) : undefined,
    worldPositionX: issue.world_position_x
      ? Number(issue.world_position_x)
      : undefined,
    worldPositionY: issue.world_position_y
      ? Number(issue.world_position_y)
      : undefined,
    worldPositionZ: issue.world_position_z
      ? Number(issue.world_position_z)
      : undefined,
    reportedBy: Number(issue.reported_by),
    createdAt: issue.created_at,
    floorId: issue.floor_id,
    photos: issue.photos.map((photo) => ({
      photoId: photo.photo_id,
      blobKey: photo.blob_key,
      photoPhase: photo.photo_phase as 'BEFORE' | 'AFTER',
      uploadedAt: photo.uploaded_at,
    })),
  };
}
