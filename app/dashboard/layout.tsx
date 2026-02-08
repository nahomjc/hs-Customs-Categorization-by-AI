import Link from "next/link";
import { DashboardNav } from "./DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 bg-[var(--dark-bg)] text-[var(--dark-foreground)] border-b border-white/5 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg tracking-tight text-[var(--dark-foreground)]"
          >
            <span className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] font-bold text-sm">
              HS
            </span>
            HS Portal
          </Link>
          <DashboardNav />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
