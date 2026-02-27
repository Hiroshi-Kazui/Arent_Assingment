'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string; issueId: string }>;
}

interface Photo {
  photoId: string;
  blobKey: string;
  photoPhase: 'BEFORE' | 'AFTER';
  uploadedAt: string;
}

interface IssueDetail {
  issueId: string;
  projectId: string;
  title: string;
  description: string;
  issueType?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  priority: string;
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  floorId: string;
  reportedBy?: string;
  createdAt: string;
  photos: Photo[];
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

const ISSUE_TYPE_LABELS: Record<string, string> = {
  quality: '品質',
  safety: '安全',
  construction: '施工',
  design: '設計',
};

// 現在ステータスから遷移可能なステータス一覧
const TRANSITIONS: Record<string, Array<{ status: string; label: string }>> = {
  OPEN: [{ status: 'IN_PROGRESS', label: '対応開始' }],
  IN_PROGRESS: [
    { status: 'DONE', label: '完了にする' },
    { status: 'OPEN', label: '差し戻し' },
  ],
  DONE: [{ status: 'IN_PROGRESS', label: '再対応' }],
};

const TRANSITION_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  DONE: 'bg-green-600 hover:bg-green-700 text-white',
  OPEN: 'bg-gray-500 hover:bg-gray-600 text-white',
};

export default function IssueDetailPage({ params }: PageProps) {
  const { id, issueId: issueIdParam } = use(params);
  const router = useRouter();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  // Photo upload
  const [photoPhase, setPhotoPhase] = useState<'BEFORE' | 'AFTER'>('AFTER');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchIssue = async () => {
    const res = await fetch(`/api/projects/${id}/issues/${issueIdParam}`);
    if (!res.ok) throw new Error(`Failed to fetch issue (${res.status})`);
    return res.json() as Promise<IssueDetail>;
  };

  const fetchPhotoUrls = async (photos: Photo[]) => {
    const urls: Record<string, string> = {};
    await Promise.all(
      photos.map(async (photo) => {
        try {
          const res = await fetch(`/api/photos/${photo.photoId}/url`);
          if (res.ok) {
            const data = await res.json();
            urls[photo.photoId] = data.url;
          }
        } catch {
          // 個別のURL取得失敗は無視
        }
      })
    );
    return urls;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchIssue();
        setIssue(data);
        if (data.photos.length > 0) {
          const urls = await fetchPhotoUrls(data.photos);
          setPhotoUrls(urls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, issueIdParam]);

  const handleStatusChange = async (newStatus: string) => {
    if (!issue) return;
    try {
      setStatusUpdating(true);
      const res = await fetch(
        `/api/projects/${id}/issues/${issueIdParam}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }
      // 再取得
      const updated = await fetchIssue();
      setIssue(updated);
    } catch (err) {
      alert('ステータス更新エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!uploadFile) {
      alert('ファイルを選択してください');
      return;
    }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('photoPhase', photoPhase);

      const res = await fetch(
        `/api/projects/${id}/issues/${issueIdParam}/photos`,
        { method: 'POST', body: fd }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }

      // リセット & 再取得
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const updated = await fetchIssue();
      setIssue(updated);
      const urls = await fetchPhotoUrls(updated.photos);
      setPhotoUrls(urls);
    } catch (err) {
      alert('アップロードエラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-8">
        <p className="text-red-600">エラー: {error ?? 'Issue not found'}</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
          ← 戻る
        </button>
      </div>
    );
  }

  const beforePhotos = issue.photos.filter((p) => p.photoPhase === 'BEFORE');
  const afterPhotos = issue.photos.filter((p) => p.photoPhase === 'AFTER');
  const transitions = TRANSITIONS[issue.status] ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-blue-600">
            プロジェクト一覧
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${id}/viewer`}
            className="hover:text-blue-600"
          >
            3Dビュー
          </Link>
          <span>/</span>
          <span className="text-gray-900">指摘詳細</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{issue.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[issue.status]}`}
              >
                {STATUS_LABELS[issue.status]}
              </span>
              {issue.issueType && (
                <span className="text-xs text-gray-500">
                  {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                </span>
              )}
            </div>
          </div>

          {/* 3Dで見るボタン */}
          {issue.dbId && (
            <Link
              href={`/projects/${id}/viewer?floorId=${issue.floorId}&highlightId=${issue.issueId}`}
              className="shrink-0 text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
            >
              3Dで見る
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* 基本情報 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500 mb-1">説明</p>
              <p className="text-gray-900 whitespace-pre-wrap">{issue.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">報告者</p>
                <p className="text-gray-900">{issue.reportedBy ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">作成日時</p>
                <p className="text-gray-900">
                  {new Date(issue.createdAt).toLocaleString('ja-JP')}
                </p>
              </div>
              <div>
                <p className="text-gray-500">位置種別</p>
                <p className="text-gray-900">{issue.locationType}</p>
              </div>
              {issue.dbId && (
                <div>
                  <p className="text-gray-500">部材 ID (dbId)</p>
                  <p className="text-gray-900 font-mono">{issue.dbId}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ステータス変更 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">ステータス変更</h2>
          {transitions.length === 0 ? (
            <p className="text-sm text-gray-500">これ以上遷移できません</p>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {transitions.map((t) => (
                <button
                  key={t.status}
                  onClick={() => handleStatusChange(t.status)}
                  disabled={statusUpdating}
                  className={`px-4 py-2 text-sm rounded font-medium transition-colors disabled:opacity-50 ${
                    TRANSITION_COLORS[t.status]
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 写真一覧 */}
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            写真 ({issue.photos.length} 枚)
          </h2>

          {beforePhotos.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">是正前</p>
              <div className="flex flex-wrap gap-3">
                {beforePhotos.map((photo) => (
                  <PhotoCard key={photo.photoId} photo={photo} url={photoUrls[photo.photoId]} />
                ))}
              </div>
            </div>
          )}

          {afterPhotos.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">是正後</p>
              <div className="flex flex-wrap gap-3">
                {afterPhotos.map((photo) => (
                  <PhotoCard key={photo.photoId} photo={photo} url={photoUrls[photo.photoId]} />
                ))}
              </div>
            </div>
          )}

          {issue.photos.length === 0 && (
            <p className="text-sm text-gray-400">写真なし</p>
          )}

          {/* 写真追加 */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-3">写真を追加</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">フェーズ</label>
                <select
                  value={photoPhase}
                  onChange={(e) => setPhotoPhase(e.target.value as 'BEFORE' | 'AFTER')}
                  disabled={uploading}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                >
                  <option value="BEFORE">是正前</option>
                  <option value="AFTER">是正後</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">ファイル</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                  className="text-sm text-gray-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:cursor-pointer disabled:opacity-60"
                />
              </div>

              <button
                onClick={handlePhotoUpload}
                disabled={uploading || !uploadFile}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'アップロード中...' : 'アップロード'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PhotoCard({ photo, url }: { photo: Photo; url?: string }) {
  return (
    <div className="w-36 h-28 rounded border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
      {url ? (
        <img src={url} alt={`Photo ${photo.photoId}`} className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs text-gray-400">読み込み中...</span>
      )}
    </div>
  );
}
