'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  reportedBy: number;
  createdAt: string;
  photos: Photo[];
}

interface IssueDetailPanelProps {
  projectId: string;
  issueId: string;
  onIssueUpdated?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  DONE: '完了',
};

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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

const TRANSITIONS: Record<string, Array<{ status: string; label: string }>> = {
  OPEN: [{ status: 'IN_PROGRESS', label: '対応開始' }],
  IN_PROGRESS: [
    { status: 'DONE', label: '完了にする' },
    { status: 'OPEN', label: '差し戻し' },
  ],
  DONE: [{ status: 'IN_PROGRESS', label: '再対応' }],
};

const TRANSITION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'destructive',
  IN_PROGRESS: 'default',
  DONE: 'secondary',
};

const CAROUSEL_LAYOUT_CLASS = 'w-full px-10 sm:px-11';
const CAROUSEL_ITEM_CLASS = 'pl-2 basis-3/4 sm:basis-2/5 md:basis-1/4';
const CAROUSEL_NAV_CLASS = 'z-10 h-9 w-9 bg-background/90 backdrop-blur-sm hover:bg-background';
const CAROUSEL_OPTS = { align: 'start' as const, loop: true, slidesToScroll: 1 };

async function fetchIssue(projectId: string, issueId: string): Promise<IssueDetail> {
  const issueRes = await fetch(`/api/projects/${projectId}/issues/${issueId}`);
  if (!issueRes.ok) {
    throw new Error(`Failed to fetch issue (${issueRes.status})`);
  }
  return (await issueRes.json()) as IssueDetail;
}

