import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customs Categorization Portal",
  description: "AI-powered packing list categorization by HS code",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)]">
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
