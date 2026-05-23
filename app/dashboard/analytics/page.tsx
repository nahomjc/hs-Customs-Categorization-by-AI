import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { fetchAnalytics } from "@/lib/dashboard-analytics";
import { parseAnalyticsRange } from "@/lib/dashboard-analytics-utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, fromKey, toKey } = parseAnalyticsRange(params);
  const data = await fetchAnalytics(from, to);

  return <AnalyticsView fromKey={fromKey} toKey={toKey} data={data} />;
}
