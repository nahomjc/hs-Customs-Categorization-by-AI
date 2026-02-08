import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--dark-bg)]/95 backdrop-blur-sm text-[var(--dark-foreground)] border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-semibold text-lg tracking-tight text-[var(--dark-foreground)]"
          >
            HS Portal
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="text-sm text-[var(--dark-foreground-muted)] hover:text-[var(--dark-foreground)] transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium px-4 py-2.5 rounded-lg bg-[var(--accent-light)] text-[var(--dark-bg)] hover:bg-amber-200 transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl w-full">
          <p className="text-sm font-medium text-[var(--accent)] uppercase tracking-wider mb-3">
            Customs Categorization
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--dark-bg)] tracking-tight mb-5">
            HS-code categorization in seconds
          </h1>
          <p className="text-lg text-[var(--foreground)]/80 mb-10 leading-relaxed max-w-xl mx-auto">
            Upload a packing list and get an HS-code grouped file with
            AI-powered classification. Built for customs workflows.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-md shadow-amber-900/10"
            >
              Get started
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-[var(--dark-bg)] text-[var(--dark-bg)] font-semibold hover:bg-[var(--dark-bg)] hover:text-[var(--dark-foreground)] transition-colors"
            >
              Sign in
            </Link>
          </div>
          <ul className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-[var(--foreground)]/70">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              PDF, Word, Excel
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Assessor-style rules
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Export to Excel
            </li>
          </ul>
        </div>
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--background-card)] py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--foreground)]/70">
            HS Portal — AI-powered packing list categorization
          </span>
          <div className="flex gap-6 text-sm">
            <Link
              href="/login"
              className="text-[var(--foreground)]/60 hover:text-[var(--accent)] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="text-[var(--foreground)]/60 hover:text-[var(--accent)] transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
