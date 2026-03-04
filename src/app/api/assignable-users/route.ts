import { listAssignableUsers } from '@/application/queries/list-assignable-users';
import { handleError, successResponse } from '@/api/utils/error-handler';
import { requireSession } from '@/api/utils/auth';

/**
 * GET /api/assignable-users
 * 担当者として割り当て可能なユーザー一覧（未完了件数付き）
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if ('error' in auth) return auth.error;

    const users = await listAssignableUsers();
    return successResponse(users);
  } catch (error) {
    return handleError(error);
  }
}
