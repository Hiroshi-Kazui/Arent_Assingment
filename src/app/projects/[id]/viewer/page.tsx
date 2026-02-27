'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApsViewer } from '@/app/components/viewer/aps-viewer';
import { IssueMarkers, IssueMarker } from '@/app/components/viewer/issue-markers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Plus, ListIcon } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Issue {
  issueId: string;
  title: string;
  issueType?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  reportedBy?: string;
  createdAt: string;
}

interface Project {
  projectId: string;
  name: string;
  buildingId: string;
  status: string;
  building: {
    buildingId: string;
    name: string;
    address: string;
    modelUrn: string;
  };
}

interface Floor {
  floorId: string;
  name: string;
  floorNumber: number;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  DONE: '完了',
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: 'destructive',
  IN_PROGRESS: 'default',
  DONE: 'secondary',
};

const ISSUE_TYPES = ['quality', 'safety', 'construction', 'design'];
const ISSUE_TYPE_LABELS: Record<string, string> = {
  quality: '品質',
  safety: '安全',
  construction: '施工',
  design: '設計',
};

export default function ViewerPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const floorId = searchParams.get('floorId') ?? undefined;
  const highlightId = searchParams.get('highlightId');

  const [project, setProject] = useState<Project | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | undefined>(floorId);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer state
  const [viewerContainer, setViewerContainer] = useState<HTMLElement | null>(null);
  const [viewer, setViewer] = useState<Autodesk.Viewing.GuiViewer3D | null>(null);

  // Hover highlight state (bidirectional)
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);

  // Issue form
  const [showForm, setShowForm] = useState(false);
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIssueType, setFormIssueType] = useState('quality');
  const [formReportedBy, setFormReportedBy] = useState('');
  const [formFiles, setFormFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初期データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const issuesUrl = selectedFloorId
          ? `/api/projects/${id}/issues?floorId=${selectedFloorId}`
          : `/api/projects/${id}/issues`;
        const projectRes = await fetch(`/api/projects/${id}`);
        if (projectRes.ok) {
          const projectData: Project = await projectRes.json();
          setProject(projectData);

          // フロア一覧取得
          const floorsRes = await fetch(
            `/api/buildings/${projectData.buildingId}/floors`
          );
          if (floorsRes.ok) {
            const floorsData: Floor[] = await floorsRes.json();
            setFloors(floorsData.sort((a, b) => a.floorNumber - b.floorNumber));
          }
        }

        // 指摘一覧取得
        const issuesRes = await fetch(issuesUrl);
        if (issuesRes.ok) {
          const issuesData: Issue[] = await issuesRes.json();
          setIssues(issuesData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, [id, selectedFloorId]);

  useEffect(() => {
    if (!viewer || !highlightId || issues.length === 0) {
      return;
    }

    const target = issues.find((issue) => issue.issueId === highlightId);
    if (!target?.dbId) {
      return;
    }

    const dbId = Number.parseInt(target.dbId, 10);
    if (Number.isNaN(dbId)) {
      return;
    }

    try {
      (viewer as any).select([dbId]);
      (viewer as any).fitToView([dbId]);
      setHoveredIssueId(target.issueId);
    } catch (err) {
      console.error('Failed to focus issue in viewer:', err);
    }
  }, [viewer, highlightId, issues]);

  // フロア切替
  const handleFloorChange = (fid: string) => {
    const nextFloorId = fid || undefined;
    setSelectedFloorId(nextFloorId);
    if (nextFloorId) {
      router.replace(`/projects/${id}/viewer?floorId=${nextFloorId}`);
      return;
    }
    router.replace(`/projects/${id}/viewer`);
  };

  // 指摘一覧リフレッシュ
  const refreshIssues = async () => {
    const url = selectedFloorId
      ? `/api/projects/${id}/issues?floorId=${selectedFloorId}`
      : `/api/projects/${id}/issues`;
    const res = await fetch(url);
    if (res.ok) setIssues(await res.json());
  };

  // マーカークリック → 詳細画面へ
  const handleMarkerClick = (issueId: string) => {
    router.push(`/projects/${id}/issues/${issueId}`);
  };

  // ダブルクリックで dbId 取得 → フォームを開く
  const handleDbIdSelected = (dbId: number) => {
    setSelectedDbId(dbId);
    setShowForm(true);
  };

  // フォーム送信
  const handleSubmitIssue = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      alert('タイトルと説明を入力してください');
      return;
    }
    if (!formFiles || formFiles.length === 0) {
      alert('指摘写真（是正前）を1枚以上選択してください');
      return;
    }
    if (!selectedFloorId) {
      alert('フロアを選択してください');
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('floorId', selectedFloorId);
      fd.append('title', formTitle);
      fd.append('description', formDescription);
      fd.append('issueType', formIssueType);
      fd.append('locationType', 'dbId');
      if (selectedDbId !== null) {
        fd.append('dbId', String(selectedDbId));
      }
      fd.append('reportedBy', formReportedBy || 'unknown');
      for (const file of Array.from(formFiles)) {
        fd.append('files', file);
      }

      const res = await fetch(`/api/projects/${id}/issues`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }

      // フォームリセット
      setFormTitle('');
      setFormDescription('');
      setFormIssueType('quality');
      setFormReportedBy('');
      setFormFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
      setSelectedDbId(null);

      await refreshIssues();
    } catch (err) {
      alert('エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  // IssueMarker 用データ変換
  const markers: IssueMarker[] = issues.map((issue) => ({
    issueId: issue.issueId,
    title: issue.title,
    status: issue.status,
    dbId: issue.dbId ? parseInt(issue.dbId, 10) : undefined,
    worldPosition:
      issue.locationType === 'worldPosition'
        ? {
          x: issue.worldPositionX ?? 0,
          y: issue.worldPositionY ?? 0,
          z: issue.worldPositionZ ?? 0,
        }
        : undefined,
    highlighted: hoveredIssueId === issue.issueId,
  }));

  const currentFloor = floors.find((f) => f.floorId === selectedFloorId);
  const modelUrn =
    project?.building.modelUrn ??
    process.env.NEXT_PUBLIC_APS_MODEL_URN ??
    'YOUR_MODEL_URN_HERE';

  // 指摘一覧コンテンツ（PCとモバイルで共有）
  const issueListContent = (
    <ScrollArea className="flex-1">
      {dataLoading ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">読み込み中...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center h-full">
          <p className="text-muted-foreground text-sm bg-muted/50 px-6 py-4 rounded-xl border">指摘が見つかりません</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {issues.map((issue) => (
            <button
              key={issue.issueId}
              className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors group min-h-[64px] ${hoveredIssueId === issue.issueId ? 'bg-muted border-l-4 border-l-primary pl-3' : 'border-l-4 border-l-transparent'
                }`}
              onMouseEnter={() => setHoveredIssueId(issue.issueId)}
              onMouseLeave={() => setHoveredIssueId(null)}
              onClick={() =>
                router.push(`/projects/${id}/issues/${issue.issueId}`)
              }
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className={`text-sm font-medium transition-colors line-clamp-2 pr-2 ${hoveredIssueId === issue.issueId ? 'text-primary' : 'text-foreground/90 group-hover:text-primary'}`}>{issue.title}</p>
                <Badge variant={STATUS_COLORS[issue.status] ?? 'outline'} className="shrink-0 text-[10px] whitespace-nowrap">
                  {STATUS_LABELS[issue.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                {issue.issueType && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">{ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}</Badge>
                )}
                <span>{new Date(issue.createdAt).toLocaleDateString('ja-JP')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-screen bg-background pb-[60px] sm:pb-0">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 shadow-sm z-10 w-full overflow-x-auto min-h-[56px]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 whitespace-nowrap">
          <Link href="/projects" className="hover:text-primary transition-colors">
            プロジェクト一覧
          </Link>
          <span className="opacity-50">/</span>
          <Link href={`/projects/${id}/floors`} className="hover:text-primary transition-colors">
            {project?.name ?? id}
          </Link>
          <span className="opacity-50">/</span>
          <span className="text-foreground/80">3Dビュー</span>
        </div>

        {/* フロア選択 */}
        {floors.length > 0 && (
          <div className="sm:ml-auto w-full sm:w-56 shrink-0">
            <Select
              value={selectedFloorId ?? '__ALL_FLOORS__'}
              onValueChange={(value) =>
                handleFloorChange(value === '__ALL_FLOORS__' ? '' : value)
              }
            >
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="フロアを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL_FLOORS__">フロアを選択</SelectItem>
                {floors.map((f) => (
                  <SelectItem key={f.floorId} value={f.floorId}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={() => setShowForm(true)}
          className="ml-2 shrink-0 font-medium hidden sm:flex"
        >
          + 新規指摘
        </Button>
      </header>

      {/* Main content */}
      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden relative">
        {/* 3D Viewer (Responsive: Full width mobile, flex-1 desktop) */}
        <div className="relative h-[50vh] sm:h-auto sm:flex-1 bg-background order-1 sm:order-none" style={{ minWidth: 0 }}>
          {error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            <ApsViewer
              modelUrn={modelUrn}
              onDbIdSelected={handleDbIdSelected}
              onMarkerClick={handleMarkerClick}
              onViewerReady={setViewer}
              onContainerReady={setViewerContainer}
            />
          )}

          {viewerContainer && viewer && (
            <IssueMarkers
              markers={markers}
              viewerContainer={viewerContainer}
              viewer={viewer}
              onMarkerClick={handleMarkerClick}
              hoveredIssueId={hoveredIssueId}
              onMarkerHover={setHoveredIssueId}
            />
          )}
        </div>

        {/* Issue list panel (PC: Side panel, Mobile: Hidden) */}
        <aside className="hidden sm:flex w-80 xl:w-96 shrink-0 bg-background border-l flex-col overflow-hidden shadow-none z-10">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-card shrink-0">
            <h2 className="font-semibold text-sm text-foreground flex items-center">
              指摘一覧
              {currentFloor && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {currentFloor.name}
                </Badge>
              )}
            </h2>
            <Badge variant="secondary">{issues.length} 件</Badge>
          </div>
          {issueListContent}
        </aside>
      </div>

      {/* Mobile Drawer (Bottom Sheet) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex justify-between items-center p-2 z-40 pb-safe">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" className="w-full h-12 flex justify-center items-center gap-2 rounded-xl border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary">
              <ListIcon className="w-5 h-5" />
              <span className="font-medium">指摘一覧を開く ({issues.length})</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent className="h-[85vh] bg-background">
            <DrawerHeader className="border-b pb-4 shrink-0">
              <DrawerTitle className="flex justify-between items-center text-base">
                <span>指摘一覧</span>
                <Badge variant="secondary">{issues.length} 件</Badge>
              </DrawerTitle>
              {currentFloor && (
                <DrawerDescription className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="font-normal">{currentFloor.name}</Badge>
                </DrawerDescription>
              )}
            </DrawerHeader>
            {issueListContent}
          </DrawerContent>
        </Drawer>
      </div>

      {/* Mobile FAB */}
      <Button
        className="sm:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg z-40 flex items-center justify-center p-0"
        onClick={() => setShowForm(true)}
      >
        <Plus className="w-7 h-7" />
      </Button>

      {/* Issue registration modal */}
      <Dialog open={showForm} onOpenChange={(open) => !submitting && setShowForm(open)}>
        <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col max-h-[90vh] p-0 gap-0 border-border">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
            <DialogTitle>新しい指摘を追加</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-5 px-1">
              {selectedDbId !== null && (
                <div className="bg-muted/50 p-3 rounded-md border">
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">部材 ID (dbId)</label>
                  <Input
                    type="text"
                    value={selectedDbId}
                    readOnly
                    className="w-full bg-transparent border-0 text-foreground font-mono text-sm focus-visible:ring-0 p-0 h-auto"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  タイトル <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="指摘のタイトルを入力"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  説明 <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={submitting}
                  placeholder="指摘の詳細を入力"
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">種別</label>
                  <Select
                    value={formIssueType}
                    onValueChange={setFormIssueType}
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ISSUE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">報告者</label>
                  <Input
                    type="text"
                    value={formReportedBy}
                    onChange={(e) => setFormReportedBy(e.target.value)}
                    disabled={submitting}
                    placeholder="氏名を入力"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  写真（是正前） <span className="text-destructive">*</span>
                </label>
                <div className="border rounded-md p-2 focus-within:ring-1 focus-within:ring-ring bg-background">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    required
                    ref={fileInputRef}
                    onChange={(e) => setFormFiles(e.target.files)}
                    disabled={submitting}
                    className="border-0 p-0 h-auto file:bg-secondary file:text-secondary-foreground file:border-0 file:rounded-md file:mr-4 file:px-3 file:py-1 cursor-pointer w-full text-foreground"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-4 border-t bg-muted/20 shrink-0 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmitIssue}
              disabled={submitting || !formFiles || formFiles.length === 0}
            >
              {submitting ? '作成中...' : '作成する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
