import { redirect } from "next/navigation";

export default function ChannelsSettingsPage() {
  redirect("/dashboard/settings?tab=channels");
}
