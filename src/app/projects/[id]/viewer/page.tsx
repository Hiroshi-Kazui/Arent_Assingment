'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApsViewer } from '@/app/components/viewer/aps-viewer';
import { IssueMarkers, IssueMarker } from '@/app/components/viewer/issue-markers';

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

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800',
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
    setSelectedFloorId(fid);
    router.replace(`/projects/${id}/viewer?floorId=${fid}`);
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
    if (!selectedFloorId) {
      alert('フロアを選択してください');
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`/api/projects/${id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floorId: selectedFloorId,
          title: formTitle,
          description: formDescription,
          issueType: formIssueType,
          locationType: 'dbId',
          dbId: selectedDbId !== null ? String(selectedDbId) : undefined,
          reportedBy: formReportedBy || 'unknown',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }

      const { issueId } = await res.json();

      // 写真アップロード（Beforeフェーズ）
      if (formFiles && formFiles.length > 0) {
        for (const file of Array.from(formFiles)) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('photoPhase', 'BEFORE');
          await fetch(`/api/projects/${id}/issues/${issueId}/photos`, {
            method: 'POST',
            body: fd,
          });
        }
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/projects" className="hover:text-blue-600">
            プロジェクト一覧
          </Link>
          <span>/</span>
          <Link href={`/projects/${id}/floors`} className="hover:text-blue-600">
            {project?.name ?? id}
          </Link>
          <span>/</span>
          <span className="text-gray-900">3Dビュー</span>
        </div>

        {/* フロア選択 */}
        {floors.length > 0 && (
          <select
            value={selectedFloorId ?? ''}
            onChange={(e) => handleFloorChange(e.target.value)}
            className="ml-auto text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">フロアを選択</option>
            {floors.map((f) => (
              <option key={f.floorId} value={f.floorId}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowForm(true)}
          className="ml-2 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
        >
          + 新規指摘
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* 3D Viewer (70%) */}
        <div className="relative flex-1" style={{ minWidth: 0 }}>
          {error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-600">{error}</p>
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

        {/* Issue list panel (30%) */}
        <aside className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-900">
              指摘一覧
              {currentFloor && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {currentFloor.name}
                </span>
              )}
            </h2>
            <span className="text-xs text-gray-500">{issues.length} 件</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {dataLoading ? (
              <p className="text-center text-gray-400 py-8 text-sm">読み込み中...</p>
            ) : issues.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">指摘なし</p>
            ) : (
              issues.map((issue) => (
                <button
                  key={issue.issueId}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                    hoveredIssueId === issue.issueId ? 'bg-blue-50' : ''
                  }`}
                  onMouseEnter={() => setHoveredIssueId(issue.issueId)}
                  onMouseLeave={() => setHoveredIssueId(null)}
                  onClick={() =>
                    router.push(`/projects/${id}/issues/${issue.issueId}`)
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                    <span
                      className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        STATUS_COLORS[issue.status]
                      }`}
                    >
                      {STATUS_LABELS[issue.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {issue.issueType && (
                      <span>{ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}</span>
                    )}
                    <span>{new Date(issue.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Issue registration modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => !submitting && setShowForm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">新しい指摘を追加</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {selectedDbId !== null && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">部材 ID (dbId)</label>
                  <input
                    type="text"
                    value={selectedDbId}
                    readOnly
                    className="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 text-sm text-gray-700"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="指摘のタイトルを入力"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={submitting}
                  placeholder="指摘の詳細を入力"
                  rows={4}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
                  <select
                    value={formIssueType}
                    onChange={(e) => setFormIssueType(e.target.value)}
                    disabled={submitting}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ISSUE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">報告者</label>
                  <input
                    type="text"
                    value={formReportedBy}
                    onChange={(e) => setFormReportedBy(e.target.value)}
                    disabled={submitting}
                    placeholder="氏名"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  写真（是正前）
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => setFormFiles(e.target.files)}
                  disabled={submitting}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:cursor-pointer disabled:opacity-60"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitIssue}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
