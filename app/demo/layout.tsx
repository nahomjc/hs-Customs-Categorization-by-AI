import { Inter } from "next/font/google";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`landing-page auth-page min-h-screen flex flex-col ${inter.className}`}>
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
      <main className="flex-1 landing-dot-grid flex items-center justify-center py-10 sm:py-14 px-4">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
