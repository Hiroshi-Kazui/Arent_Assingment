'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AuthHeader } from '@/app/components/auth-header';

interface OrganizationDto {
  organizationId: string;
  name: string;
  type: 'HEADQUARTERS' | 'BRANCH';
  userCount: number;
  createdAt: string;
}

interface ProjectListItemDto {
  projectId: string;
  name: string;
  plan: string;
  buildingId: string;
  branchId: string;
  status: string;
  issueCount: number;
  progressRate: number;
  startDate: string;
  dueDate: string;
}

interface BuildingDto {
  buildingId: string;
  name: string;
  address: string;
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

const STATUS_LABELS: Record<string, string> = {
  PLANNING: '計画中',
  ACTIVE: '進行中',
  COMPLETED: '完了',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  PLANNING: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理者',
  SUPERVISOR: '監督者',
  WORKER: '作業員',
};

const ROLES = ['ADMIN', 'SUPERVISOR', 'WORKER'] as const;

const selectClass =
  'bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Projects tab state
  const [projects, setProjects] = useState<ProjectListItemDto[]>([]);
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Project create modal
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    plan: '',
    startDate: undefined as Date | undefined,
    dueDate: undefined as Date | undefined,
    status: 'PLANNING',
    buildingId: '',
  });
  const [createCalStartOpen, setCreateCalStartOpen] = useState(false);
  const [createCalDueOpen, setCreateCalDueOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Project edit modal
  const [editProject, setEditProject] = useState<ProjectListItemDto | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    plan: '',
    startDate: undefined as Date | undefined,
    dueDate: undefined as Date | undefined,
    status: 'PLANNING',
  });
  const [editCalStartOpen, setEditCalStartOpen] = useState(false);
  const [editCalDueOpen, setEditCalDueOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Users tab state
  const [users, setUsers] = useState<UserDto[]>([]);
  const [orgs, setOrgs] = useState<OrganizationDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // User add modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WORKER',
    organizationId: orgId,
  });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // User edit modal
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    role: '',
    organizationId: '',
  });
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  const fetchOrg = async () => {
    const res = await fetch('/api/organizations');
    if (res.ok) {
      const data = await res.json();
      const list: OrganizationDto[] = Array.isArray(data) ? data : [];
      const found = list.find((o) => o.organizationId === orgId);
      if (found) setOrg(found);
    }
  };

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await fetch('/api/projects?limit=100');
      const data = await res.json();
      const items: ProjectListItemDto[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setProjects(items.filter((p) => p.branchId === orgId));
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchBuildings = async () => {
    const res = await fetch('/api/buildings?limit=100');
    const data = await res.json();
    const items: BuildingDto[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
      ? data.items
      : [];
    setBuildings(items);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const [usersRes, orgsRes] = await Promise.all([
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/organizations').then((r) => r.json()),
      ]);
      const allUsers: UserDto[] = Array.isArray(usersRes) ? usersRes : [];
      setUsers(allUsers.filter((u) => u.organizationId === orgId));
      setOrgs(Array.isArray(orgsRes) ? orgsRes : []);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([fetchOrg(), fetchProjects(), fetchBuildings(), fetchUsers()]).finally(() =>
        setLoading(false)
      );
    } else if (status !== 'loading') {
      setLoading(false);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // --- Project handlers ---

  const handleCreateProject = async () => {
    if (!createForm.name.trim() || !createForm.startDate || !createForm.dueDate || !createForm.buildingId) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          plan: createForm.plan.trim() || undefined,
          startDate: format(createForm.startDate, 'yyyy-MM-dd'),
          dueDate: format(createForm.dueDate, 'yyyy-MM-dd'),
          buildingId: createForm.buildingId,
          branchId: orgId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error ?? '作成に失敗しました');
      } else {
        setShowCreateProject(false);
        setCreateForm({ name: '', plan: '', startDate: undefined, dueDate: undefined, status: 'PLANNING', buildingId: '' });
        fetchProjects();
      }
    } catch {
      setCreateError('作成に失敗しました');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditProject = async () => {
    if (!editProject || !editForm.name.trim() || !editForm.startDate || !editForm.dueDate) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/projects/${editProject.projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          plan: editForm.plan.trim() || undefined,
          startDate: format(editForm.startDate, 'yyyy-MM-dd'),
          dueDate: format(editForm.dueDate, 'yyyy-MM-dd'),
          status: editForm.status,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? '更新に失敗しました');
      } else {
        setEditProject(null);
        fetchProjects();
      }
    } catch {
      setEditError('更新に失敗しました');
    } finally {
      setEditLoading(false);
    }
  };

  // --- User handlers ---

  const handleAddUser = async () => {
    if (!addUserForm.name.trim() || !addUserForm.email.trim() || !addUserForm.password.trim()) return;
    setAddUserLoading(true);
    setAddUserError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addUserForm, organizationId: orgId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddUserError(data.error ?? '作成に失敗しました');
      } else {
        setShowAddUser(false);
        setAddUserForm({ name: '', email: '', password: '', role: 'WORKER', organizationId: orgId });
        fetchUsers();
      }
    } catch {
      setAddUserError('作成に失敗しました');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!editUser || !editUserForm.name.trim() || !editUserForm.email.trim()) return;
    setEditUserLoading(true);
    setEditUserError(null);
    try {
      const res = await fetch(`/api/users/${editUser.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUserForm.name,
          email: editUserForm.email,
          role: editUserForm.role,
          organizationId: editUserForm.organizationId || orgId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditUserError(data.error ?? '更新に失敗しました');
      } else {
        setEditUser(null);
        fetchUsers();
      }
    } catch {
      setEditUserError('更新に失敗しました');
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleToggleUserActive = async (user: UserDto) => {
    if (user.isActive) {
      await fetch(`/api/users/${user.userId}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/users/${user.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
    }
    fetchUsers();
  };

  const buildingMap = Object.fromEntries(buildings.map((b) => [b.buildingId, b.name]));
  const orgMap = Object.fromEntries(orgs.map((o) => [o.organizationId, o.name]));

  const truncatePlan = (plan: string, maxLength = 30) => {
    const normalized = plan?.trim() ?? '';
    if (!normalized) return '-';
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">指摘管理ツール</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <Link href="/admin/organizations" className="hover:underline">支部管理</Link>
              {' / '}
              {org?.name ?? orgId}
            </p>
          </div>
          <AuthHeader />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">{org?.name ?? '...'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {org?.type === 'HEADQUARTERS' ? '本部' : '支部'} &bull; ユーザー数: {org?.userCount ?? 0}
          </p>
        </div>

        <Tabs defaultValue="projects">
          <TabsList className="mb-6">
            <TabsTrigger value="projects">プロジェクト</TabsTrigger>
            <TabsTrigger value="users">ユーザー</TabsTrigger>
          </TabsList>

          {/* Projects tab */}
          <TabsContent value="projects">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">プロジェクト一覧</h3>
              <Button
                onClick={() => {
                  setCreateForm({
                    name: '',
                    plan: '',
                    startDate: undefined,
                    dueDate: undefined,
                    status: 'PLANNING',
                    buildingId: buildings[0]?.buildingId ?? '',
                  });
                  setCreateError(null);
                  setShowCreateProject(true);
                }}
              >
                新規作成
              </Button>
            </div>

            {projectsLoading ? (
              <p className="text-muted-foreground text-sm">読み込み中...</p>
            ) : (
              <div className="rounded-lg border border-neutral-800 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[960px]">
                  <thead className="bg-neutral-900/60">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">プロジェクト名</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">計画</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">指摘件数</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">ステータス</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">開始日</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">完了予定日</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">進捗</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">建物</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {projects.map((project) => (
                      <tr
                        key={project.projectId}
                        className="hover:bg-neutral-900/30 transition-colors cursor-pointer"
                        onClick={() => router.push(`/projects/${project.projectId}/viewer`)}
                      >
                        <td className="px-4 py-3 font-medium">{project.name}</td>
                        <td className="px-4 py-3 text-muted-foreground" title={project.plan || undefined}>
                          {truncatePlan(project.plan)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{project.issueCount}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_VARIANTS[project.status] ?? 'secondary'}>
                            {STATUS_LABELS[project.status] ?? project.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(project.startDate).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(project.dueDate).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-neutral-700 overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${project.progressRate}%` }}
                              />
                            </div>
                            <span className="text-xs">{project.progressRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {buildingMap[project.buildingId] ?? project.buildingId}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/projects/${project.projectId}/viewer`} onClick={(e) => e.stopPropagation()}>
                                3Dビュー
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditProject(project);
                                setEditForm({
                                  name: project.name,
                                  plan: project.plan,
                                  startDate: project.startDate ? new Date(project.startDate) : undefined,
                                  dueDate: project.dueDate ? new Date(project.dueDate) : undefined,
                                  status: project.status,
                                });
                                setEditError(null);
                              }}
                            >
                              編集
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                          プロジェクトがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Users tab */}
          <TabsContent value="users">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">ユーザー一覧</h3>
              <Button
                onClick={() => {
                  setAddUserForm({ name: '', email: '', password: '', role: 'WORKER', organizationId: orgId });
                  setAddUserError(null);
                  setShowAddUser(true);
                }}
              >
                ユーザー追加
              </Button>
            </div>

            {usersLoading ? (
              <p className="text-muted-foreground text-sm">読み込み中...</p>
            ) : (
              <div className="rounded-lg border border-neutral-800 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-neutral-900/60">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">名前</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">メール</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">ロール</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">状態</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">作成日</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {users.map((user) => (
                      <tr key={user.userId} className="hover:bg-neutral-900/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{user.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">{ROLE_LABELS[user.role] ?? user.role}</td>
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
                                setEditUserForm({
                                  name: user.name,
                                  email: user.email,
                                  role: user.role,
                                  organizationId: user.organizationId ?? orgId,
                                });
                                setEditUserError(null);
                              }}
                            >
                              編集
                            </Button>
                            <Button
                              variant={user.isActive ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => handleToggleUserActive(user)}
                            >
                              {user.isActive ? '無効化' : '有効化'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          ユーザーが見つかりません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Project create modal */}
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プロジェクト新規作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">プロジェクト名</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="プロジェクト名を入力"
                disabled={createLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">計画内容</label>
              <textarea
                value={createForm.plan}
                onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                placeholder="計画内容を入力（任意）"
                disabled={createLoading}
                rows={3}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">開始日</label>
                <Popover open={createCalStartOpen} onOpenChange={setCreateCalStartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={createLoading}
                      className={cn('w-full justify-start text-left font-normal', !createForm.startDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {createForm.startDate ? format(createForm.startDate, 'yyyy/MM/dd') : '日付を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={createForm.startDate}
                      onSelect={(date) => { setCreateForm((f) => ({ ...f, startDate: date })); setCreateCalStartOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">完了予定日</label>
                <Popover open={createCalDueOpen} onOpenChange={setCreateCalDueOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={createLoading}
                      className={cn('w-full justify-start text-left font-normal', !createForm.dueDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {createForm.dueDate ? format(createForm.dueDate, 'yyyy/MM/dd') : '日付を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={createForm.dueDate}
                      onSelect={(date) => { setCreateForm((f) => ({ ...f, dueDate: date })); setCreateCalDueOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">建物</label>
              <select
                value={createForm.buildingId}
                onChange={(e) => setCreateForm((f) => ({ ...f, buildingId: e.target.value }))}
                disabled={createLoading}
                className={`${selectClass} w-full`}
              >
                <option value="">選択してください</option>
                {buildings.map((b) => (
                  <option key={b.buildingId} value={b.buildingId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {createError && <p className="text-destructive text-sm">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateProject(false)} disabled={createLoading}>
              キャンセル
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={
                createLoading ||
                !createForm.name.trim() ||
                !createForm.startDate ||
                !createForm.dueDate ||
                !createForm.buildingId
              }
            >
              {createLoading ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project edit modal */}
      <Dialog open={!!editProject} onOpenChange={(open) => { if (!open) setEditProject(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プロジェクト編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">プロジェクト名</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                disabled={editLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">計画内容</label>
              <textarea
                value={editForm.plan}
                onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                placeholder="計画内容を入力（任意）"
                disabled={editLoading}
                rows={3}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">開始日</label>
                <Popover open={editCalStartOpen} onOpenChange={setEditCalStartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={editLoading}
                      className={cn('w-full justify-start text-left font-normal', !editForm.startDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.startDate ? format(editForm.startDate, 'yyyy/MM/dd') : '日付を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editForm.startDate}
                      onSelect={(date) => { setEditForm((f) => ({ ...f, startDate: date })); setEditCalStartOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">完了予定日</label>
                <Popover open={editCalDueOpen} onOpenChange={setEditCalDueOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={editLoading}
                      className={cn('w-full justify-start text-left font-normal', !editForm.dueDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.dueDate ? format(editForm.dueDate, 'yyyy/MM/dd') : '日付を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editForm.dueDate}
                      onSelect={(date) => { setEditForm((f) => ({ ...f, dueDate: date })); setEditCalDueOpen(false); }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ステータス</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                disabled={editLoading}
                className={`${selectClass} w-full`}
              >
                <option value="PLANNING">計画中</option>
                <option value="ACTIVE">進行中</option>
                <option value="COMPLETED">完了</option>
              </select>
            </div>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)} disabled={editLoading}>
              キャンセル
            </Button>
            <Button
              onClick={handleEditProject}
              disabled={
                editLoading || !editForm.name.trim() || !editForm.startDate || !editForm.dueDate
              }
            >
              {editLoading ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User add modal */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">名前</label>
              <Input
                value={addUserForm.name}
                onChange={(e) => setAddUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="名前を入力"
                disabled={addUserLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">メールアドレス</label>
              <Input
                type="email"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                disabled={addUserLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">パスワード</label>
              <Input
                type="password"
                value={addUserForm.password}
                onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="パスワードを入力"
                disabled={addUserLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ロール</label>
              <select
                value={addUserForm.role}
                onChange={(e) => setAddUserForm((f) => ({ ...f, role: e.target.value }))}
                disabled={addUserLoading}
                className={`${selectClass} w-full`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {addUserError && <p className="text-destructive text-sm">{addUserError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)} disabled={addUserLoading}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={
                addUserLoading ||
                !addUserForm.name.trim() ||
                !addUserForm.email.trim() ||
                !addUserForm.password.trim()
              }
            >
              {addUserLoading ? '追加中...' : '追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User edit modal */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">名前</label>
              <Input
                value={editUserForm.name}
                onChange={(e) => setEditUserForm((f) => ({ ...f, name: e.target.value }))}
                disabled={editUserLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">メールアドレス</label>
              <Input
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm((f) => ({ ...f, email: e.target.value }))}
                disabled={editUserLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ロール</label>
              <select
                value={editUserForm.role}
                onChange={(e) => setEditUserForm((f) => ({ ...f, role: e.target.value }))}
                disabled={editUserLoading}
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
                value={editUserForm.organizationId}
                onChange={(e) => setEditUserForm((f) => ({ ...f, organizationId: e.target.value }))}
                disabled={editUserLoading}
                className={`${selectClass} w-full`}
              >
                <option value="">選択してください</option>
                {orgs.map((o) => (
                  <option key={o.organizationId} value={o.organizationId}>{o.name}</option>
                ))}
              </select>
            </div>
            {editUserError && <p className="text-destructive text-sm">{editUserError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={editUserLoading}>
              キャンセル
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={
                editUserLoading || !editUserForm.name.trim() || !editUserForm.email.trim()
              }
            >
              {editUserLoading ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
