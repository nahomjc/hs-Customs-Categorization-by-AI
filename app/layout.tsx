import type { Metadata } from "next";
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
      </body>
    </html>
  );
}
