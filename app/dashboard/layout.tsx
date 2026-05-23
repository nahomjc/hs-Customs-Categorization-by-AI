import { Inter } from "next/font/google";
import { BrandLogo } from "@/components/BrandLogo";
import { DashboardAssistantChat } from "@/components/dashboard/DashboardAssistantChat";
import { DashboardSidebarShell } from "@/components/dashboard/DashboardSidebarShell";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { toUserMenuUser } from "@/lib/auth/user-display";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "./DashboardNav";

const inter = Inter({ subsets: ["latin"], display: "swap" });

/** Server actions invoked from dashboard routes (parse/classify). */
export const maxDuration = 300;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      await ensureUserProfile({
        id: user.id,
        email: user.email,
        fullName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      });
    } catch (err) {
      console.error("ensureUserProfile:", err);
    }
  }

  return (
    <div
      className={`dashboard-page landing-page min-h-screen flex flex-col ${inter.className}`}
    >
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="landing-container h-14 flex items-center justify-between gap-4">
          <BrandLogo href="/" size="md" className="shrink-0" />
          {user ? <DashboardNav user={toUserMenuUser(user)} /> : null}
        </div>
      </header>
      <div className="landing-container flex-1 py-6 sm:py-8 max-w-[1400px] flex gap-6 lg:gap-8 items-start">
        <DashboardSidebarShell />
        <main className="flex-1 min-w-0 w-full">{children}</main>
      </div>
      <DashboardAssistantChat />
    </div>
  );
}
