import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-md bg-[var(--background-card)] rounded-2xl shadow-lg border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--dark-bg)] text-[var(--dark-foreground)] px-8 py-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Customs Categorization Portal
          </h1>
          <p className="text-[var(--dark-foreground-muted)] text-sm mt-1">
            Sign in to continue
          </p>
        </div>
        <form className="p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-shadow"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-shadow"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            Login
          </button>
        </form>
        <p className="text-center text-sm text-[var(--foreground)]/70 pb-6">
          <Link
            href="/dashboard"
            className="text-[var(--accent)] hover:underline font-medium"
          >
            Continue to Dashboard (demo)
          </Link>
        </p>
      </div>
    </div>
  );
}
