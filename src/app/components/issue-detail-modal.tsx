'use client';

import { IssueDetailPanel } from '@/app/components/issue-detail-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IssueDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  issueId: string;
  onIssueUpdated?: () => void;
}

export function IssueDetailModal({
  open,
  onOpenChange,
  projectId,
  issueId,
  onIssueUpdated,
}: IssueDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col max-h-[90vh] p-0 gap-0 border-border">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20 shrink-0">
          <DialogTitle>指摘詳細</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          {open && issueId ? (
            <IssueDetailPanel
              projectId={projectId}
              issueId={issueId}
              onIssueUpdated={onIssueUpdated}
            />
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
