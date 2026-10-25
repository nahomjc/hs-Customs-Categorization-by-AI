import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import { IntroLoader } from "@/components/IntroLoader";
import { NetworkStatusBar } from "@/components/NetworkStatusBar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { Toaster } from "sonner";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-orbitron",
});

export const metadata: Metadata = {
  title: "Impact Logistics — HS Code Categorization",
  description: "AI-powered packing list categorization by HS code for customs teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={orbitron.variable} data-intro-loading="true">
      <body className="antialiased w-full min-w-0 bg-[var(--background)] text-[var(--foreground)]">
        <NavigationProgress />
        <IntroLoader />
        {children}
        <NetworkStatusBar />
        <Toaster
          position="top-right"
          richColors={false}
          closeButton
          gap={10}
          offset={16}
          visibleToasts={4}
          toastOptions={{
            duration: 5500,
            classNames: {
              toast:
                "group toast !rounded-2xl !border !border-slate-200/80 !bg-white !text-slate-900 !shadow-[0_12px_40px_-12px_rgba(15,23,42,0.28)] !px-4 !py-3.5",
              title: "!text-sm !font-semibold !text-slate-900",
              description: "!text-sm !leading-relaxed !text-slate-600",
              closeButton:
                "!border-slate-200 !bg-white !text-slate-500 hover:!bg-slate-50 hover:!text-slate-800",
              success:
                "!border-emerald-200/90 !bg-emerald-50/95 [&>[data-icon]]:!text-emerald-600",
              error:
                "!border-red-200/90 !bg-red-50/95 [&>[data-icon]]:!text-red-600",
              warning:
                "!border-amber-200/90 !bg-amber-50/95 [&>[data-icon]]:!text-amber-600",
              info: "!border-sky-200/90 !bg-sky-50/95 [&>[data-icon]]:!text-[#007bff]",
            },
          }}
        />
      </body>
    </html>
  );
}
