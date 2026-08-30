import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { clampPreferencesForRole } from "@/lib/auth/settings-meta";
import { getSessionUserProfile } from "@/lib/auth/require-admin";
import { fetchAnalytics } from "@/lib/dashboard-analytics";
import { parseAnalyticsRange } from "@/lib/dashboard-analytics-utils";
import { fetchImportCasesAnalytics } from "@/lib/import-cases-analytics";
import { getTenantId } from "@/lib/import-cases/queries";
import { getUserPreferences } from "@/lib/settings/user-settings";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const session = await getSessionUserProfile();
  const defaultPreset =
    session?.authUser?.id != null
      ? clampPreferencesForRole(
          await getUserPreferences(session.authUser.id),
          session?.profile?.role
        ).defaultAnalyticsRange
      : undefined;

  const { from, to, fromKey, toKey } = parseAnalyticsRange(params, {
    defaultPreset,
  });
  const tenantId = getTenantId();
  const [data, importCasesData] = await Promise.all([
    fetchAnalytics(from, to),
    fetchImportCasesAnalytics(tenantId, from, to),
  ]);

  return (
    <AnalyticsView
      fromKey={fromKey}
      toKey={toKey}
      data={data}
      importCasesData={importCasesData}
    />
  );
}
