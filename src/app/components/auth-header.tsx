'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理者',
  SUPERVISOR: '監督者',
  WORKER: '作業員',
};

export function AuthHeader() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <div className="flex items-center gap-3">
      {session.user.role === 'ADMIN' && (
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          管理画面
        </Link>
      )}
      <span className="text-sm text-muted-foreground">{session.user.name}</span>
      <Badge variant="outline" className="text-xs">
        {ROLE_LABELS[session.user.role] ?? session.user.role}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-xs"
      >
        ログアウト
      </Button>
    </div>
  );
}
