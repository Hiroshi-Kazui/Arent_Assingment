'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthHeader } from '@/app/components/auth-header';

interface OrganizationDto {
  organizationId: string;
  name: string;
  type: 'HEADQUARTERS' | 'BRANCH';
  userCount: number;
}

interface UserDto {
  userId: string;
  role: string;
  isActive: boolean;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [orgs, setOrgs] = useState<OrganizationDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      Promise.all([
        fetch('/api/organizations').then((r) => r.json()),
        fetch('/api/users').then((r) => r.json()),
      ])
        .then(([orgData, userData]) => {
          setOrgs(Array.isArray(orgData) ? orgData : []);
          setUsers(Array.isArray(userData) ? userData : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [status, session]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">権限がありません</p>
      </div>
    );
  }

  const branchCount = orgs.filter((o) => o.type === 'BRANCH').length;
  const activeUsers = users.filter((u) => u.isActive);
  const adminCount = activeUsers.filter((u) => u.role === 'ADMIN').length;
  const supervisorCount = activeUsers.filter((u) => u.role === 'SUPERVISOR').length;
  const workerCount = activeUsers.filter((u) => u.role === 'WORKER').length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">指摘管理ツール</h1>
            <p className="text-sm text-muted-foreground mt-1">管理ダッシュボード</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
              プロジェクト一覧
            </Link>
            <AuthHeader />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-neutral-900/40 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">支部数</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{branchCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/40 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ユーザー数</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activeUsers.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/40 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ロール別内訳</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm">管理者: <span className="font-semibold">{adminCount}</span></p>
              <p className="text-sm">監督者: <span className="font-semibold">{supervisorCount}</span></p>
              <p className="text-sm">作業員: <span className="font-semibold">{workerCount}</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/admin/organizations" className="block group">
            <Card className="bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800 hover:border-primary/50 transition-all shadow-sm cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">支部管理</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">支部の追加・編集・削除を行います。</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/users" className="block group">
            <Card className="bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800 hover:border-primary/50 transition-all shadow-sm cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="group-hover:text-primary transition-colors">ユーザー管理</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">ユーザーの追加・編集・有効化/無効化を行います。</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
