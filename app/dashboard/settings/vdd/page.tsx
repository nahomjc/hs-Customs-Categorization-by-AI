import { redirect } from "next/navigation";

export default function VddSettingsPage() {
  redirect("/dashboard/settings?tab=vdd");
}
