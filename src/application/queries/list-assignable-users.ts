import prisma from '../../infrastructure/prisma/prisma-client';

export interface AssignableUserDto {
  userId: string;
  name: string;
  role: string;
  activeIssueCount: number;
}

/**
 * 担当者として割り当て可能なユーザー一覧を取得
 * WORKER/SUPERVISOR ロールの有効ユーザーのみ
 * 未完了（DONE/CONFIRMED以外）の担当タスク件数を含む
 */
export async function listAssignableUsers(): Promise<AssignableUserDto[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['WORKER', 'SUPERVISOR'] },
      is_active: true,
    },
    select: {
      user_id: true,
      name: true,
      role: true,
      _count: {
        select: {
          assigned_issues: {
            where: {
              status: { notIn: ['DONE', 'CONFIRMED'] },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return users.map((u) => ({
    userId: u.user_id,
    name: u.name,
    role: u.role,
    activeIssueCount: u._count.assigned_issues,
  }));
}
