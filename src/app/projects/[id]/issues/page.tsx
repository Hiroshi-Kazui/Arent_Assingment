'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthHeader } from '@/app/components/auth-header';
import { IssueDetailModal } from '@/app/components/issue-detail-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Project {
  projectId: string;
  name: string;
  buildingId: string;
  status: string;
}

interface Floor {
  floorId: string;
  name: string;
  floorNumber: number;
}

interface Issue {
  issueId: string;
  title: string;
  issueType?: string;
  status: 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED';
  dueDate: string;
  reportedBy: string;
  floorId?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  POINT_OUT: '未割当',
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  DONE: '完了',
  CONFIRMED: '承認済',
};

const STATUS_INLINE_STYLES: Record<string, React.CSSProperties> = {
  POINT_OUT: { backgroundColor: '#9E9E9E', color: '#fff', borderColor: 'transparent' },
  OPEN: { backgroundColor: '#1E88E5', color: '#fff', borderColor: 'transparent' },
  IN_PROGRESS: { backgroundColor: '#FDD835', color: '#333', borderColor: 'transparent' },
  DONE: { backgroundColor: '#43A047', color: '#fff', borderColor: 'transparent' },
  CONFIRMED: { backgroundColor: '#7B1FA2', color: '#fff', borderColor: 'transparent' },
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  quality: '品質不良',
  safety: '安全不備',
  construction: '施工不備',
  design: '設計変更',
  QUALITY: '品質不良',
  SAFETY: '安全不備',
  CONSTRUCTION: '施工不備',
  DESIGN: '設計変更',
};

const ALL_STATUSES = ['POINT_OUT', 'OPEN', 'IN_PROGRESS', 'DONE', 'CONFIRMED'] as const;

export default function IssuesListPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFloorId, setSelectedFloorId] = useState<string>('__all__');
  const [selectedStatus, setSelectedStatus] = useState<string>('__all__');
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);

  // Fetch project + floors
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error('プロジェクトの取得に失敗しました');
        const data: Project = await res.json();
        setProject(data);

        const floorsRes = await fetch(`/api/buildings/${data.buildingId}/floors`);
        if (floorsRes.ok) {
          const floorsData = await floorsRes.json();
          const floorsArr: Floor[] = floorsData.items ?? floorsData;
          setFloors(floorsArr.sort((a, b) => b.floorNumber - a.floorNumber));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    fetchProject();
  }, [id]);

  // Fetch issues with filters
  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedFloorId !== '__all__') params.set('floorId', selectedFloorId);
        if (selectedStatus !== '__all__') params.set('status', selectedStatus);
        const qs = params.toString();
        const url = `/api/projects/${id}/issues${qs ? `?${qs}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('指摘の取得に失敗しました');
        const data = await res.json();
        setIssues(data.items ?? data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, [id, selectedFloorId, selectedStatus]);

  const refreshIssues = async () => {
    const params = new URLSearchParams();
    if (selectedFloorId !== '__all__') params.set('floorId', selectedFloorId);
    if (selectedStatus !== '__all__') params.set('status', selectedStatus);
    const qs = params.toString();
    const url = `/api/projects/${id}/issues${qs ? `?${qs}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setIssues(data.items ?? data);
    }
  };

  const getFloorName = (floorId?: string) => {
    if (!floorId) return '-';
    return floors.find((f) => f.floorId === floorId)?.name ?? '-';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <Link href="/projects" className="hover:text-primary transition-colors shrink-0">
              プロジェクト一覧
            </Link>
            <span className="opacity-50">/</span>
            <span className="text-foreground/80 truncate">{project?.name ?? id}</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground shrink-0">指摘一覧</span>
          </div>
          <AuthHeader />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-lg font-semibold text-foreground flex-1">
            指摘一覧
            <Badge variant="secondary" className="ml-2 font-mono">{issues.length} 件</Badge>
          </h1>

          {/* Floor filter */}
          <Select value={selectedFloorId} onValueChange={setSelectedFloorId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="フロア" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全フロア</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f.floorId} value={f.floorId}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全ステータス</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 3D view link */}
          <Button
            variant="outline"
            onClick={() => {
              const url = selectedFloorId !== '__all__'
                ? `/projects/${id}/viewer?floorId=${selectedFloorId}`
                : `/projects/${id}/viewer`;
              router.push(url);
            }}
          >
            3Dビューで表示
          </Button>
        </div>

        {/* Issues table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
            <p className="text-muted-foreground text-sm">読み込み中...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground bg-muted/50 px-8 py-5 rounded-xl border">
              指摘が見つかりません
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-card">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3 bg-muted/30 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>タイトル</span>
              <span className="text-center w-20">種別</span>
              <span className="text-center w-16">フロア</span>
              <span className="text-center w-20">期限</span>
              <span className="text-center w-20">ステータス</span>
            </div>

            {/* Rows */}
            <div className="divide-y">
              {issues.map((issue) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDate = new Date(issue.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue =
                  issue.status !== 'DONE' &&
                  issue.status !== 'CONFIRMED' &&
                  dueDate.getTime() <= today.getTime();

                return (
                  <button
                    key={issue.issueId}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors group"
                    onClick={() => setDetailIssueId(issue.issueId)}
                  >
                    {/* Mobile layout */}
                    <div className="sm:hidden space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors line-clamp-2">
                          {issue.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] px-1.5 py-0"
                          style={STATUS_INLINE_STYLES[issue.status]}
                        >
                          {STATUS_LABELS[issue.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {issue.issueType && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                          </Badge>
                        )}
                        <span>{getFloorName(issue.floorId)}</span>
                        <span className={isOverdue ? 'text-destructive font-bold' : ''}>
                          {dueDate.toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                      <p className="text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors line-clamp-1">
                        {issue.title}
                      </p>
                      <div className="w-20 flex justify-center">
                        {issue.issueType ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                      <div className="w-16 text-center text-xs text-muted-foreground">
                        {getFloorName(issue.floorId)}
                      </div>
                      <div className={`w-20 text-center text-xs font-mono ${isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        {dueDate.toLocaleDateString('ja-JP')}
                      </div>
                      <div className="w-20 flex justify-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 w-full justify-center text-center"
                          style={STATUS_INLINE_STYLES[issue.status]}
                        >
                          {STATUS_LABELS[issue.status]}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <IssueDetailModal
        open={detailIssueId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailIssueId(null);
        }}
        issueId={detailIssueId ?? ''}
        projectId={id}
        onIssueUpdated={refreshIssues}
      />
    </div>
  );
}
