import { redirect } from "next/navigation";
import { ChannelsSettingsPanel } from "./ChannelsSettingsPanel";
import { getSessionUserProfile } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function ChannelsSettingsPage() {
  const session = await getSessionUserProfile();
  if (session?.profile?.role !== "admin") {
    redirect("/dashboard/settings");
  }
  return <ChannelsSettingsPanel />;
}
