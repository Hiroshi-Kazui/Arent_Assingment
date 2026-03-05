'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
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
  uploadedBy?: string;
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
  floorName?: string;
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

type StatusChangeResult = { ok: true } | { ok: false; error: string };

const STATUS_LABELS: Record<string, string> = {
  POINT_OUT: '未割当',
  OPEN: '未対応',
  IN_PROGRESS: '対応中',
  DONE: '完了',
  CONFIRMED: '承認済',
};

const STATUS_INLINE_STYLES: Record<string, React.CSSProperties> = {
  POINT_OUT: { backgroundColor: '#D32F2F', color: '#fff', borderColor: 'transparent' },
  OPEN: { backgroundColor: '#FF9800', color: '#fff', borderColor: 'transparent' },
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
  POINT_OUT: [],
  OPEN: [
    { status: 'IN_PROGRESS', label: '着手する' },
  ],
  IN_PROGRESS: [
    { status: 'DONE', label: '是正完了' },
    { status: 'OPEN', label: '差し戻し' },
  ],
  DONE: [
    { status: 'CONFIRMED', label: '承認' },
    { status: 'OPEN', label: '否認', needsComment: true },
  ],
  CONFIRMED: [
    { status: 'OPEN', label: '再指摘', needsComment: true },
  ],
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
  const router = useRouter();
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
  const [commentPhotoFiles, setCommentPhotoFiles] = useState<File[]>([]);
  const commentPhotoInputRef = useRef<HTMLInputElement>(null);

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Description editing state
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionSaving, setDescriptionSaving] = useState(false);

  // Assignee inline state
  const [users, setUsers] = useState<UserOption[]>([]);
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

  // Fetch assignable users for inline dropdown (Admin/Supervisor only)
  useEffect(() => {
    if (!session || session.user.role === 'WORKER') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/assignable-users');
        if (!res.ok || cancelled) return;
        const data: Array<{ userId: string; name: string; role: string; activeIssueCount: number }> = await res.json();
        if (!cancelled) {
          setUsers(data.map((u) => ({ userId: u.userId, name: `${u.name} (${u.activeIssueCount})`, role: u.role })));
        }
      } catch {
        // Ignore – dropdown will simply be empty
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const reloadIssue = async () => {
    const updated = await fetchIssue(projectId, issueId);
    setIssue(updated);
    const urls = await fetchPhotoUrls(updated.photos);
    setPhotoUrls(urls);
  };

  const handleStatusChange = async (
    newStatus: string,
    comment?: string,
    options?: { suppressErrorAlert?: boolean }
  ): Promise<StatusChangeResult> => {
    if (!issue) {
      return { ok: false, error: 'Issue not found' };
    }
    if (
      newStatus === 'DONE' &&
      issue.photos.filter((p) => p.photoPhase === 'AFTER').length === 0
    ) {
      const errorMessage = '完了報告には是正後写真が1枚以上必要です';
      if (!options?.suppressErrorAlert) {
        toast.error(errorMessage);
      }
      return { ok: false, error: errorMessage };
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
        let errorMessage = `Failed (${res.status})`;
        try {
          const errData = (await res.json()) as { error?: string };
          errorMessage = errData.error ?? errorMessage;
        } catch {
          // Ignore parse error and keep fallback message.
        }
        throw new Error(errorMessage);
      }

      onIssueUpdated?.();
      await reloadIssue();
      return { ok: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!options?.suppressErrorAlert) {
        toast.error('ステータス更新エラー: ' + errorMessage);
      }
      return { ok: false, error: errorMessage };
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleTransitionClick = (transition: { status: string; label: string; needsComment?: boolean }) => {
    if (transition.needsComment) {
      setCommentModalTarget(transition.status);
      setCommentText('');
      setCommentPhotoFiles([]);
      if (commentPhotoInputRef.current) commentPhotoInputRef.current.value = '';
      setCommentModalOpen(true);
      return;
    }
    void handleStatusChange(transition.status);
  };

  const handleCommentSubmit = async () => {
    if (!issue) return;
    if (!commentText.trim()) return;
    const isReissue = issue.status === 'CONFIRMED' && commentModalTarget === 'OPEN';
    if (isReissue && commentPhotoFiles.length === 0) return;

    const uploadedRejectionPhotoIds: string[] = [];

    if (isReissue) {
      try {
        setUploading(true);
        const fd = new FormData();
        for (const file of commentPhotoFiles) {
          fd.append('files', file);
        }
        fd.append('photoPhase', 'REJECTION');

        const uploadRes = await fetch(`/api/projects/${projectId}/issues/${issueId}/photos`, {
          method: 'POST',
          body: fd,
        });
        if (!uploadRes.ok) {
          let errorMessage = `Failed (${uploadRes.status})`;
          try {
            const errData = (await uploadRes.json()) as { error?: string };
            errorMessage = errData.error ?? errorMessage;
          } catch {
            // Ignore parse error and keep fallback message.
          }
          throw new Error(errorMessage);
        }

        const uploadData = (await uploadRes.json()) as { photoIds?: string[]; photos?: Array<{ photoId: string }> };
        if (Array.isArray(uploadData.photoIds)) {
          uploadedRejectionPhotoIds.push(...uploadData.photoIds);
        } else if (Array.isArray(uploadData.photos)) {
          uploadedRejectionPhotoIds.push(...uploadData.photos.map((p) => p.photoId));
        }
      } catch (err) {
        toast.error('否認時写真のアップロードに失敗しました: ' + (err instanceof Error ? err.message : String(err)));
        return;
      } finally {
        setUploading(false);
      }
    }

    const statusResult = await handleStatusChange(
      commentModalTarget,
      commentText.trim(),
      { suppressErrorAlert: true }
    );
    if (!statusResult.ok) {
      if (uploadedRejectionPhotoIds.length > 0) {
        const rollbackResults = await Promise.all(
          uploadedRejectionPhotoIds.map(async (photoId) => {
            try {
              const deleteRes = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
              return deleteRes.ok;
            } catch {
              return false;
            }
          })
        );
        const rollbackSucceeded = rollbackResults.every(Boolean);
        await reloadIssue();
        if (rollbackSucceeded) {
          toast.error(`ステータス変更に失敗したため、アップロード済み写真を取り消しました: ${statusResult.error}`);
        } else {
          toast.error(`ステータス変更に失敗しました。写真の取り消しに失敗したものがあるため、再確認してください: ${statusResult.error}`);
        }
        return;
      }

      toast.error('ステータス更新エラー: ' + statusResult.error);
      return;
    }

    setCommentModalOpen(false);
    setCommentText('');
    setCommentPhotoFiles([]);
    if (commentPhotoInputRef.current) commentPhotoInputRef.current.value = '';
  };

  const handleAssigneeChange = async (userId: string) => {
    try {
      setAssigneeUpdating(true);
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}/assignee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: userId, changedBy: session?.user?.id ?? '' }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `Failed (${res.status})`);
      }
      onIssueUpdated?.();
      await reloadIssue();
    } catch (err) {
      toast.error('担当者変更エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAssigneeUpdating(false);
    }
  };

  const handlePhotoUpload = async (phase: 'BEFORE' | 'AFTER', files: File[]) => {
    if (files.length === 0) {
      toast.error('ファイルを選択してください');
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

      await reloadIssue();
    } catch (err) {
      toast.error('アップロードエラー: ' + (err instanceof Error ? err.message : String(err)));
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
      toast.error('削除エラー: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  };

  const beforePhotos = issue?.photos.filter((p) => p.photoPhase === 'BEFORE') ?? [];
  const afterPhotos = issue?.photos.filter((p) => p.photoPhase === 'AFTER') ?? [];
  const rejectionPhotos = issue?.photos.filter((p) => p.photoPhase === 'REJECTION') ?? [];
  const userRole = session?.user?.role;
  const allTransitions = issue ? TRANSITIONS[issue.status] ?? [] : [];
  // 担当者以外はステータス変更不可。ただし DONE→承認/否認 は例外
  const currentUserId = session?.user?.id;
  const isAssignee = issue ? issue.assigneeId === currentUserId : false;
  const transitions = allTransitions.filter((t) => {
    // CONFIRMED → 再指摘 は ADMIN/SUPERVISOR のみ
    if (issue?.status === 'CONFIRMED') {
      return userRole === 'ADMIN' || userRole === 'SUPERVISOR';
    }
    // DONE → 承認/否認 は ADMIN/SUPERVISOR のみ（担当者ワーカーにも非表示）
    if (issue?.status === 'DONE' && (t.status === 'CONFIRMED' || t.status === 'OPEN')) {
      return userRole === 'ADMIN' || userRole === 'SUPERVISOR';
    }
    if (isAssignee) return true;
    return false;
  });
  const isOverdue = issue
    ? issue.status !== 'DONE' && issue.status !== 'CONFIRMED' &&
      new Date(issue.dueDate).setHours(0, 0, 0, 0) <=
        new Date().setHours(0, 0, 0, 0)
    : false;
  const isReissueComment = commentModalTarget === 'OPEN' && issue?.status === 'CONFIRMED';

  const canEditTitle = userRole === 'ADMIN' || userRole === 'SUPERVISOR';

  const canDeletePhoto = (photo: Photo): boolean => {
    if (!session?.user) return false;
    const role = session.user.role;
    if (role === 'ADMIN' || role === 'SUPERVISOR') return true;
    // Worker: 自分がアップロードした写真のみ
    return photo.uploadedBy === session.user.id;
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!confirm('この写真を削除しますか？')) return;
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || '削除に失敗しました');
        return;
      }
      // Issue データをリフレッシュ
      const issueData = await fetchIssue(projectId, issueId);
      const urls = await fetchPhotoUrls(issueData.photos);
      setIssue(issueData);
      setPhotoUrls(urls);
      onIssueUpdated?.();
    } catch {
      toast.error('削除に失敗しました');
    }
  };

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
      toast.error('タイトルの更新に失敗しました');
    } finally {
      setTitleSaving(false);
    }
  };

  const handleDescriptionSave = async () => {
    if (!issue || descriptionDraft.trim() === issue.description) {
      setEditingDescription(false);
      return;
    }
    setDescriptionSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descriptionDraft.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update description');
      setEditingDescription(false);
      onIssueUpdated?.();
      await reloadIssue();
    } catch {
      toast.error('説明の更新に失敗しました');
    } finally {
      setDescriptionSaving(false);
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
      <div className="flex items-center justify-between gap-2 pb-4">
        <Badge variant="outline" className="text-base px-4 py-1.5" style={STATUS_INLINE_STYLES[issue.status]}>
          {STATUS_LABELS[issue.status]}
        </Badge>
        {transitions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {transitions.map((t) => (
              <Button
                key={t.status}
                variant="default"
                size="sm"
                disabled={statusUpdating}
                className="text-white"
                style={{ backgroundColor: STATUS_INLINE_STYLES[t.status]?.backgroundColor }}
                onClick={() => handleTransitionClick(t)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-4 text-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">
            {issue.locationType === 'dbId' ? `部材 (dbId: ${issue.dbId})` : '空間指摘'}
          </Badge>
          {issue.floorName && (
            <Badge variant="outline" className="text-[10px]">
              {issue.floorName}
            </Badge>
          )}
        </div>
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
            <>
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
              {issue.issueType && (
                <Badge variant="outline" className="mt-1">
                  {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                </Badge>
              )}
            </>
          )}
        </div>
        <div>
          <p className="text-muted-foreground mb-1">説明</p>
          {editingDescription ? (
            <div className="space-y-2">
              <Textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                disabled={descriptionSaving}
                rows={4}
                className="resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  disabled={descriptionSaving}
                  onClick={handleDescriptionSave}
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  disabled={descriptionSaving}
                  onClick={() => setEditingDescription(false)}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded-md border flex-1">
                {issue.description}
              </p>
              {canEditTitle && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors mt-3 shrink-0"
                  title="説明を編集"
                  onClick={() => {
                    setDescriptionDraft(issue.description);
                    setEditingDescription(true);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-xs">是正期限</p>
            <p className={isOverdue ? 'text-destructive font-bold' : ''}>
              {new Date(issue.dueDate).toLocaleDateString('ja-JP')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">担当者</p>
            {userRole === 'WORKER' ? (
              <p>{issue.assigneeName ?? '未割当'}</p>
            ) : (
              <Select
                value={issue.assigneeId ?? '__none__'}
                onValueChange={(val) => {
                  if (val === '__none__') return;
                  if (val !== issue.assigneeId) handleAssigneeChange(val);
                }}
                disabled={assigneeUpdating}
              >
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未割当</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="col-span-full mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                onClose?.();
                router.push(`/projects/${projectId}/viewer?highlightId=${issueId}`);
              }}
            >
              3Dビューで位置を確認
            </Button>
          </div>
        </div>
      </div>

      {/* Status change log (collapsible) */}
      {issue.statusChangeLogs && issue.statusChangeLogs.length > 0 && (
        <details className="border-t pt-4 mt-4 group">
          <summary className="text-sm font-semibold cursor-pointer list-none flex items-center gap-1 select-none">
            変更履歴
            <svg className="w-4 h-4 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </summary>
          <div className="space-y-2 mt-3">
            {issue.statusChangeLogs.map((log) => (
              <div key={log.logId} className="text-xs border-l-2 pl-3 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {new Date(log.changedAt).toLocaleString('ja-JP')}
                  </span>
                  <span className="font-medium">{log.changedByName}</span>
                </div>
                <div>
                  <Badge variant="outline" className="text-[10px] mr-1" style={STATUS_INLINE_STYLES[log.fromStatus]}>
                    {STATUS_LABELS[log.fromStatus] ?? log.fromStatus}
                  </Badge>
                  →
                  <Badge variant="outline" className="text-[10px] ml-1" style={STATUS_INLINE_STYLES[log.toStatus]}>
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
        </details>
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
                        if (selectedUrl) setLightboxUrl(selectedUrl);
                      }}
                      onDelete={canDeletePhoto(photo) ? () => handlePhotoDelete(photo.photoId) : undefined}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {beforePhotos.length >= 4 && (
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
                        if (selectedUrl) setLightboxUrl(selectedUrl);
                      }}
                      onDelete={canDeletePhoto(photo) ? () => handlePhotoDelete(photo.photoId) : undefined}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {afterPhotos.length >= 4 && (
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
                        if (selectedUrl) setLightboxUrl(selectedUrl);
                      }}
                      onDelete={canDeletePhoto(photo) ? () => handlePhotoDelete(photo.photoId) : undefined}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {rejectionPhotos.length >= 4 && (
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
        onOpenChange={(open) => { if (!open) setLightboxUrl(null); }}
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
      <Dialog
        open={commentModalOpen}
        onOpenChange={(open) => {
          setCommentModalOpen(open);
          if (!open) {
            setCommentPhotoFiles([]);
            if (commentPhotoInputRef.current) commentPhotoInputRef.current.value = '';
          }
        }}
      >
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
          {isReissueComment && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">再指摘には否認時写真が1枚以上必要です</p>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                multiple
                ref={commentPhotoInputRef}
                onChange={(e) => setCommentPhotoFiles(Array.from(e.target.files ?? []))}
                disabled={uploading || statusUpdating}
              />
              {commentPhotoFiles.length > 0 && (
                <p className="text-[11px] text-muted-foreground">{commentPhotoFiles.length}枚選択中</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCommentModalOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={
                !commentText.trim() ||
                (isReissueComment && commentPhotoFiles.length === 0) ||
                uploading ||
                statusUpdating
              }
            >
              送信
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
  onDelete,
}: {
  photo: Photo;
  url?: string;
  onClick?: () => void;
  onDelete?: () => void;
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
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
              title="写真を削除"
            >
              ×
            </button>
          )}
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
