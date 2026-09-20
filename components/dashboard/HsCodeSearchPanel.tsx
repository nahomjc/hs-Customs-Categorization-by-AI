"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DashButton,
  DashCard,
  DashCardHeader,
  PageHeader,
  StatusBadge,
  dashInputClass,
} from "@/components/dashboard/ui";
import { DISCLAIMER } from "@/lib/hs-code-search/schemas";
import type {
  HsCodeCandidate,
  HsCodeSearchResult,
  ProductAttributes,
} from "@/lib/hs-code-search/schemas";

type HistoryItem = {
  id: string;
  queryText: string;
  resultsCount: number;
  topHsCodeSuggested: string | null;
  topConfidenceScore: number | null;
  createdAt: string | Date;
};

const EMPTY_ATTRIBUTES: ProductAttributes = {
  productName: null,
  productType: null,
  material: null,
  function: null,
  powerWatts: null,
  voltage: null,
  useCase: null,
  condition: null,
  brand: null,
  model: null,
  otherAttributes: null,
  missingInformation: [],
};

function confidenceBadgeStatus(level: string): string {
  if (level === "high") return "completed";
  if (level === "medium") return "warning";
  return "pending";
}

function formatWhen(d: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function HsCodeSearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HsCodeSearchResult | null>(null);
  const [attributes, setAttributes] =
    useState<ProductAttributes>(EMPTY_ATTRIBUTES);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/dashboard/hs-code-search?limit=8");
      if (!res.ok) return;
      const data = (await res.json()) as { history: HistoryItem[] };
      setHistory(data.history ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function runSearch(options?: {
    queryOverride?: string;
    attributesOverride?: ProductAttributes;
  }) {
    const q = (options?.queryOverride ?? query).trim();
    if (!q) {
      toast.error("Enter a product description");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/hs-code-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          limit: 5,
          attributesOverride: options?.attributesOverride,
        }),
      });
      const data = (await res.json()) as HsCodeSearchResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Search failed");

      setQuery(q);
      setResult(data);
      setAttributes(data.extractedAttributes);
      toast.success(
        data.candidates.length > 0
          ? `Found ${data.candidates.length} suggested HS code(s)`
          : "No strong HS matches — check tariff coverage",
      );
      void loadHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function updateAttr<K extends keyof ProductAttributes>(
    key: K,
    value: ProductAttributes[K],
  ) {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HS code search"
        description="Type a natural-language product description to get suggested HS codes with confidence scores. Decision support only — not a final customs classification."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tools" },
          { label: "HS code search" },
        ]}
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-950">
        <p className="font-semibold text-amber-900">Reviewer notice</p>
        <p className="mt-1 leading-relaxed text-amber-900/90">{DISCLAIMER}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6 min-w-0">
          <DashCard>
            <DashCardHeader title="Product description" />
            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="sr-only">Product description</span>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={4}
                  placeholder="Enter product description (e.g., “men’s cotton T-shirt”, “LED bulb 9W for home lighting”)"
                  className={`${dashInputClass} min-h-28 resize-y`}
                  disabled={loading}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <DashButton
                  type="button"
                  variant="primary"
                  disabled={loading || !query.trim()}
                  onClick={() => void runSearch()}
                >
                  {loading ? "Searching…" : "Search HS codes"}
                </DashButton>
                {result ? (
                  <DashButton
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => {
                      setResult(null);
                      setAttributes(EMPTY_ATTRIBUTES);
                    }}
                  >
                    Clear results
                  </DashButton>
                ) : null}
              </div>
            </div>
          </DashCard>

          {result ? (
            <>
              <AttributesEditor
                attributes={attributes}
                loading={loading}
                onChange={updateAttr}
                onMissingChange={(text) =>
                  updateAttr(
                    "missingInformation",
                    text
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  )
                }
                onRerun={() =>
                  void runSearch({ attributesOverride: attributes })
                }
              />

              <CandidatesList
                candidates={result.candidates}
                productSummary={result.productSummary}
              />
            </>
          ) : null}
        </div>

        <aside className="space-y-4">
          <DashCard>
            <DashCardHeader title="Recent searches" />
            <div className="px-4 py-3">
              {historyLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Your recent searches will appear here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          void runSearch({ queryOverride: item.queryText })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <p className="line-clamp-2 text-sm font-medium text-slate-900">
                          {item.queryText}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatWhen(item.createdAt)}
                          {item.topHsCodeSuggested
                            ? ` · HS ${item.topHsCodeSuggested}`
                            : ""}
                          {item.topConfidenceScore != null
                            ? ` · ${Math.round(item.topConfidenceScore * 100)}%`
                            : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DashCard>
        </aside>
      </div>
    </div>
  );
}

