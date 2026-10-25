"use client";

import { useMemo, useState } from "react";
import {
  formatAuditAction,
  formatAuditDetails,
  getAuditStepGroup,
  type AuditStepGroupId,
} from "@/lib/import-cases/audit-labels";
import type { AuditLogView } from "@/lib/import-cases/audit-queries";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui";

const STEP_META: Record<
  AuditStepGroupId,
  { label: string; shortLabel: string; description: string; order: number }
> = {
  "case-info": {
    label: "Case info",
    shortLabel: "Case",
    description: "Case created and shipment details updated",
    order: 1,
  },
  documents: {
    label: "Documents",
    shortLabel: "Documents",
    description: "Uploads, replacements, deletions, and extraction",
    order: 2,
  },
  "invoice-lines": {
    label: "Invoice lines",
    shortLabel: "Invoice",
    description: "Line review, corrections, and bulk decisions",
    order: 3,
  },
  "packing-lines": {
    label: "Packing list",
    shortLabel: "Packing",
    description: "Line review, corrections, and bulk decisions",
    order: 4,
  },
  checks: {
    label: "Checks",
    shortLabel: "Checks",
    description: "Validation warnings resolved or overridden",
    order: 5,
  },
  products: {
    label: "Products",
    shortLabel: "Products",
    description: "Matching, verification, and product edits",
    order: 6,
  },
  classification: {
    label: "Classification",
    shortLabel: "Classify",
    description: "Suggestions, AI requests, and approvals",
    order: 7,
  },
  "grouping-export": {
    label: "Export",
    shortLabel: "Export",
    description: "Declaration groups and export reports",
    order: 8,
  },
  other: {
    label: "Other",
    shortLabel: "Other",
    description: "Additional case events",
    order: 9,
  },
};

const PIPELINE_STEPS = (
  Object.keys(STEP_META) as AuditStepGroupId[]
).filter((id) => id !== "other");

function formatWhen(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatRelative(d: Date) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatWhen(d);
}

function actorName(entry: AuditLogView): string {
  if (entry.userFullName?.trim()) return entry.userFullName.trim();
  if (entry.userEmail) return entry.userEmail;
  return "System";
}

