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
  { label: string; description: string; order: number }
> = {
  "case-info": {
    label: "Case info",
    description: "Case created and shipment details updated",
    order: 1,
  },
  documents: {
    label: "Documents",
    description: "Uploads, replacements, deletions, and extraction",
    order: 2,
  },
  "invoice-lines": {
    label: "Invoice lines",
    description: "Line review, corrections, and bulk decisions",
    order: 3,
  },
  "packing-lines": {
    label: "Packing list lines",
    description: "Line review, corrections, and bulk decisions",
    order: 4,
  },
  checks: {
    label: "Checks",
    description: "Validation warnings resolved or overridden",
    order: 5,
  },
  products: {
    label: "Harmonized products",
    description: "Matching, verification, and product edits",
    order: 6,
  },
  classification: {
    label: "HS classification",
    description: "Suggestions, AI requests, and approvals",
    order: 7,
  },
  "grouping-export": {
    label: "Grouping & export",
    description: "Declaration groups and export reports",
    order: 8,
  },
  other: {
    label: "Other activity",
    description: "Additional case events",
    order: 9,
  },
};

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
    dot: "bg-[#2563eb]",
    badge: "bg-blue-50 text-blue-700 ring-blue-100",
    iconBg: "bg-blue-50 text-blue-700",
  };
}

type CaseHistoryPanelProps = {
  entries: AuditLogView[];
  caseNumber?: string | null;
};

export function CaseHistoryPanel({
  entries,
  caseNumber,
}: CaseHistoryPanelProps) {
  const grouped = groupByStep(entries);
  const uniqueActors = new Set(
    entries.map((e) => e.userId ?? e.userEmail ?? "system"),
  ).size;

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

      <div className="border-b border-slate-100 bg-linear-to-r from-slate-50/80 to-white px-5 py-4 sm:px-6">
        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          Chronological record of what happened on
          {caseNumber ? (
            <>
              {" "}
              <span className="font-semibold text-slate-800">{caseNumber}</span>
            </>
          ) : (
            " this case"
          )}
          — who approved, overrode, uploaded, or classified, with timestamps and
          notes.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryStat label="Events" value={String(entries.length)} />
          <SummaryStat label="People" value={String(uniqueActors)} />
          <SummaryStat
            label="Steps touched"
            value={String(grouped.filter((g) => g.entries.length > 0).length)}
          />
          <SummaryStat
            label="Latest"
            value={
              entries[0] ? formatRelative(entries[0].createdAt) : "—"
            }
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-14 text-center sm:px-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <HistoryIcon />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            No history yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Activity from each workflow step will appear here as the case
            progresses.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {grouped.map((group) => {
            if (group.entries.length === 0) return null;
            const meta = STEP_META[group.id];
            return (
              <section key={group.id} className="px-5 py-6 sm:px-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                        {meta.order}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {meta.label}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 pl-8">
                      {meta.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
                    {group.entries.length}
                  </span>
                </div>

                <ol className="relative ml-3 border-l border-slate-200 pl-6 sm:ml-4">
                  {group.entries.map((entry, index) => {
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
                      <li key={entry.id} className="relative pb-5 last:pb-0">
                        <span
                          className={`absolute -left-6 top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-white ${tone.dot}`}
                          aria-hidden
                        />
                        <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-100/50 transition hover:border-slate-300 hover:shadow-md">
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
                              {verb ? (
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                  {verb}
                                </p>
                              ) : (
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                  Performed by
                                </p>
                              )}
                              <p className="text-sm font-semibold text-slate-900 truncate">
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
                                <p className="text-sm text-slate-600 leading-relaxed">
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
              </section>
            );
          })}
        </div>
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
      <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

function groupByStep(entries: AuditLogView[]) {
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
