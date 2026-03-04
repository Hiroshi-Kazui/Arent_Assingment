'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Photo {
  photoId: string;
  blobKey: string;
  photoPhase: 'BEFORE' | 'AFTER' | 'REJECTION';
  uploadedAt: string;
}

interface StatusChangeLogEntry {
  logId: string;
  fromStatus: string;
  toStatus: string;
  changedByName: string;
  comment?: string;
  changedAt: string;
}

interface IssueDetail {
  issueId: string;
  projectId: string;
  title: string;
  description: string;
  issueType?: string;
  dueDate: string;
  status: 'POINT_OUT' | 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CONFIRMED';
  priority: string;
  locationType: 'dbId' | 'worldPosition';
  dbId?: string;
  worldPositionX?: number;
  worldPositionY?: number;
  worldPositionZ?: number;
  floorId: string;
  reportedBy: string;
  createdAt: string;
  photos: Photo[];
  assigneeId?: string;
  assigneeName?: string;
  statusChangeLogs: StatusChangeLogEntry[];
}

interface IssueDetailPanelProps {
  projectId: string;
  issueId: string;
  onIssueUpdated?: () => void;
  onClose?: () => void;
}

interface UserOption {
  userId: string;
  name: string;
  role: string;
}

const STATUS_LABELS: Record<string, string> = {
  POINT_OUT: '未割当',
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  DONE: '完了',
  CONFIRMED: '承認済',
};

const STATUS_INLINE_STYLES: Record<string, React.CSSProperties> = {
  POINT_OUT: { backgroundColor: '#E53935', color: '#fff', borderColor: 'transparent' },
  OPEN: { backgroundColor: '#757575', color: '#fff', borderColor: 'transparent' },
  IN_PROGRESS: { backgroundColor: '#1E88E5', color: '#fff', borderColor: 'transparent' },
  DONE: { backgroundColor: '#43A047', color: '#fff', borderColor: 'transparent' },
  CONFIRMED: { backgroundColor: '#00695C', color: '#fff', borderColor: 'transparent' },
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
  quality: '品質',
  safety: '安全',
  construction: '施工',
  design: '設計',
  QUALITY: '品質',
  SAFETY: '安全',
  CONSTRUCTION: '施工',
  DESIGN: '設計',
};

const TRANSITIONS: Record<string, Array<{ status: string; label: string; needsComment?: boolean }>> = {
  POINT_OUT: [{ status: 'ASSIGN', label: '担当者を割り振る' }],
  OPEN: [
    { status: 'IN_PROGRESS', label: '着手する' },
    { status: 'ASSIGN', label: '担当者を変更' },
  ],
  IN_PROGRESS: [
    { status: 'DONE', label: '是正完了' },
    { status: 'OPEN', label: '差し戻し' },
  ],
  DONE: [
    { status: 'CONFIRMED', label: '承認' },
    { status: 'OPEN', label: '否認', needsComment: true },
    { status: 'ASSIGN', label: '担当者を変更' },
  ],
  CONFIRMED: [
    { status: 'OPEN', label: '再指摘', needsComment: true },
    { status: 'ASSIGN', label: '担当者を変更' },
  ],
};

const TRANSITION_BUTTON_STYLES: Record<string, string> = {
  IN_PROGRESS: '',
  DONE: '',
  CONFIRMED: 'text-white',
  OPEN: 'text-white',
  ASSIGN: '',
};

