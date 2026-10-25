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
import type { ClassificationReviewView } from "@/lib/import-cases/classification-review-view";
import { formatHsCode } from "@/lib/hs-code-format";

export type ClassificationDecisionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productSequence: number;
  productLabel: string;
  currentHsCode: string | null;
  review: ClassificationReviewView | null;
  approving: boolean;
  onApproveOption: (candidateId: string) => void;
};

export function ClassificationDecisionDialog({
  open,
  onOpenChange,
  productSequence,
  productLabel,
  currentHsCode,
  review,
  approving,
  onApproveOption,
}: ClassificationDecisionDialogProps) {
  const question = review?.question ?? null;
  const reason = review?.reason ?? null;
  const alternatives = review?.alternatives ?? [];

  const currentDisplay =
    currentHsCode && !review?.noCode
      ? formatHsCode(currentHsCode).display
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !approving && onOpenChange(next)}>
      <DialogContent
        showClose={!approving}
        className="flex max-h-[min(90vh,40rem)] w-[min(96vw,32rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-4">
          <div className="flex gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"
              aria-hidden
            >
              <AlertIcon />
            </div>
            <DialogHeader className="space-y-1 p-0 text-left">
              <DialogTitle className="text-amber-950">
                Your decision is required
              </DialogTitle>
              <DialogDescription className="text-amber-900/80">
                Product #{productSequence} · {productLabel}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {currentDisplay ? (
            <p className="text-sm text-slate-600">
              Current suggestion:{" "}
              <span className="font-mono font-semibold text-slate-900">
                {currentDisplay}
              </span>
            </p>
          ) : null}
          {question ? (
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-900">
              {question}
            </p>
          ) : null}
          {reason && reason !== question ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {reason}
            </p>
          ) : null}
          {alternatives.length > 0 ? (
            <ol
              className="mt-4 space-y-2"
              aria-label="Choose the HS code that fits this product"
            >
              {alternatives.map((alt, index) => (
                <li
                  key={alt.candidateId}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-slate-500">
                      {index + 1}.
                    </span>{" "}
                    <span className="font-mono font-semibold text-slate-900">
                      {alt.hsCode}
                    </span>
                    {alt.officialDescription ? (
                      <span className="text-slate-700">
                        {" "}
                        — {alt.officialDescription}
                      </span>
                    ) : null}
                    {alt.reason ? (
                      <span className="mt-1 block text-slate-500">
                        {alt.reason}
                      </span>
                    ) : null}
                  </div>
                  <DashButton
                    type="button"
                    variant="primary"
                    disabled={approving}
                    className="shrink-0"
                    onClick={() => onApproveOption(alt.candidateId)}
                  >
                    {approving ? "Saving…" : "Approve this code"}
                  </DashButton>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No tariff options are stored yet. Add a note for the AI or set the
              HS code manually on the classification row.
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
          <DashButton
            type="button"
            variant="secondary"
            disabled={approving}
            onClick={() => onOpenChange(false)}
          >
            Close
          </DashButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlertIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}
