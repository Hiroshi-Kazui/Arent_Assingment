import { IssueDetailDto } from '../dto/issue-dto';
import { IssueId } from '../../domain/models/issue';
import prisma from '../../infrastructure/prisma/prisma-client';

/**
 * 指定 Issue の詳細を取得
 * Photos, StatusChangeLogs, Assignee も含む
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
      status_change_logs: {
        orderBy: { changed_at: 'asc' },
        include: { changed_by_user: { select: { name: true } } },
      },
      assignee: { select: { name: true } },
      floor: { select: { name: true } },
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
    dueDate: issue.due_date.toISOString(),
    status: issue.status as 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED',
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
    reportedBy: issue.reported_by,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    floorId: issue.floor_id,
    floorName: issue.floor?.name ?? undefined,
    photos: issue.photos.map((photo) => ({
      photoId: photo.photo_id,
      blobKey: photo.blob_key,
      photoPhase: photo.photo_phase as 'BEFORE' | 'AFTER' | 'REJECTION',
      uploadedAt: photo.uploaded_at,
      uploadedBy: photo.uploaded_by ?? undefined,
    })),
    assigneeId: issue.assignee_id ?? undefined,
    assigneeName: issue.assignee?.name ?? undefined,
    statusChangeLogs: issue.status_change_logs.map((log) => ({
      logId: log.log_id,
      fromStatus: log.from_status,
      toStatus: log.to_status,
      changedByName: log.changed_by_user.name,
      comment: log.comment ?? undefined,
      changedAt: log.changed_at.toISOString(),
    })),
  };
}
