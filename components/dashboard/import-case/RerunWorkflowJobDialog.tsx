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

export type WorkflowRerunJob = "harmonize" | "grouping" | "classification";

const COPY: Record<
  WorkflowRerunJob,
  { title: string; body: string; confirm: string }
> = {
  harmonize: {
    title: "Re-run harmonization?",
    body:
      "All harmonized products for this case will be removed and rebuilt from the current invoice and packing lines. Verifications and edits in this step will be reorganized—you may need to confirm products again before classification.",
    confirm: "Re-harmonize",
  },
  grouping: {
    title: "Re-run grouping?",
    body:
      "All declaration groups will be cleared and rebuilt from the latest approved classifications. Quantities, HS groupings, and export data from the previous run will be replaced.",
    confirm: "Re-group",
  },
  classification: {
    title: "Re-run classification?",
    body:
      "Existing HS suggestions, expert-review flags, and approvals in this step will be cleared and regenerated. You will need to review and approve classifications again before grouping.",
    confirm: "Re-classify",
  },
};

type RerunWorkflowJobDialogProps = {
  job: WorkflowRerunJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function RerunWorkflowJobDialog({
  job,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: RerunWorkflowJobDialogProps) {
  const { title, body, confirm } = COPY[job];

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent showClose={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DashButton
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </DashButton>
          <DashButton
            variant="primary"
            onClick={onConfirm}
            disabled={loading}
            className="!bg-orange-500 hover:!bg-orange-600"
          >
            {loading ? "Starting…" : confirm}
          </DashButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
