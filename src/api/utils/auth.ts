import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/infrastructure/auth/nextauth-options';

export interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
  organizationId?: string;
}

/**
 * セッションを取得し、未認証なら401レスポンスを返す。
 * 認証済みならユーザー情報を返す。
 */
export async function requireSession(): Promise<
  | { user: AuthenticatedUser }
  | { error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  return {
    user: {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      organizationId: session.user.organizationId,
    },
  };
}

/**
 * セッション取得 + ロールチェック。
 * 許可ロールに含まれなければ403を返す。
 */
export async function requireRole(
  ...allowedRoles: string[]
): Promise<
  | { user: AuthenticatedUser }
  | { error: NextResponse }
> {
  const result = await requireSession();
  if ('error' in result) return result;

  if (!allowedRoles.includes(result.user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      ),
    };
  }
  return result;
}