async function fetchPhotoUrls(photos: Photo[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  await Promise.all(
    photos.map(async (photo) => {
      try {
        const res = await fetch(`/api/photos/${photo.photoId}/url`);
        if (!res.ok) return;
        const data = await res.json();
        urls[photo.photoId] = data.url;
      } catch {
        // Ignore individual photo URL failures.
      }
    })
  );
  return urls;
}

export function IssueDetailPanel({
  projectId,
  issueId,
  onIssueUpdated,
}: IssueDetailPanelProps) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [beforeUploadFiles, setBeforeUploadFiles] = useState<File[]>([]);
  const [afterUploadFiles, setAfterUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const beforeFileInputRef = useRef<HTMLInputElement>(null);
  const afterFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!issueId) {
        setIssue(null);
        setPhotoUrls({});
        setError(null);
        setLoading(false);
        setBeforeUploadFiles([]);
        setAfterUploadFiles([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const issueData = await fetchIssue(projectId, issueId);
        const urls = await fetchPhotoUrls(issueData.photos);

        if (cancelled) return;
        setIssue(issueData);
        setPhotoUrls(urls);
      } catch (err) {
        if (cancelled) return;
        setIssue(null);
        setPhotoUrls({});
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [issueId, projectId]);

  const reloadIssue = async () => {
    const updated = await fetchIssue(projectId, issueId);
    setIssue(updated);
    const urls = await fetchPhotoUrls(updated.photos);
    setPhotoUrls(urls);
  };

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
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }

      onIssueUpdated?.();
      await reloadIssue();
    } catch (err) {
      alert('ステータス更新エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handlePhotoUpload = async (phase: 'BEFORE' | 'AFTER', files: File[]) => {
    if (files.length === 0) {
      alert('ファイルを選択してください');
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      for (const file of files) {
        fd.append('files', file);
      }
      fd.append('photoPhase', phase);

      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}/photos`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }

      if (phase === 'BEFORE') {
        setBeforeUploadFiles([]);
        if (beforeFileInputRef.current) beforeFileInputRef.current.value = '';
      } else {
        setAfterUploadFiles([]);
        if (afterFileInputRef.current) afterFileInputRef.current.value = '';
      }

      onIssueUpdated?.();
      await reloadIssue();
    } catch (err) {
      alert('アップロードエラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const beforePhotos = issue?.photos.filter((p) => p.photoPhase === 'BEFORE') ?? [];
  const afterPhotos = issue?.photos.filter((p) => p.photoPhase === 'AFTER') ?? [];
  const showBeforeNavigation = beforePhotos.length >= 4;
  const showAfterNavigation = afterPhotos.length >= 4;
  const transitions = issue ? TRANSITIONS[issue.status] ?? [] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="py-6">
        <p className="text-destructive">エラー: {error ?? 'Issue not found'}</p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <Badge variant={STATUS_COLORS[issue.status] ?? 'outline'}>
          {STATUS_LABELS[issue.status]}
        </Badge>
        {issue.issueType && (
          <Badge variant="outline">
            {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
          </Badge>
        )}
      </div>

      <div className="border-t pt-4 space-y-4 text-sm">
        <div>
          <p className="text-muted-foreground mb-1">タイトル</p>
          <p className="font-medium">{issue.title}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">説明</p>
          <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">
            {issue.description}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-xs">作成日時</p>
            <p>{new Date(issue.createdAt).toLocaleString('ja-JP')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">位置種別</p>
            <p>{issue.locationType}</p>
          </div>
          {issue.dbId && (
            <div>
              <p className="text-muted-foreground text-xs">部材 ID (dbId)</p>
              <Badge variant="secondary" className="font-mono mt-1">
                {issue.dbId}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-semibold mb-3">ステータス変更</p>
        <Tabs
          value={issue.status}
          onValueChange={(val) => {
            if (val !== issue.status) handleStatusChange(val);
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="OPEN"
              disabled={statusUpdating || (!transitions.some((t) => t.status === 'OPEN') && issue.status !== 'OPEN')}
            >
              未対応
            </TabsTrigger>
            <TabsTrigger
              value="IN_PROGRESS"
              disabled={statusUpdating || (!transitions.some((t) => t.status === 'IN_PROGRESS') && issue.status !== 'IN_PROGRESS')}
            >
              対応中
            </TabsTrigger>
            <TabsTrigger
              value="DONE"
              disabled={
                statusUpdating ||
                (!transitions.some((t) => t.status === 'DONE') && issue.status !== 'DONE') ||
                (issue.status !== 'DONE' && afterPhotos.length === 0)
              }
            >
              完了
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-[11px]">
            是正前: {beforePhotos.length}枚
          </Badge>
          <Badge variant={TRANSITION_COLORS[issue.status] ?? 'outline'} className="text-[11px]">
            現在: {STATUS_LABELS[issue.status]}
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            是正後: {afterPhotos.length}枚
          </Badge>
        </div>
      </div>

      <div className="border-t pt-4 mt-4 space-y-6">
        <p className="text-sm font-semibold">写真 ({issue.photos.length} 枚)</p>

        {beforePhotos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">是正前</p>
            <Carousel className={CAROUSEL_LAYOUT_CLASS} opts={CAROUSEL_OPTS}>
              <CarouselContent className="-ml-2">
                {beforePhotos.map((photo) => (
                  <CarouselItem key={photo.photoId} className={CAROUSEL_ITEM_CLASS}>
                    <PhotoCard
                      photo={photo}
                      url={photoUrls[photo.photoId]}
                      onClick={() => {
                        const selectedUrl = photoUrls[photo.photoId];
                        if (selectedUrl) {
                          setLightboxUrl(selectedUrl);
                        }
                      }}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {showBeforeNavigation && (
                <>
                  <CarouselPrevious className={`left-0 ${CAROUSEL_NAV_CLASS}`} />
                  <CarouselNext className={`right-0 ${CAROUSEL_NAV_CLASS}`} />
                </>
              )}
            </Carousel>
          </div>
        )}

        {afterPhotos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">是正後</p>
            <Carousel className={CAROUSEL_LAYOUT_CLASS} opts={CAROUSEL_OPTS}>
              <CarouselContent className="-ml-2">
                {afterPhotos.map((photo) => (
                  <CarouselItem key={photo.photoId} className={CAROUSEL_ITEM_CLASS}>
                    <PhotoCard
                      photo={photo}
                      url={photoUrls[photo.photoId]}
                      onClick={() => {
                        const selectedUrl = photoUrls[photo.photoId];
                        if (selectedUrl) {
                          setLightboxUrl(selectedUrl);
                        }
                      }}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {showAfterNavigation && (
                <>
                  <CarouselPrevious className={`left-0 ${CAROUSEL_NAV_CLASS}`} />
                  <CarouselNext className={`right-0 ${CAROUSEL_NAV_CLASS}`} />
                </>
              )}
            </Carousel>
          </div>
        )}

        {issue.photos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/10 rounded-md border">
            写真なし
          </p>
        )}

        <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/10 p-4 rounded-md border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">指摘時写真（是正前）</p>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              ref={beforeFileInputRef}
              onChange={(e) =>
                setBeforeUploadFiles(Array.from(e.target.files ?? []))
              }
              disabled={uploading}
              className="mb-2"
            />
            {beforeUploadFiles.length > 0 && (
              <p className="text-[11px] text-muted-foreground mb-2">
                {beforeUploadFiles.length}枚選択中
              </p>
            )}
            <Button
              onClick={() => handlePhotoUpload('BEFORE', beforeUploadFiles)}
              disabled={uploading || beforeUploadFiles.length === 0}
              className="w-full"
            >
              {uploading ? '送信中...' : '是正前をアップロード'}
            </Button>
          </div>

          <div className="bg-muted/10 p-4 rounded-md border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">完了時写真（是正後）</p>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              ref={afterFileInputRef}
              onChange={(e) =>
                setAfterUploadFiles(Array.from(e.target.files ?? []))
              }
              disabled={uploading}
              className="mb-2"
            />
            {afterUploadFiles.length > 0 && (
              <p className="text-[11px] text-muted-foreground mb-2">
                {afterUploadFiles.length}枚選択中
              </p>
            )}
            <Button
              onClick={() => handlePhotoUpload('AFTER', afterUploadFiles)}
              disabled={uploading || afterUploadFiles.length === 0}
              className="w-full"
            >
              {uploading ? '送信中...' : '是正後をアップロード'}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={lightboxUrl !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLightboxUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl p-2 bg-black/90 border-none">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="拡大写真"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoCard({
  photo,
  url,
  onClick,
}: {
  photo: Photo;
  url?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={url ? onClick : undefined}
      className={`aspect-square w-full rounded-md border overflow-hidden bg-muted/20 flex items-center justify-center relative group ${
        url && onClick ? 'cursor-pointer' : ''
      }`}
    >
      {url ? (
        <>
          <img src={url} alt={`Photo ${photo.photoId}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
            <span className="text-[10px] text-white/80 font-mono break-all line-clamp-2">
              {photo.blobKey.split('/').pop()}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
          <span className="text-[10px] text-muted-foreground">読み込み中</span>
        </div>
      )}
    </div>
  );
}
