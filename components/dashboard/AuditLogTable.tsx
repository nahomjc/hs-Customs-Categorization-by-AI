"use client";

import Link from "next/link";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui";
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
  return (
    <DashCard>
      <DashCardHeader title={title} />
      {description ? (
        <p className="px-5 pt-4 text-sm text-slate-500">{description}</p>
      ) : null}
      {entries.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Action</th>
                {showCaseLink ? (
                  <th className="px-5 py-3">Case</th>
                ) : null}
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {entries.map((entry) => {
                const details =
                  formatAuditDetails(entry.action, entry.newData) ??
                  entry.reason ??
                  null;

                return (
                  <tr key={entry.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      {entry.userId ? (
                        <Link
                          href={`/dashboard/users/${entry.userId}`}
                          className="font-medium text-[#007bff] hover:underline"
                        >
                          {formatUser(entry)}
                        </Link>
                      ) : (
                        <span className="text-slate-700">{formatUser(entry)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-900 font-medium">
                      {formatAuditAction(entry.action)}
                    </td>
                    {showCaseLink ? (
                      <td className="px-5 py-3">
                        {entry.importCaseId && entry.caseNumber ? (
                          <Link
                            href={`/dashboard/import-cases/${entry.importCaseId}`}
                            className="font-medium text-[#007bff] hover:underline"
                          >
                            {entry.caseNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-slate-600 max-w-xs">
                      {details ? (
                        <span className="line-clamp-2" title={details}>
                          {details}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashCard>
  );
}
