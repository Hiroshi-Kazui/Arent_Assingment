'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: 'destructive',
  IN_PROGRESS: 'default',
  DONE: 'secondary',
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

const TRANSITION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  IN_PROGRESS: 'default',
  DONE: 'secondary',
  OPEN: 'outline',
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
  const [beforeUploadFile, setBeforeUploadFile] = useState<File | null>(null);
  const [afterUploadFile, setAfterUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const beforeFileInputRef = useRef<HTMLInputElement>(null);
  const afterFileInputRef = useRef<HTMLInputElement>(null);

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
    if (
      newStatus === 'DONE' &&
      issue.photos.filter((p) => p.photoPhase === 'AFTER').length === 0
    ) {
      alert('完了報告には是正後写真が1枚以上必要です');
      return;
    }
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

  const handlePhotoUpload = async (
    phase: 'BEFORE' | 'AFTER',
    file: File | null
  ) => {
    if (!file) {
      alert('ファイルを選択してください');
      return;
    }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('photoPhase', phase);

      const res = await fetch(
        `/api/projects/${id}/issues/${issueIdParam}/photos`,
        { method: 'POST', body: fd }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }

      // リセット & 再取得
      if (phase === 'BEFORE') {
        setBeforeUploadFile(null);
        if (beforeFileInputRef.current) beforeFileInputRef.current.value = '';
      } else {
        setAfterUploadFile(null);
        if (afterFileInputRef.current) afterFileInputRef.current.value = '';
      }

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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-8 bg-background min-h-screen">
        <p className="text-destructive">エラー: {error ?? 'Issue not found'}</p>
        <button onClick={() => router.back()} className="mt-4 text-primary hover:underline">
          ← 戻る
        </button>
      </div>
    );
  }

  const beforePhotos = issue.photos.filter((p) => p.photoPhase === 'BEFORE');
  const afterPhotos = issue.photos.filter((p) => p.photoPhase === 'AFTER');
  const transitions = TRANSITIONS[issue.status] ?? [];

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="bg-card border-b px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 overflow-x-auto whitespace-nowrap pb-1">
          <Link href="/projects" className="hover:text-primary transition-colors">
            プロジェクト一覧
          </Link>
          <span className="opacity-50">/</span>
          <Link
            href={`/projects/${id}/viewer`}
            className="hover:text-primary transition-colors"
          >
            3Dビュー
          </Link>
          <span className="opacity-50">/</span>
          <span className="text-foreground/80">指摘詳細</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground break-words">{issue.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Badge variant={STATUS_COLORS[issue.status] ?? 'outline'} className="px-2.5 py-1 text-xs">
                {STATUS_LABELS[issue.status]}
              </Badge>
              {issue.issueType && (
                <Badge variant="outline" className="px-2.5 py-1 text-xs">
                  {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                </Badge>
              )}
            </div>
          </div>

          {/* 3Dで見るボタン */}
          {issue.dbId && (
            <Button asChild className="shrink-0 w-full sm:w-auto font-medium shadow-sm min-h-[44px]">
              <Link
                href={`/projects/${id}/viewer?floorId=${issue.floorId}&highlightId=${issue.issueId}`}
              >
                3Dで見る
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* 基本情報 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-sm font-semibold text-muted-foreground">基本情報</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6 text-sm">
              <div>
                <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">説明</p>
                <p className="text-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-md border leading-relaxed">{issue.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 bg-muted/10 p-4 sm:p-5 rounded-md border">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">報告者</p>
                  <p className="text-foreground font-medium">{issue.reportedBy ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">作成日時</p>
                  <p className="text-foreground font-medium">
                    {new Date(issue.createdAt).toLocaleString('ja-JP')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">位置種別</p>
                  <p className="text-foreground font-medium">{issue.locationType}</p>
                </div>
                {issue.dbId && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">部材 ID (dbId)</p>
                    <Badge variant="secondary" className="font-mono mt-1">{issue.dbId}</Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ステータス変更 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-sm font-semibold text-muted-foreground">ステータス変更</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs
              value={issue.status}
              onValueChange={(val) => {
                if (val !== issue.status) handleStatusChange(val);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 h-12 p-1">
                <TabsTrigger
                  value="OPEN"
                  disabled={statusUpdating || (!transitions.some(t => t.status === 'OPEN') && issue.status !== 'OPEN')}
                  className="text-xs sm:text-sm"
                >
                  未対応
                </TabsTrigger>
                <TabsTrigger
                  value="IN_PROGRESS"
                  disabled={statusUpdating || (!transitions.some(t => t.status === 'IN_PROGRESS') && issue.status !== 'IN_PROGRESS')}
                  className="text-xs sm:text-sm data-[state=active]:text-primary"
                >
                  対応中
                </TabsTrigger>
                <TabsTrigger
                  value="DONE"
                  disabled={
                    statusUpdating ||
                    (!transitions.some(t => t.status === 'DONE') && issue.status !== 'DONE') ||
                    (issue.status !== 'DONE' && afterPhotos.length === 0)
                  }
                  className="text-xs sm:text-sm"
                >
                  完了
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[11px]">
                是正前: {beforePhotos.length}枚
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                是正後: {afterPhotos.length}枚
              </Badge>
            </div>
            {issue.status !== 'DONE' && afterPhotos.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                完了報告には是正後写真（AFTER）が1枚以上必要です。
              </p>
            )}
          </CardContent>
        </Card>

        {/* 写真一覧 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              写真 ({issue.photos.length} 枚)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-8">
              {beforePhotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">是正前</p>
                  <Carousel className="w-full">
                    <CarouselContent className="-ml-2 sm:-ml-4">
                      {beforePhotos.map((photo) => (
                        <CarouselItem key={photo.photoId} className="pl-2 sm:pl-4 basis-4/5 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                          <PhotoCard photo={photo} url={photoUrls[photo.photoId]} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </div>
              )}

              {afterPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">是正後</p>
                  <Carousel className="w-full">
                    <CarouselContent className="-ml-2 sm:-ml-4">
                      {afterPhotos.map((photo) => (
                        <CarouselItem key={photo.photoId} className="pl-2 sm:pl-4 basis-4/5 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                          <PhotoCard photo={photo} url={photoUrls[photo.photoId]} />
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                </div>
              )}

              {issue.photos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 bg-muted/10 rounded-md border">写真なし</p>
              )}
            </div>

            {/* 写真追加 */}
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm font-semibold text-foreground mb-4">写真を追加</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/10 p-4 sm:p-5 rounded-md border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">指摘時写真（是正前）</p>
                  <div className="border rounded-md px-2 py-1 focus-within:ring-1 focus-within:ring-ring bg-background h-11 sm:h-9 flex items-center mb-3">
                    <Input
                      type="file"
                      accept="image/*"
                      ref={beforeFileInputRef}
                      onChange={(e) => setBeforeUploadFile(e.target.files?.[0] ?? null)}
                      disabled={uploading}
                      className="border-0 p-0 h-auto file:bg-secondary file:text-secondary-foreground file:border-0 file:rounded-md file:mr-4 file:px-3 file:py-1 cursor-pointer w-full text-foreground text-xs bg-transparent"
                    />
                  </div>
                  <Button
                    onClick={() => handlePhotoUpload('BEFORE', beforeUploadFile)}
                    disabled={uploading || !beforeUploadFile}
                    className="w-full min-h-[44px] whitespace-nowrap shadow-sm"
                  >
                    {uploading ? '送信中...' : '是正前をアップロード'}
                  </Button>
                </div>

                <div className="bg-muted/10 p-4 sm:p-5 rounded-md border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">完了時写真（是正後）</p>
                  <div className="border rounded-md px-2 py-1 focus-within:ring-1 focus-within:ring-ring bg-background h-11 sm:h-9 flex items-center mb-3">
                    <Input
                      type="file"
                      accept="image/*"
                      ref={afterFileInputRef}
                      onChange={(e) => setAfterUploadFile(e.target.files?.[0] ?? null)}
                      disabled={uploading}
                      className="border-0 p-0 h-auto file:bg-secondary file:text-secondary-foreground file:border-0 file:rounded-md file:mr-4 file:px-3 file:py-1 cursor-pointer w-full text-foreground text-xs bg-transparent"
                    />
                  </div>
                  <Button
                    onClick={() => handlePhotoUpload('AFTER', afterUploadFile)}
                    disabled={uploading || !afterUploadFile}
                    className="w-full min-h-[44px] whitespace-nowrap shadow-sm"
                  >
                    {uploading ? '送信中...' : '是正後をアップロード'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function PhotoCard({ photo, url }: { photo: Photo; url?: string }) {
  return (
    <div className="aspect-square w-full rounded-md border border-border overflow-hidden bg-muted/20 flex items-center justify-center relative group">
      {url ? (
        <>
          <img src={url} alt={`Photo ${photo.photoId}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pb-3">
            <span className="text-[10px] text-white/80 font-mono break-all line-clamp-2">{photo.blobKey.split('/').pop()}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">読み込み中</span>
        </div>
      )}
    </div>
  );
}
