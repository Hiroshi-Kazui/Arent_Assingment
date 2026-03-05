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
import { Badge } from '@/components/ui/badge';
import { AuthHeader } from '@/app/components/auth-header';

interface OrganizationDto {
  organizationId: string;
  name: string;
  type: 'HEADQUARTERS' | 'BRANCH';
}

interface UserDto {
  userId: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理者',
  SUPERVISOR: '監督者',
  WORKER: '作業員',
};

const ROLES = ['ADMIN', 'SUPERVISOR', 'WORKER'] as const;

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [orgs, setOrgs] = useState<OrganizationDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterRole, setFilterRole] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'WORKER', organizationId: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', organizationId: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/organizations').then((r) => r.json()),
    ])
      .then(([userData, orgData]) => {
        setUsers(Array.isArray(userData) ? userData : []);
        setOrgs(Array.isArray(orgData) ? orgData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
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

  const orgMap = Object.fromEntries(orgs.map((o) => [o.organizationId, o.name]));

  const filteredUsers = users.filter((u) => {
    if (filterRole && u.role !== filterRole) return false;
    if (filterOrg && u.organizationId !== filterOrg) return false;
    if (filterActive === 'active' && !u.isActive) return false;
    if (filterActive === 'inactive' && u.isActive) return false;
    return true;
  });

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim() || !addForm.organizationId) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error ?? '作成に失敗しました');
      } else {
        setShowAdd(false);
        setAddForm({ name: '', email: '', password: '', role: 'WORKER', organizationId: '' });
        fetchData();
      }
    } catch {
      setAddError('作成に失敗しました');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editUser || !editForm.name.trim() || !editForm.email.trim() || !editForm.organizationId) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/users/${editUser.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          organizationId: editForm.organizationId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? '更新に失敗しました');
      } else {
        setEditUser(null);
        fetchData();
      }
    } catch {
      setEditError('更新に失敗しました');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (user: UserDto) => {
    if (user.isActive) {
      // Deactivate via DELETE
      await fetch(`/api/users/${user.userId}`, { method: 'DELETE' });
    } else {
      // Reactivate via PATCH
      await fetch(`/api/users/${user.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
    }
    fetchData();
  };

  const selectClass = "bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">指摘管理ツール</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <Link href="/admin/organizations" className="hover:underline">支部管理</Link>
              {' / '}ユーザー管理
            </p>
          </div>
          <AuthHeader />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">ユーザー一覧</h2>
          <Button
            onClick={() => {
              setAddForm({ name: '', email: '', password: '', role: 'WORKER', organizationId: orgs[0]?.organizationId ?? '' });
              setAddError(null);
              setShowAdd(true);
            }}
          >
            ユーザー追加
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className={selectClass}
          >
            <option value="">全ロール</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>

          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className={selectClass}
          >
            <option value="">全組織</option>
            {orgs.map((o) => (
              <option key={o.organizationId} value={o.organizationId}>{o.name}</option>
            ))}
          </select>

          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className={selectClass}
          >
            <option value="">全状態</option>
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
        </div>

        <div className="rounded-lg border border-neutral-800 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-neutral-900/60">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">名前</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">メール</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ロール</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">所属組織</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">状態</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">作成日</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredUsers.map((user) => (
                <tr key={user.userId} className="hover:bg-neutral-900/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role] ?? user.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.organizationId ? (orgMap[user.organizationId] ?? user.organizationId) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? '有効' : '無効'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditUser(user);
                          setEditForm({
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            organizationId: user.organizationId ?? '',
                          });
                          setEditError(null);
                        }}
                      >
                        編集
                      </Button>
                      <Button
                        variant={user.isActive ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.isActive ? '無効化' : '有効化'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    ユーザーが見つかりません
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
            <DialogTitle>ユーザー追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">名前</label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="名前を入力"
                disabled={addLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">メールアドレス</label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                disabled={addLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">パスワード</label>
              <Input
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="パスワードを入力"
                disabled={addLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ロール</label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                disabled={addLoading}
                className={`${selectClass} w-full`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">所属組織</label>
              <select
                value={addForm.organizationId}
                onChange={(e) => setAddForm((f) => ({ ...f, organizationId: e.target.value }))}
                disabled={addLoading}
                className={`${selectClass} w-full`}
              >
                <option value="">選択してください</option>
                {orgs.map((o) => (
                  <option key={o.organizationId} value={o.organizationId}>{o.name}</option>
                ))}
              </select>
            </div>
            {addError && <p className="text-destructive text-sm">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={addLoading}>
              キャンセル
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addLoading || !addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim() || !addForm.organizationId}
            >
              {addLoading ? '追加中...' : '追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">名前</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                disabled={editLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">メールアドレス</label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                disabled={editLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ロール</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                disabled={editLoading}
                className={`${selectClass} w-full`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">所属組織</label>
              <select
                value={editForm.organizationId}
                onChange={(e) => setEditForm((f) => ({ ...f, organizationId: e.target.value }))}
                disabled={editLoading}
                className={`${selectClass} w-full`}
              >
                <option value="">選択してください</option>
                {orgs.map((o) => (
                  <option key={o.organizationId} value={o.organizationId}>{o.name}</option>
                ))}
              </select>
            </div>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={editLoading}>
              キャンセル
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editLoading || !editForm.name.trim() || !editForm.email.trim() || !editForm.organizationId}
            >
              {editLoading ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