function AttributesEditor({
  attributes,
  loading,
  onChange,
  onMissingChange,
  onRerun,
}: {
  attributes: ProductAttributes;
  loading: boolean;
  onChange: <K extends keyof ProductAttributes>(
    key: K,
    value: ProductAttributes[K],
  ) => void;
  onMissingChange: (text: string) => void;
  onRerun: () => void;
}) {
  const fields: Array<{
    key: keyof ProductAttributes;
    label: string;
    type?: "number";
  }> = [
    { key: "productName", label: "Product name" },
    { key: "productType", label: "Product type" },
    { key: "material", label: "Material" },
    { key: "function", label: "Function" },
    { key: "powerWatts", label: "Power (W)", type: "number" },
    { key: "voltage", label: "Voltage" },
    { key: "useCase", label: "Use case" },
    { key: "condition", label: "Condition" },
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "otherAttributes", label: "Other" },
  ];

  return (
    <DashCard>
      <DashCardHeader
        title="Extracted attributes"
        action={
          <DashButton
            type="button"
            variant="secondary"
            className="text-xs px-3 py-2"
            disabled={loading}
            onClick={onRerun}
          >
            {loading ? "Re-running…" : "Re-run with corrections"}
          </DashButton>
        }
      />
      <div className="px-5 py-5 space-y-4">
        <p className="text-xs text-slate-500">
          Correct any field, then re-run search. Suggestions remain for reviewer
          approval only.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map(({ key, label, type }) => (
            <label key={key} className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </span>
              <input
                type={type === "number" ? "number" : "text"}
                className={dashInputClass}
                disabled={loading}
                value={
                  attributes[key] == null || Array.isArray(attributes[key])
                    ? ""
                    : String(attributes[key])
                }
                onChange={(e) => {
                  if (type === "number") {
                    const n = e.target.value.trim();
                    onChange(
                      key,
                      (n === "" ? null : Number(n)) as ProductAttributes[typeof key],
                    );
                    return;
                  }
                  onChange(
                    key,
                    (e.target.value.trim() === ""
                      ? null
                      : e.target.value) as ProductAttributes[typeof key],
                  );
                }}
              />
            </label>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Missing information (one per line)
          </span>
          <textarea
            className={`${dashInputClass} min-h-20 resize-y`}
            disabled={loading}
            value={attributes.missingInformation.join("\n")}
            onChange={(e) => onMissingChange(e.target.value)}
          />
        </label>
      </div>
    </DashCard>
  );
}

function CandidatesList({
  candidates,
  productSummary,
}: {
  candidates: HsCodeCandidate[];
  productSummary: string;
}) {
  if (candidates.length === 0) {
    return (
      <DashCard>
        <div className="px-5 py-10 text-center">
          <p className="font-semibold text-slate-800">No suggested HS codes</p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            The tariff reference may lack matching chapters, or the description
            needs more detail. Upload a fuller HS reference book or refine the
            attributes above.
          </p>
        </div>
      </DashCard>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Suggested HS codes
        </h2>
        {productSummary ? (
          <p className="mt-1 text-sm text-slate-500">{productSummary}</p>
        ) : null}
      </div>
      {candidates.map((c) => (
        <CandidateCard key={`${c.rank}-${c.hsCode}`} candidate={c} />
      ))}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: HsCodeCandidate }) {
  const pct = Math.round(candidate.confidenceScore * 100);
  const actionLabel: Record<string, string> = {
    approve: "Suggested reviewer action: approve",
    request_more_information: "Suggested reviewer action: request more info",
    expert_review: "Suggested reviewer action: expert review",
  };

  return (
    <DashCard>
      <div className="px-5 py-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              {candidate.rank}
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                {candidate.hsCode}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">
                {candidate.officialDescription}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={`${pct}% confidence`}
              status={confidenceBadgeStatus(candidate.confidenceLevel)}
            />
            <StatusBadge
              label={candidate.confidenceLevel}
              status={confidenceBadgeStatus(candidate.confidenceLevel)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Reasoning
          </p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {candidate.reasoning}
          </p>
        </div>

        {candidate.missingInformation.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Missing information
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
              {candidate.missingInformation.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs font-medium text-slate-500">
          {actionLabel[candidate.recommendedReviewerAction] ??
            candidate.recommendedReviewerAction}
        </p>
      </div>
    </DashCard>
  );
}
