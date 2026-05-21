import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Page not found — Impact Logistics",
  description: "The page you are looking for does not exist or has been moved.",
};

export default async function NotFound() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={`landing-page min-h-screen flex flex-col ${inter.className}`}>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="landing-container h-14 flex items-center justify-between">
          <BrandLogo href="/" size="md" />
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 landing-dot-grid flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-lg text-center">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#007bff] mb-4">
            Error 404
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Page not found
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-500 leading-relaxed">
            The link may be broken, or the page may have been removed. Check the
            URL or head back to a known page.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center min-w-[160px] px-6 py-3 rounded-lg bg-[#007bff] text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors shadow-sm"
            >
              Back to home
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center min-w-[160px] px-6 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Go to dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center min-w-[160px] px-6 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>

          <p className="mt-12 text-sm text-gray-400">
            Need help?{" "}
            <Link href="/demo" className="text-[#007bff] hover:underline font-medium">
              Request a demo
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
