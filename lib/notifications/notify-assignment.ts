import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs, notifications, users } from "@/db/schema";
import { getUserPreferences } from "@/lib/settings/user-settings";
import { getTenantChannelSettings } from "@/lib/notifications/channel-settings";
import { sendTenantSms } from "@/lib/notifications/send-tenant-sms";

export async function notifyImportCaseAssignment(params: {
  tenantId: string;
  importCaseId: string;
  caseNumber: string;
  assigneeUserId: string;
}) {
  const [assignee] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.assigneeUserId))
    .limit(1);

  if (!assignee) return;

  const prefs = await getUserPreferences(assignee.id);
  const channels = await getTenantChannelSettings(params.tenantId);
  const title = `Assigned: ${params.caseNumber}`;
  const body = `You were assigned import case ${params.caseNumber}.`;

  if (prefs.notifyDashboard) {
    try {
      await db.insert(notifications).values({
        tenantId: params.tenantId,
        userId: assignee.id,
        importCaseId: params.importCaseId,
        title,
        body,
        meta: { caseNumber: params.caseNumber, type: "case_assignment" },
      });
      await db.insert(notificationLogs).values({
        tenantId: params.tenantId,
        importCaseId: params.importCaseId,
        userId: assignee.id,
        channel: "dashboard",
        status: "sent",
        payloadSnippet: body.slice(0, 500),
      });
    } catch (error) {
      await db.insert(notificationLogs).values({
        tenantId: params.tenantId,
        importCaseId: params.importCaseId,
        userId: assignee.id,
        channel: "dashboard",
        status: "failed",
        payloadSnippet: body.slice(0, 500),
        error:
          error instanceof Error ? error.message : "dashboard notify failed",
      });
    }
  }

  if (assignee.phone) {
    const smsText = `Impact: assigned case ${params.caseNumber}.`.slice(0, 160);
    const result = await sendTenantSms({
      tenantId: params.tenantId,
      phone: assignee.phone,
      text: smsText,
      settings: channels,
    });
    await db.insert(notificationLogs).values({
      tenantId: params.tenantId,
      importCaseId: params.importCaseId,
      userId: assignee.id,
      channel: "sms",
      status: result.ok ? "sent" : "failed",
      payloadSnippet: smsText,
      error: result.error ?? null,
    });
  }
}
