import { Inter } from "next/font/google";
import { CtaSection } from "@/components/landing/CtaSection";
import { DashboardPreviewSection } from "@/components/landing/DashboardPreviewSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { PricingSection } from "@/components/landing/PricingSection";
import { SolutionsSection } from "@/components/landing/SolutionsSection";
import { TelegramMonitoringSection } from "@/components/landing/TelegramMonitoringSection";
import { toUserMenuUser } from "@/lib/auth/user-display";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={`landing-page w-full min-h-screen flex flex-col ${inter.className}`}>
      <LandingNav user={user ? toUserMenuUser(user) : null} />
      <main className="w-full">
        <HeroSection />
        <DashboardPreviewSection />
        <FeaturesSection />
        <TelegramMonitoringSection />
        <HowItWorksSection />
        <SolutionsSection />
        <PricingSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
