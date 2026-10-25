export const DEMO_REQUEST_STATUSES = [
  "new",
  "contacted",
  "scheduled",
  "closed",
] as const;

export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const DEMO_REQUEST_STATUS_LABELS: Record<DemoRequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  closed: "Closed",
};

export function isDemoRequestStatus(value: string): value is DemoRequestStatus {
  return (DEMO_REQUEST_STATUSES as readonly string[]).includes(value);
}
