"use client";

import { useEffect } from "react";

export type WorkflowJobGuardPayload = {
  label: string;
  stop: () => void;
};

/** Tell the import-case wizard when a batch job is running on this step. */
export function useWorkflowJobGuard(
  active: boolean,
  label: string,
  stop: () => void,
  onWorkflowJobGuard?: (guard: WorkflowJobGuardPayload | null) => void,
) {
  useEffect(() => {
    if (!onWorkflowJobGuard) return;
    if (!active) {
      onWorkflowJobGuard(null);
      return;
    }
    onWorkflowJobGuard({ label, stop });
    return () => onWorkflowJobGuard(null);
  }, [active, label, stop, onWorkflowJobGuard]);
}
