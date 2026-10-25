"use client";

import { DashButton } from "@/components/dashboard/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DiscardWorkflowJobDialogProps = {
  open: boolean;
  jobLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DiscardWorkflowJobDialog({
  open,
  jobLabel,
  onOpenChange,
  onConfirm,
}: DiscardWorkflowJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-4">
          <div className="flex gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"
              aria-hidden
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <DialogHeader className="space-y-1 p-0 text-left">
              <DialogTitle className="text-amber-950">
                {jobLabel} is still running
              </DialogTitle>
              <DialogDescription className="text-amber-900/80">
                Leaving this step will stop the job. Progress so far is kept on
                the server, but the run will not finish until you start it again.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>
        <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 sm:gap-0">
          <DashButton variant="secondary" onClick={() => onOpenChange(false)}>
            Stay on this step
          </DashButton>
          <DashButton
            variant="primary"
            onClick={onConfirm}
            className="!bg-orange-500 hover:!bg-orange-600"
          >
            Stop and leave
          </DashButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
