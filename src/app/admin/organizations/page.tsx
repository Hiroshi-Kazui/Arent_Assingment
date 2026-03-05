'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthHeader } from '@/app/components/auth-header';

interface OrganizationDto {
  organizationId: string;
  name: string;
  type: 'HEADQUARTERS' | 'BRANCH';
  userCount: number;
  projectCount: number;
  createdAt: string;
}

export default function OrganizationsPage() {
  const { data: session, status } = useSession();
  const [orgs, setOrgs] = useState<OrganizationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal state
  const [editOrg, setEditOrg] = useState<OrganizationDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteOrg, setDeleteOrg] = useState<OrganizationDto | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchOrgs = () => {
    setLoading(true);
    fetch('/api/organizations')
      .then((r) => r.json())
      .then((data) => {
        setOrgs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('組織情報の取得に失敗しました');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrgs();
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [status]);

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

  const headquarters = orgs.find((o) => o.type === 'HEADQUARTERS');

  const handleAdd = async () => {
    if (!addName.trim() || !headquarters) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), parentId: headquarters.organizationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error ?? '作成に失敗しました');
      } else {
        setShowAdd(false);
        setAddName('');
        fetchOrgs();
      }
    } catch {
      setAddError('作成に失敗しました');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editOrg || !editName.trim()) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/organizations/${editOrg.organizationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? '更新に失敗しました');
      } else {
        setEditOrg(null);
        setEditName('');
        fetchOrgs();
      }
    } catch {
      setEditError('更新に失敗しました');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteOrg) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/organizations/${deleteOrg.organizationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setDeleteError('所属ユーザーがいるため削除できません');
        } else {
          setDeleteError(data.error ?? '削除に失敗しました');
        }
      } else {
        setDeleteOrg(null);
        fetchOrgs();
      }
    } catch {
      setDeleteError('削除に失敗しました');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">指摘管理ツール</h1>
            <p className="text-sm text-muted-foreground mt-1">
              支部管理
            </p>
          </div>
          <AuthHeader />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">支部一覧</h2>
          <Button onClick={() => { setShowAdd(true); setAddName(''); setAddError(null); }}>
            支部追加
          </Button>
        </div>

        {errorMsg && (
          <p className="text-destructive mb-4">{errorMsg}</p>
        )}

        <div className="rounded-lg border border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">組織名</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">タイプ</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">プロジェクト数</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ユーザー数</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">作成日</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {orgs.map((org) => (
                <tr key={org.organizationId} className="hover:bg-neutral-900/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/organizations/${org.organizationId}`}
                      className="hover:underline text-primary"
                    >
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {org.type === 'HEADQUARTERS' ? '本部' : '支部'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{org.projectCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{org.userCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    {org.type !== 'HEADQUARTERS' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditOrg(org);
                            setEditName(org.name);
                            setEditError(null);
                          }}
                        >
                          編集
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeleteOrg(org);
                            setDeleteError(null);
                          }}
                        >
                          削除
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    組織が見つかりません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>支部追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">支部名</label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="支部名を入力"
                disabled={addLoading}
              />
            </div>
            {addError && <p className="text-destructive text-sm">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={addLoading}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={addLoading || !addName.trim()}>
              {addLoading ? '追加中...' : '追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editOrg} onOpenChange={(open) => { if (!open) setEditOrg(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>支部編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">支部名</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="支部名を入力"
                disabled={editLoading}
              />
            </div>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)} disabled={editLoading}>
              キャンセル
            </Button>
            <Button onClick={handleEdit} disabled={editLoading || !editName.trim()}>
              {editLoading ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteOrg} onOpenChange={(open) => { if (!open) setDeleteOrg(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>支部削除の確認</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">
              「{deleteOrg?.name}」を削除しますか？この操作は元に戻せません。
            </p>
            {deleteError && <p className="text-destructive text-sm mt-2">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrg(null)} disabled={deleteLoading}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? '削除中...' : '削除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
