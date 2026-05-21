import { Inter } from "next/font/google";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { UserMenu } from "@/components/auth/UserMenu";
import { ensureUserProfile } from "@/lib/auth/ensure-profile";
import { toUserMenuUser } from "@/lib/auth/user-display";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login?redirect=/account");
  }

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

  return (
    <div
      className={`dashboard-page landing-page min-h-screen flex flex-col ${inter.className}`}
    >
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="landing-container h-14 flex items-center justify-between gap-4">
          <BrandLogo href="/" size="md" className="shrink-0" />
          <UserMenu user={toUserMenuUser(user)} />
        </div>
      </header>
      <main className="landing-container flex-1 py-6 sm:py-8 max-w-[1400px] w-full">
        {children}
      </main>
    </div>
  );
}
