'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { IssueDetailPanel } from '@/app/components/issue-detail-panel';
import { Dialog, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
    <>
      <div className="hidden sm:block">
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogPortal>
            <DialogOverlay className="bg-black/50" />
            <DialogPrimitive.Content
              className={cn(
                'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 border bg-background shadow-lg duration-200',
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
                'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:max-w-2xl sm:rounded-lg max-h-[90vh] overflow-hidden'
              )}
            >
              <DialogHeader className="p-6 pb-4 border-b shrink-0">
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
              <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </div>

      <div className="sm:hidden">
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="h-[95vh]">
            <DrawerHeader className="border-b">
              <DrawerTitle>指摘詳細</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="flex-1 p-4">
              {open && issueId ? (
                <IssueDetailPanel
                  projectId={projectId}
                  issueId={issueId}
                  onIssueUpdated={onIssueUpdated}
                />
              ) : null}
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