const TRANSITION_BUTTON_INLINE_STYLES: Record<string, React.CSSProperties> = {
  CONFIRMED: { backgroundColor: '#00695C' },
  OPEN: { backgroundColor: '#757575' },
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
  onClose,
}: IssueDetailPanelProps) {
  const { data: session } = useSession();
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

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentModalTarget, setCommentModalTarget] = useState<string>('');
  const [commentText, setCommentText] = useState('');

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Assignee modal state
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigneeUpdating, setAssigneeUpdating] = useState(false);

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

  const handleStatusChange = async (newStatus: string, comment?: string) => {
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
        body: JSON.stringify({
          status: newStatus,
          comment,
          changedBy: session?.user?.id ?? '',
        }),
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

  const handleTransitionClick = (transition: { status: string; label: string; needsComment?: boolean }) => {
    if (transition.status === 'ASSIGN') {
      openAssigneeModal();
      return;
    }
    if (transition.needsComment) {
      setCommentModalTarget(transition.status);
      setCommentText('');
      setCommentModalOpen(true);
      return;
    }
    handleStatusChange(transition.status);
  };

  const handleCommentSubmit = () => {
    if (!commentText.trim()) return;
    setCommentModalOpen(false);
    handleStatusChange(commentModalTarget, commentText.trim());
  };

  const openAssigneeModal = async () => {
    setAssigneeModalOpen(true);
    setSelectedUserId('');
    setUsersError(false);

    try {
      setUsersLoading(true);
      const res = await fetch('/api/assignable-users');
      if (!res.ok) {
        setUsersError(true);
        return;
      }
      const data: Array<{ userId: string; name: string; role: string; activeIssueCount: number }> = await res.json();
      setUsers(data.map((u) => ({ userId: u.userId, name: `${u.name} (${u.activeIssueCount})`, role: u.role })));
    } catch {
      setUsersError(true);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAssigneeSubmit = async () => {
    if (!selectedUserId.trim()) return;
    try {
      setAssigneeUpdating(true);
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}/assignee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: selectedUserId.trim(), changedBy: session?.user?.id ?? '' }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }
      setAssigneeModalOpen(false);
      onIssueUpdated?.();
      await reloadIssue();
    } catch (err) {
      alert('担当者割り振りエラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAssigneeUpdating(false);
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

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }
      setDeleteConfirmOpen(false);
      onIssueUpdated?.();
      onClose?.();
    } catch (err) {
      alert('削除エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  };

  const beforePhotos = issue?.photos.filter((p) => p.photoPhase === 'BEFORE') ?? [];
  const afterPhotos = issue?.photos.filter((p) => p.photoPhase === 'AFTER') ?? [];
  const rejectionPhotos = issue?.photos.filter((p) => p.photoPhase === 'REJECTION') ?? [];
  const showBeforeNavigation = beforePhotos.length >= 4;
  const showAfterNavigation = afterPhotos.length >= 4;
  const showRejectionNavigation = rejectionPhotos.length >= 4;
  const allTransitions = issue ? TRANSITIONS[issue.status] ?? [] : [];
  // 担当者以外はステータス変更不可。ただし DONE→承認/否認 は例外
  const currentUserId = session?.user?.id;
  const isAssignee = issue ? issue.assigneeId === currentUserId : false;
  const transitions = allTransitions.filter((t) => {
    if (isAssignee) return true;
    if (issue?.status === 'DONE' && (t.status === 'CONFIRMED' || t.status === 'OPEN')) return true;
    if (t.status === 'ASSIGN') return true;
    return false;
  });
  const isOverdue = issue
    ? issue.status !== 'DONE' && issue.status !== 'CONFIRMED' &&
      new Date(issue.dueDate).setHours(0, 0, 0, 0) <=
        new Date().setHours(0, 0, 0, 0)
    : false;

  const userRole = session?.user?.role;
  const canEditTitle = userRole === 'ADMIN' || userRole === 'SUPERVISOR';

  const handleTitleSave = async () => {
    if (!issue || !titleDraft.trim() || titleDraft.trim() === issue.title) {
      setEditingTitle(false);
      return;
    }
    setTitleSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update title');
      setEditingTitle(false);
      onIssueUpdated?.();
    } catch {
      alert('タイトルの更新に失敗しました');
    } finally {
      setTitleSaving(false);
    }
  };

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
        <Badge variant="outline" style={STATUS_INLINE_STYLES[issue.status]}>
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
          {editingTitle ? (
            <div className="flex gap-2 items-center">
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                disabled={titleSaving}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={titleSaving || !titleDraft.trim()}
                onClick={handleTitleSave}
              >
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={titleSaving}
                onClick={() => setEditingTitle(false)}
              >
                取消
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-medium">{issue.title}</p>
              {canEditTitle && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="タイトルを編集"
                  onClick={() => {
                    setTitleDraft(issue.title);
                    setEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.focus(), 0);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
              )}
            </div>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">説明</p>
          <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">
            {issue.description}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-xs">是正期限</p>
            <p className={isOverdue ? 'text-destructive font-bold' : ''}>
              {new Date(issue.dueDate).toLocaleDateString('ja-JP')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">位置種別</p>
            <p>{issue.locationType === 'dbId' ? '部材情報' : '空間情報'}</p>
          </div>
          {issue.dbId && (
            <div>
              <p className="text-muted-foreground text-xs">部材 ID (dbId)</p>
              <Badge variant="secondary" className="font-mono mt-1">
                {issue.dbId}
              </Badge>
            </div>
          )}
          {issue.assigneeName && (
            <div>
              <p className="text-muted-foreground text-xs">担当者</p>
              <p>{issue.assigneeName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Status transition buttons */}
      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-semibold mb-3">ステータス変更</p>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant="outline" className="text-[11px]" style={STATUS_INLINE_STYLES[issue.status]}>
            現在: {STATUS_LABELS[issue.status]}
          </Badge>
          {transitions.map((t) => (
            <Button
              key={t.status}
              variant={t.needsComment ? 'outline' : 'default'}
              size="sm"
              disabled={statusUpdating}
              className={TRANSITION_BUTTON_STYLES[t.status] ?? ''}
              style={TRANSITION_BUTTON_INLINE_STYLES[t.status]}
              onClick={() => handleTransitionClick(t)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-[11px]">
            是正前: {beforePhotos.length}枚
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            是正後: {afterPhotos.length}枚
          </Badge>
          {rejectionPhotos.length > 0 && (
            <Badge variant="outline" className="text-[11px]" style={{ borderColor: '#E53935', color: '#E53935' }}>
              否認時: {rejectionPhotos.length}枚
            </Badge>
          )}
        </div>
      </div>

      {/* Status change log */}
      {issue.statusChangeLogs && issue.statusChangeLogs.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-semibold mb-3">変更履歴</p>
          <div className="space-y-2">
            {issue.statusChangeLogs.map((log) => (
              <div key={log.logId} className="text-xs border-l-2 pl-3 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {new Date(log.changedAt).toLocaleString('ja-JP')}
                  </span>
                  <span className="font-medium">{log.changedByName}</span>
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] mr-1">
                    {STATUS_LABELS[log.fromStatus] ?? log.fromStatus}
                  </Badge>
                  →
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {STATUS_LABELS[log.toStatus] ?? log.toStatus}
                  </Badge>
                </div>
                {log.comment && (
                  <p className="text-muted-foreground mt-1 italic">
                    「{log.comment}」
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

        {rejectionPhotos.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#E53935' }}>否認時</p>
            <Carousel className={CAROUSEL_LAYOUT_CLASS} opts={CAROUSEL_OPTS}>
              <CarouselContent className="-ml-2">
                {rejectionPhotos.map((photo) => (
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
              {showRejectionNavigation && (
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

      {/* Delete button (SUPERVISOR only) */}
      {session?.user?.role === 'SUPERVISOR' && (
        <div className="border-t pt-4 mt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            この指摘を削除
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>指摘を削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            この操作は取り消せません。関連する写真もすべて削除されます。
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox dialog */}
      <Dialog
        open={lightboxUrl !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLightboxUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl p-2 bg-black/90 border-none">
          <DialogTitle className="sr-only">拡大写真</DialogTitle>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="拡大写真"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Comment modal (for 否認/再指摘) */}
      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>コメントを入力</DialogTitle>
          </DialogHeader>
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="理由を入力してください"
            rows={4}
            className="resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCommentModalOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={!commentText.trim()}
            >
              送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignee modal */}
      <Dialog open={assigneeModalOpen} onOpenChange={setAssigneeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>担当者を割り振る</DialogTitle>
          </DialogHeader>
          {usersLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">読み込み中...</p>
          ) : usersError || users.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">ユーザーIDを入力してください</p>
              <Input
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="ユーザーID"
                disabled={assigneeUpdating}
              />
            </div>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={assigneeUpdating}>
              <SelectTrigger>
                <SelectValue placeholder="担当者を選択" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAssigneeModalOpen(false)} disabled={assigneeUpdating}>
              キャンセル
            </Button>
            <Button
              onClick={handleAssigneeSubmit}
              disabled={!selectedUserId.trim() || assigneeUpdating}
            >
              {assigneeUpdating ? '割り振り中...' : '割り振る'}
            </Button>
          </DialogFooter>
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
