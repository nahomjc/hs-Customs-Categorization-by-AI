import Link from "next/link";
import type { ReactNode } from "react";

export const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-700",
  parsed: "bg-amber-100 text-amber-800",
  ai_processed: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  draft: "bg-slate-100 text-slate-700",
  documents_uploaded: "bg-sky-100 text-sky-800",
  extraction_in_progress: "bg-amber-100 text-amber-800",
  needs_information: "bg-orange-100 text-orange-800",
  ready_for_classification: "bg-indigo-100 text-indigo-800",
  classification_in_review: "bg-violet-100 text-violet-800",
  ready_for_declaration: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  processing: "bg-amber-100 text-amber-800",
  extracted: "bg-blue-100 text-blue-800",
  needs_review: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  pending: "bg-slate-100 text-slate-600",
  reviewed: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  open: "bg-orange-100 text-orange-800",
  resolved: "bg-emerald-100 text-emerald-800",
  ignored: "bg-slate-100 text-slate-500",
  // Client shipment tracking
  received: "bg-slate-100 text-slate-700",
  documents_in_progress: "bg-sky-100 text-sky-800",
  classification: "bg-indigo-100 text-indigo-800",
  customs_clearance: "bg-amber-100 text-amber-800",
  ready_for_pickup: "bg-orange-100 text-orange-800",
  delivered: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({
  label,
  status,
}: {
  label: string;
  status?: string | null;
}) {
  const key = status ?? "uploaded";
  const styles = STATUS_STYLES[key] ?? STATUS_STYLES.uploaded;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

/** Single-line truncation with native browser tooltip on hover. */
export function TruncatedText({
  text,
  className = "",
  title,
}: {
  text: string;
  className?: string;
  /** Defaults to full `text` when truncated content may be clipped. */
  title?: string;
}) {
  const tooltip = title ?? text;
  return (
    <span
      title={tooltip}
      className={`block truncate ${className}`}
    >
      {text}
    </span>
  );
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-xs text-slate-500 min-w-0 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-2 min-w-0"
            >
              {index > 0 ? (
                <span className="text-slate-300" aria-hidden>
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-indigo-600 transition-colors shrink-0"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-slate-700 font-medium truncate"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-gray-500 text-sm sm:text-base">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number | string;
  accent?: "default" | "green" | "blue";
}) {
  const valueColor =
    accent === "green"
      ? "text-emerald-600"
      : accent === "blue"
        ? "text-[#007bff]"
        : "text-gray-900";

  return (
    <div className="landing-float-card bg-white rounded-2xl p-5 sm:p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl sm:text-3xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

export function DashCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/70 bg-white overflow-hidden shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}

export function DashCardHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
      <h2 className="font-bold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

export function DashButton({
  href,
  onClick,
  children,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-indigo-500/25 shadow-md shadow-indigo-500/20",
    secondary:
      "px-5 py-2.5 rounded-full border border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
    ghost:
      "px-3 py-1.5 rounded-lg text-[#007bff] bg-blue-50 hover:bg-blue-100",
  };
  const cls = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function DashLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium text-[#007bff] hover:text-[#0069d9] hover:underline ${className}`}
    >
      {children}
    </Link>
  );
}

export const dashInputClass =
  "w-full py-2 pl-9 pr-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

export const dashSelectClass =
  "py-2 pl-3 pr-8 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

export {
  DashTable,
  DashTableHead,
  DashTableHeaderRow,
  DashTh,
  DashTbody,
  DashTr,
  DashTd,
  DashTableEmpty,
  DashTableFooter,
  DashTableAction,
  DashTableToolbar,
} from "./DashTable";