function actorInitials(entry: AuditLogView): string {
  const name = actorName(entry);
  if (name === "System") return "SY";
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function decisionVerb(action: string): string | null {
  if (action.includes("reject")) return "Rejected by";
  if (action.includes("override")) return "Overridden by";
  if (
    action.includes("approve") ||
    action.includes("approved") ||
    action.includes("verified")
  ) {
    return "Approved by";
  }
  if (action.includes("export")) return "Exported by";
  if (action.includes("delete")) return "Deleted by";
  return null;
}

function toneForAction(action: string): {
  dot: string;
  badge: string;
  iconBg: string;
} {
  if (action.includes("fail") || action.includes("reject")) {
    return {
      dot: "bg-rose-500",
      badge: "bg-rose-50 text-rose-700 ring-rose-100",
      iconBg: "bg-rose-50 text-rose-600",
    };
  }
  if (
    action.includes("approve") ||
    action.includes("verified") ||
    action.includes("approved") ||
    action.includes("export")
  ) {
    return {
      dot: "bg-emerald-500",
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      iconBg: "bg-emerald-50 text-emerald-700",
    };
  }
  if (action.includes("delete") || action.includes("override")) {
    return {
      dot: "bg-amber-500",
      badge: "bg-amber-50 text-amber-800 ring-amber-100",
      iconBg: "bg-amber-50 text-amber-700",
    };
  }
  return {
    dot: "bg-[#007bff]",
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
    iconBg: "bg-blue-50 text-blue-700",
  };
}

type StepBucket = {
  id: AuditStepGroupId;
  entries: AuditLogView[];
};

type CaseHistoryPanelProps = {
  entries: AuditLogView[];
  caseNumber?: string | null;
};

export function CaseHistoryPanel({
  entries,
  caseNumber,
}: CaseHistoryPanelProps) {
  const grouped = useMemo(() => groupByStep(entries), [entries]);
  const byId = useMemo(() => {
    const map = new Map<AuditStepGroupId, AuditLogView[]>();
    for (const g of grouped) map.set(g.id, g.entries);
    return map;
  }, [grouped]);

  const pipeline = useMemo((): StepBucket[] => {
    const steps: StepBucket[] = PIPELINE_STEPS.map((id) => ({
      id,
      entries: byId.get(id) ?? [],
    }));
    const other = byId.get("other") ?? [];
    if (other.length > 0) {
      steps.push({ id: "other", entries: other });
    }
    return steps;
  }, [byId]);

  const defaultStep = useMemo(() => {
    // Prefer the furthest step that has activity (most progressed).
    for (let i = pipeline.length - 1; i >= 0; i--) {
      if ((pipeline[i]?.entries.length ?? 0) > 0) return pipeline[i]!.id;
    }
    return pipeline[0]?.id ?? "case-info";
  }, [pipeline]);

  const [selected, setSelected] = useState<AuditStepGroupId>(defaultStep);
  const activeId = pipeline.some((s) => s.id === selected)
    ? selected
    : defaultStep;
  const activeEntries = byId.get(activeId) ?? [];
  const activeMeta = STEP_META[activeId];

  const uniqueActors = new Set(
    entries.map((e) => e.userId ?? e.userEmail ?? "system"),
  ).size;
  const stepsTouched = pipeline.filter((s) => s.entries.length > 0).length;

  return (
    <DashCard className="overflow-hidden">
      <DashCardHeader
        title="Case history"
        action={
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums">
            {entries.length} event{entries.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <p className="text-sm leading-relaxed text-slate-600 max-w-3xl">
          Workflow progress for
          {caseNumber ? (
            <>
              {" "}
              <span className="font-semibold text-slate-800">{caseNumber}</span>
            </>
          ) : (
            " this case"
          )}
          . Select a stage to review who did what.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Events" value={String(entries.length)} />
          <SummaryStat label="People" value={String(uniqueActors)} />
          <SummaryStat label="Stages touched" value={String(stepsTouched)} />
          <SummaryStat
            label="Latest"
            value={entries[0] ? formatRelative(entries[0].createdAt) : "—"}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-14 text-center sm:px-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <HistoryIcon />
          </div>
          <p className="text-sm font-semibold text-slate-800">No history yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Activity from each workflow step will appear here as the case
            progresses.
          </p>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-100 px-3 py-4 sm:px-5">
            <nav aria-label="Case history stages" className="w-full overflow-x-auto pb-1">
              <ol className="flex w-full min-w-[44rem] list-none items-stretch sm:min-w-0">
                {pipeline.map((step, index) => {
                  const meta = STEP_META[step.id];
                  const isActive = step.id === activeId;
                  const hasActivity = step.entries.length > 0;
                  const isFirst = index === 0;
                  const isLast = index === pipeline.length - 1;
                  const clip = isFirst
                    ? isLast
                      ? undefined
                      : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                    : isLast
                      ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                      : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)";

                  return (
                    <li
                      key={step.id}
                      className="relative min-w-0 flex-1"
                      style={{ zIndex: isActive ? 20 : pipeline.length - index }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(step.id)}
                        aria-current={isActive ? "step" : undefined}
                        className={[
                          "flex h-full w-full flex-col items-center justify-center gap-0.5 px-3 py-3.5 text-center transition-colors sm:px-4",
                          isActive
                            ? "bg-[#007bff] text-white"
                            : hasActivity
                              ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                          isFirst && isLast ? "rounded-xl" : "",
                          isFirst && !isLast ? "rounded-l-xl" : "",
                          isLast && !isFirst ? "rounded-r-xl" : "",
                          !isLast ? "-mr-3 pr-5" : "",
                          !isFirst ? "pl-5" : "",
                        ].join(" ")}
                        style={clip ? { clipPath: clip } : undefined}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="w-full truncate px-0.5 text-xs font-semibold sm:text-sm">
                          <span className="sm:hidden">{meta.shortLabel}</span>
                          <span className="hidden sm:inline">{meta.label}</span>
                        </span>
                        {hasActivity ? (
                          <span
                            className={[
                              "mt-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-white text-slate-600",
                            ].join(" ")}
                          >
                            {step.entries.length}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          <section className="px-5 py-6 sm:px-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {activeMeta.label}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {activeMeta.description}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 tabular-nums">
                {activeEntries.length} event
                {activeEntries.length === 1 ? "" : "s"}
              </span>
            </div>

            {activeEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No activity in this stage yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Events will show here when work happens on{" "}
                  {activeMeta.label.toLowerCase()}.
                </p>
              </div>
            ) : (
              <ol className="space-y-3">
                {activeEntries.map((entry, index) => {
                  const tone = toneForAction(entry.action);
                  const details = formatAuditDetails(
                    entry.action,
                    entry.newData,
                  );
                  const verb = decisionVerb(entry.action);
                  const note =
                    entry.reason?.trim() ||
                    (typeof entry.newData?.note === "string"
                      ? entry.newData.note.trim()
                      : "") ||
                    (typeof entry.newData?.reviewerReason === "string"
                      ? entry.newData.reviewerReason.trim()
                      : "") ||
                    null;

                  return (
                    <li key={entry.id}>
                      <article className="rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-slate-300">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone.badge}`}
                          >
                            {formatAuditAction(entry.action)}
                          </span>
                          {index === 0 ? (
                            <span className="text-[11px] font-medium text-slate-400">
                              Most recent
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-start gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.iconBg}`}
                            title={actorName(entry)}
                          >
                            {actorInitials(entry)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              {verb ?? "Performed by"}
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {actorName(entry)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              <time
                                dateTime={new Date(
                                  entry.createdAt,
                                ).toISOString()}
                              >
                                {formatWhen(entry.createdAt)}
                              </time>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span>{formatRelative(entry.createdAt)}</span>
                            </p>
                          </div>
                        </div>

                        {(details || note) && (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                            {details ? (
                              <p className="text-sm leading-relaxed text-slate-600">
                                {details}
                              </p>
                            ) : null}
                            {note ? (
                              <blockquote className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700/80">
                                  Note
                                </p>
                                <p className="whitespace-pre-wrap leading-relaxed">
                                  {note}
                                </p>
                              </blockquote>
                            ) : null}
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </DashCard>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function groupByStep(entries: AuditLogView[]): StepBucket[] {
  const buckets = new Map<AuditStepGroupId, AuditLogView[]>();
  for (const id of Object.keys(STEP_META) as AuditStepGroupId[]) {
    buckets.set(id, []);
  }
  for (const entry of entries) {
    const id = getAuditStepGroup(entry.action);
    const list = buckets.get(id);
    if (list) list.push(entry);
  }

  return (Object.keys(STEP_META) as AuditStepGroupId[])
    .sort((a, b) => STEP_META[a].order - STEP_META[b].order)
    .map((id) => ({
      id,
      entries: buckets.get(id) ?? [],
    }));
}

function HistoryIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>History</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
