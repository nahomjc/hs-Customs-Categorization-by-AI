"use client";

import { useEffect, useState } from "react";
import {
  BentoCard,
  BentoCardHeader,
  KpiRingTile,
  KpiTile,
  PeriodPill,
  PromoBanner,
  promoButtonClass,
} from "@/components/dashboard/bento/BentoCard";
import {
  BENTO_COLORS,
  RingChart,
  RingLegend,
} from "@/components/dashboard/bento/charts";
import { BentoIcon } from "@/components/dashboard/bento/icons";
import { formatBytes } from "@/lib/formatBytes";
import type { ChapterNotesSummary } from "@/lib/hs-chapter-notes-schema";

export type HsReferenceStats = {
  rowCount: number;
  chapters: string[];
  chapterRange: string | null;
  lastImportedAt: string | null;
  storageBytes: number;
};

/** The HS nomenclature has 97 chapters (98-99 are reserved for national use). */
const HS_CHAPTER_COUNT = 97;

function formatImportedAt(value: string | null | undefined): string {
  if (!value) return "Not imported yet";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type NotesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; total: number; withNotes: number };

export function HsReferenceOverview({
  stats,
  onImport,
}: {
  stats: HsReferenceStats | null;
  onImport: () => void;
}) {
  const [notes, setNotes] = useState<NotesState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/hs-reference/notes");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load notes");
        const list: ChapterNotesSummary[] = data.notes ?? [];
        if (!cancelled) {
          setNotes({
            status: "ready",
            total: list.length,
            withNotes: list.filter((n) => n.hasNotes).length,
          });
        }
      } catch {
        if (!cancelled) setNotes({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadedChapters = (stats?.chapters ?? []).filter((c) => {
    const n = Number.parseInt(c, 10);
    return n >= 1 && n <= HS_CHAPTER_COUNT;
  }).length;

  const notesRows =
    notes.status === "ready"
      ? [
          {
            label: "With notes",
            value: notes.withNotes,
            color: BENTO_COLORS.brand,
          },
          {
            label: "No notes",
            value: Math.max(0, notes.total - notes.withNotes),
            color: BENTO_COLORS.muted,
          },
        ]
      : [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {notes.status === "ready" && notes.total > 0 ? (
        <BentoCard className="lg:col-span-4" label="Chapter notes coverage">
          <BentoCardHeader
            title="Chapter notes"
            action={<PeriodPill>{notes.total} chapters</PeriodPill>}
          />
          <div className="flex justify-center py-2">
            <RingChart
              segments={notesRows}
              centerValue={`${notes.withNotes}`}
              centerLabel="With notes"
              ariaLabel={`${notes.withNotes} of ${notes.total} chapters have notes`}
            />
          </div>
          <div className="mt-4">
            <RingLegend rows={notesRows} />
          </div>
        </BentoCard>
      ) : null}

      <div
        className={`min-w-0 space-y-4 ${
          notes.status === "ready" && notes.total > 0 ? "lg:col-span-8" : "lg:col-span-12"
        }`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KpiTile
            label="Tariff rows"
            value={stats ? stats.rowCount.toLocaleString() : "-"}
            icon="book"
            tone="blue"
            hint="In database"
          />
          <KpiRingTile
            label="Chapters loaded"
            value={stats ? `${loadedChapters}/${HS_CHAPTER_COUNT}` : "-"}
            percent={stats ? (loadedChapters / HS_CHAPTER_COUNT) * 100 : 0}
            tone="indigo"
            hint={stats?.chapterRange ? `Range ${stats.chapterRange}` : "No chapters yet"}
          />
          <KpiTile
            label="Storage"
            value={stats ? formatBytes(stats.storageBytes) : "-"}
            icon="database"
            tone="slate"
            hint="Data + indexes"
          />
          <KpiTile
            label="Last import"
            value={stats?.lastImportedAt ? "Synced" : "-"}
            icon="refresh"
            tone={stats?.lastImportedAt ? "green" : "slate"}
            hint={formatImportedAt(stats?.lastImportedAt)}
          />
        </div>

        <PromoBanner
          title="Keep the tariff reference complete"
          description="Partial books only cover imported chapters. Prefer a full ECC book or ESW tariff list (chapters 01-97) for apparel, furniture, and lighting."
          action={
            <button type="button" onClick={onImport} className={promoButtonClass}>
              <BentoIcon name="upload" className="h-4 w-4" strokeWidth={2} />
              Import tariff book
            </button>
          }
        />
      </div>
    </div>
  );
}
