import Link from "next/link";
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

type Density = "default" | "compact";

const densityCell: Record<Density, string> = {
  default: "px-5 py-3.5",
  compact: "px-3 py-2",
};

const densityHead: Record<Density, string> = {
  default: "px-5 py-3",
  compact: "px-3 py-2",
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Scroll wrapper + `<table>` with consistent base styles. */
export function DashTable({
  children,
  className = "",
  tableClassName = "",
}: {
  children: ReactNode;
  className?: string;
  /** Extra classes on the `<table>` (e.g. `min-w-[640px]`, `table-fixed text-xs`). */
  tableClassName?: string;
}) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className={cx("w-full text-sm", tableClassName)}>{children}</table>
    </div>
  );
}

export function DashTableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function DashTableHeaderRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
      {children}
    </tr>
  );
}

type DashThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  density?: Density;
  align?: "left" | "right" | "center";
};

export function DashTh({
  children,
  className = "",
  density = "default",
  align = "left",
  ...rest
}: DashThProps) {
  return (
    <th
      className={cx(
        densityHead[density],
        "text-xs font-semibold uppercase tracking-wider text-gray-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function DashTbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

type DashTrProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function DashTr({ children, className = "", onClick }: DashTrProps) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        "border-t border-gray-50 transition-colors hover:bg-gray-50/60",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

type DashTdProps = TdHTMLAttributes<HTMLTableCellElement> & {
  density?: Density;
  align?: "left" | "right" | "center";
  muted?: boolean;
  nowrap?: boolean;
};

export function DashTd({
  children,
  className = "",
  density = "default",
  align = "left",
  muted = false,
  nowrap = false,
  ...rest
}: DashTdProps) {
  return (
    <td
      className={cx(
        densityCell[density],
        muted ? "text-gray-500" : "text-gray-700",
        align === "right" && "text-right",
        align === "center" && "text-center",
        nowrap && "whitespace-nowrap",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

/** Empty-state row spanning all columns. */
export function DashTableEmpty({
  colSpan,
  children,
  className = "",
}: {
  colSpan: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={cx(
          "px-5 py-16 text-center text-sm text-gray-500",
          className,
        )}
      >
        {children}
      </td>
    </tr>
  );
}

/** Footer bar under a table (pagination, counts). */
export function DashTableFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Consistent primary row action pill (e.g. View). */
export function DashTableAction({
  href,
  children = "View",
  className = "",
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-[#007bff] transition-colors hover:bg-blue-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Toolbar / filter strip above the table inside a DashCard. */
export function DashTableToolbar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "space-y-3 border-b border-gray-100 px-5 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
