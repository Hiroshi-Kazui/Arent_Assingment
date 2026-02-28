'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApsViewer } from '@/app/components/viewer/aps-viewer';
import { IssueDetailModal } from '@/app/components/issue-detail-modal';
import { IssueMarkers, IssueMarker } from '@/app/components/viewer/issue-markers';
import { useFloorIsolation } from '@/app/components/viewer/use-floor-isolation';
import {
  useViewerInteraction,
  type ViewerHit,
} from '@/app/components/viewer/use-viewer-interaction';
import { ElementInfoPanel } from '@/app/components/viewer/element-info-panel';
import { Button } from '@/components/ui/button';
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
  reportedBy: number;
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
  quality: '品質不良',
  safety: '安全不備',
  construction: '施工不備',
  design: '設計変更',
};

const INVALID_MODEL_URNS = new Set([
  'YOUR_MODEL_URN_HERE',
  'your_model_urn',
  'default-model-urn',
]);

function isValidModelUrn(value: string | undefined | null): value is string {
  return !!value && !INVALID_MODEL_URNS.has(value.trim());
}

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
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null);

  // Issue form
  const [showForm, setShowForm] = useState(false);
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
  const [selectedWorldPosition, setSelectedWorldPosition] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIssueType, setFormIssueType] = useState('quality');
  const [formPhotoPhase, setFormPhotoPhase] = useState<'BEFORE' | 'AFTER'>('BEFORE');
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
            setFloors(floorsData.sort((a, b) => b.floorNumber - a.floorNumber));
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

  // マーカークリック → 詳細モーダル表示
  const openDetailModal = (issueId: string) => {
    setShowForm(false);
    setDetailIssueId(issueId);
  };

  const handleMarkerClick = (issueId: string) => {
    openDetailModal(issueId);
  };

  // 導線A: ダブルクリック/長押しで即時登録
  const handleQuickRegister = (hit: ViewerHit) => {
    setDetailIssueId(null);
    setSelectedDbId(hit.dbId);
    setSelectedWorldPosition(hit.worldPosition);
    setShowForm(true);
  };

  // 導線B: 情報パネルから登録
  const handleRegisterFromPanel = (hit: ViewerHit) => {
    setDetailIssueId(null);
    setSelectedDbId(hit.dbId);
    setSelectedWorldPosition(hit.worldPosition);
    setShowForm(true);
    clearSelection();
  };

  // フォーム送信
  const handleSubmitIssue = async () => {
    if (!formTitle.trim() || !formDescription.trim()) {
      alert('タイトルと説明を入力してください');
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
      if (selectedDbId !== null) {
        fd.append('locationType', 'dbId');
        fd.append('dbId', String(selectedDbId));
        if (selectedWorldPosition) {
          fd.append('worldPositionX', String(selectedWorldPosition.x));
          fd.append('worldPositionY', String(selectedWorldPosition.y));
          fd.append('worldPositionZ', String(selectedWorldPosition.z));
        }
      } else {
        fd.append('locationType', 'worldPosition');
        fd.append('worldPositionX', String(selectedWorldPosition?.x ?? 0));
        fd.append('worldPositionY', String(selectedWorldPosition?.y ?? 0));
        fd.append('worldPositionZ', String(selectedWorldPosition?.z ?? 0));
      }
      if (formFiles && formFiles.length > 0) {
        fd.append('photoPhase', formPhotoPhase);
        for (const file of Array.from(formFiles)) {
          fd.append('files', file);
        }
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
      setFormPhotoPhase('BEFORE');
      setFormFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
      setSelectedDbId(null);
      setSelectedWorldPosition(null);
      clearSelection();

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
  const selectedFloorNumber = currentFloor?.floorNumber ?? null;
  const {
    isDbIdOnSelectedFloor,
    floorMappingReady,
    floorMappingError,
    floorsWithElements,
  } =
    useFloorIsolation({
      viewer,
      selectedFloorNumber,
      floors,
    });
  const availableFloors = useMemo(
    () =>
      floorMappingReady
        ? floors.filter((floor) => floorsWithElements.has(floor.floorNumber))
        : [],
    [floorMappingReady, floors, floorsWithElements]
  );
  const { selectedElement, clearSelection } = useViewerInteraction({
    viewer,
    viewerContainer,
    dbIdFilter: isDbIdOnSelectedFloor,
    onQuickRegister: handleQuickRegister,
  });
  const modelUrn = isValidModelUrn(project?.building.modelUrn)
    ? project.building.modelUrn
    : isValidModelUrn(process.env.NEXT_PUBLIC_APS_MODEL_URN)
      ? process.env.NEXT_PUBLIC_APS_MODEL_URN
      : '';

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
              onClick={() => openDetailModal(issue.issueId)}
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

  useEffect(() => {
    if (!floorMappingReady || !selectedFloorId) {
      return;
    }

    const current = floors.find((floor) => floor.floorId === selectedFloorId);
    if (current && !floorsWithElements.has(current.floorNumber)) {
      handleFloorChange('');
    }
  }, [floorMappingReady, selectedFloorId, floors, floorsWithElements]);

  return (
    <div className="flex flex-col h-screen bg-background pb-[60px] sm:pb-0">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3 flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 shadow-sm z-10 w-full overflow-x-auto min-h-[56px]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 whitespace-nowrap">
          <Link href="/projects" className="hover:text-primary transition-colors">
            プロジェクト一覧
          </Link>
          <span className="opacity-50">/</span>
          <span className="text-foreground/80">{project?.name ?? id}</span>
        </div>

        <Button
          onClick={() => {
            setSelectedDbId(null);
            setSelectedWorldPosition(null);
            setShowForm(true);
          }}
          className="sm:ml-auto shrink-0 font-medium hidden sm:flex"
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
          ) : !modelUrn ? (
            <div className="flex items-center justify-center h-full p-4">
              <p className="text-destructive text-center">
                3DモデルURNが未設定です。`APS_MODEL_URN` を設定し、DBの Building.model_urn を更新してください。
              </p>
            </div>
          ) : (
            <ApsViewer
              modelUrn={modelUrn}
              onViewerReady={setViewer}
              onContainerReady={setViewerContainer}
            />
          )}

          {selectedFloorNumber !== null && viewer && !floorMappingReady && (
            <div className="absolute top-3 right-3 z-20 rounded-md bg-background/90 border px-3 py-1 text-xs text-muted-foreground">
              フロア要素を解析中...
            </div>
          )}

          {selectedFloorNumber !== null && floorMappingError && (
            <div className="absolute top-3 left-3 z-20 rounded-md bg-amber-50 border border-amber-200 px-3 py-1 text-xs text-amber-800">
              フロア情報の解析に失敗したため、全要素を選択可能にしています
            </div>
          )}

          {floorMappingReady && availableFloors.length > 0 && (
            <div className="absolute bottom-4 left-4 z-20 rounded-lg border bg-background/90 shadow-sm p-1.5 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleFloorChange('')}
                className={`px-3 py-1.5 text-xs rounded-md text-left transition-colors ${
                  !selectedFloorId
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                全フロア
              </button>
              {availableFloors.map((floor) => (
                <button
                  key={floor.floorId}
                  type="button"
                  onClick={() => handleFloorChange(floor.floorId)}
                  className={`px-3 py-1.5 text-xs rounded-md text-left transition-colors ${
                    selectedFloorId === floor.floorId
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
            </div>
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

          {viewer && selectedElement && (
            <ElementInfoPanel
              viewer={viewer}
              element={selectedElement}
              onRegister={handleRegisterFromPanel}
              onClose={clearSelection}
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
        onClick={() => {
          setSelectedDbId(null);
          setSelectedWorldPosition(null);
          setShowForm(true);
        }}
      >
        <Plus className="w-7 h-7" />
      </Button>

      {/* Issue registration modal */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (submitting) {
            return;
          }
          setShowForm(open);
          if (!open) {
            setSelectedDbId(null);
            setSelectedWorldPosition(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col max-h-[90vh] p-0 gap-0 border-border">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
            <DialogTitle>新しい指摘を追加</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            <div className="space-y-5 px-1">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  指摘タイトル <span className="text-destructive">*</span>
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
                  指摘内容 <span className="text-destructive">*</span>
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

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  指摘種別 <span className="text-destructive">*</span>
                </label>
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
                <label className="block text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">写真</label>
                <Select
                  value={formPhotoPhase}
                  onValueChange={(value) => setFormPhotoPhase(value as 'BEFORE' | 'AFTER')}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-full mb-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BEFORE">是正前</SelectItem>
                    <SelectItem value="AFTER">是正後</SelectItem>
                  </SelectContent>
                </Select>
                <div className="border rounded-md p-2 focus-within:ring-1 focus-within:ring-ring bg-background">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
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
              onClick={() => {
                setShowForm(false);
                setSelectedDbId(null);
                setSelectedWorldPosition(null);
              }}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmitIssue}
              disabled={submitting}
            >
              {submitting ? '作成中...' : '作成する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
