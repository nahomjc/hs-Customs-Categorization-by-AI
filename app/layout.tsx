import type { Metadata } from "next";
import { IntroLoader } from "@/components/IntroLoader";
import { NavigationProgress } from "@/components/NavigationProgress";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Impact Logistics — HS Code Categorization",
  description: "AI-powered packing list categorization by HS code for customs teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased w-full min-w-0 bg-[var(--background)] text-[var(--foreground)]">
        <NavigationProgress />
        <IntroLoader />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--background-card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
            classNames: {
              success: "border-emerald-500/50 bg-emerald-50",
              error: "border-red-500/50 bg-red-50",
            },
          }}
        />
      </body>
    </html>
  );
}
