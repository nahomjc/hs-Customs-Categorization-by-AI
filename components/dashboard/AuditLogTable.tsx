"use client";

import Link from "next/link";
import {
  DashCard,
  DashCardHeader,
  DashTable,
  DashTableEmpty,
  DashTableHead,
  DashTableHeaderRow,
  DashTbody,
  DashTd,
  DashTh,
  DashTr,
} from "@/components/dashboard/ui";
import {
  formatAuditAction,
  formatAuditDetails,
} from "@/lib/import-cases/audit-labels";
import type { AuditLogView } from "@/lib/import-cases/audit-queries";

function formatDate(d: Date) {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatUser(entry: AuditLogView): string {
  if (entry.userFullName?.trim()) return entry.userFullName.trim();
  if (entry.userEmail) return entry.userEmail;
  return "System";
}

type AuditLogTableProps = {
  title?: string;
  description?: string;
  entries: AuditLogView[];
  /** Show link to import case when viewing a user's activity log. */
  showCaseLink?: boolean;
  emptyMessage?: string;
};

export function AuditLogTable({
  title = "Activity log",
  description,
  entries,
  showCaseLink = false,
  emptyMessage = "No activity recorded yet.",
}: AuditLogTableProps) {
  const colSpan = showCaseLink ? 5 : 4;

  return (
    <DashCard>
      <DashCardHeader title={title} />
      {description ? (
        <p className="px-5 pt-4 text-sm text-gray-500">{description}</p>
      ) : null}
      <DashTable>
        <DashTableHead>
          <DashTableHeaderRow>
            <DashTh>When</DashTh>
            <DashTh>User</DashTh>
            <DashTh>Action</DashTh>
            {showCaseLink ? <DashTh>Case</DashTh> : null}
            <DashTh>Details</DashTh>
          </DashTableHeaderRow>
        </DashTableHead>
        <DashTbody>
          {entries.length === 0 ? (
            <DashTableEmpty colSpan={colSpan}>{emptyMessage}</DashTableEmpty>
          ) : (
            entries.map((entry) => {
              const details =
                formatAuditDetails(entry.action, entry.newData) ??
                entry.reason ??
                null;

              return (
                <DashTr key={entry.id}>
                  <DashTd muted nowrap>
                    {formatDate(entry.createdAt)}
                  </DashTd>
                  <DashTd>
                    {entry.userId ? (
                      <Link
                        href={`/dashboard/users/${entry.userId}`}
                        className="font-medium text-[#007bff] hover:underline"
                      >
                        {formatUser(entry)}
                      </Link>
                    ) : (
                      <span className="text-gray-700">{formatUser(entry)}</span>
                    )}
                  </DashTd>
                  <DashTd className="font-medium text-gray-900">
                    {formatAuditAction(entry.action)}
                  </DashTd>
                  {showCaseLink ? (
                    <DashTd>
                      {entry.importCaseId && entry.caseNumber ? (
                        <Link
                          href={`/dashboard/import-cases/${entry.importCaseId}`}
                          className="font-medium text-[#007bff] hover:underline"
                        >
                          {entry.caseNumber}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </DashTd>
                  ) : null}
                  <DashTd muted className="max-w-xs">
                    {details ? (
                      <span className="line-clamp-2" title={details}>
                        {details}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </DashTd>
                </DashTr>
              );
            })
          )}
        </DashTbody>
      </DashTable>
    </DashCard>
  );
}
