import { Inter } from "next/font/google";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ClientNotificationBell } from "@/components/dashboard/client/ClientNotificationBell";
import { DashboardAssistantChat } from "@/components/dashboard/DashboardAssistantChat";
import { DashboardSidebarShell } from "@/components/dashboard/DashboardSidebarShell";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import {
  mustChangePasswordFromMeta,
  SET_PASSWORD_PATH,
} from "@/lib/auth/must-change-password";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { isClientRole } from "@/lib/auth/roles";
import { toUserMenuUser } from "@/lib/auth/user-display";
import { getAuthUser } from "@/lib/auth/session";
import { listClientNotifications } from "@/lib/dashboard/client-shipments";
import { DashboardNav } from "./DashboardNav";

const inter = Inter({ subsets: ["latin"], display: "swap" });

/** Server actions invoked from dashboard routes (parse/classify). */
export const maxDuration = 300;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user?.email) {
    redirect("/login?redirect=/dashboard");
  }

  const profileSession = await getSessionUserProfile();

  if (
    profileSession?.profile &&
    mustChangePasswordFromMeta(profileSession.profile.meta)
  ) {
    redirect(SET_PASSWORD_PATH);
  }

  if (user?.email) {
    try {
      await ensureUserProfile({
        id: user.id,
        email: user.email,
        fullName: user.name ?? null,
        avatarUrl: user.image ?? null,
      });
    } catch (err) {
      console.error("ensureUserProfile:", err);
    }
  }

  const isClient = isClientRole(profileSession?.profile?.role);
  const clientNotifications =
    isClient && user?.id
      ? await listClientNotifications(user.id, 12)
      : [];

  return (
    <div
      className={`dashboard-page landing-page min-h-screen flex flex-col ${inter.className}`}
    >
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/40">
        <div className="dashboard-container h-14 flex items-center justify-between gap-4">
          <BrandLogo href="/" size="md" className="shrink-0" />
          {user ? (
            <div className="flex items-center gap-2">
              {isClient ? (
                <ClientNotificationBell initialItems={clientNotifications} />
              ) : null}
              <DashboardNav
                user={toUserMenuUser(user, profileSession?.profile)}
              />
            </div>
          ) : null}
        </div>
      </header>
      <div className="dashboard-container flex-1 py-6 sm:py-8 flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
        <DashboardSidebarShell />
        <main className="flex-1 min-w-0 w-full pb-[var(--dashboard-fab-bottom)]">
          {children}
        </main>
      </div>
      {profileSession?.profile?.role !== "client" ? (
        <Suspense fallback={null}>
          <DashboardAssistantChat />
        </Suspense>
      ) : null}
    </div>
  );
}
