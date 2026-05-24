import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { getAppOrigin } from "@/lib/auth/redirect-origin";
import { sendViaBrevo } from "@/lib/emails/send-via-brevo";
import { eq, or } from "drizzle-orm";
import { getUserPreferences } from "./user-settings";

async function findUploaderUser(documentId: string) {
  const [doc] = await db
    .select({
      uploadedBy: documents.uploadedBy,
      originalFileName: documents.originalFileName,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .where(
      or(
        eq(users.id, doc.uploadedBy),
        eq(users.email, doc.uploadedBy)
      )
    )
    .limit(1);

  if (!user) return { doc, user: null };
  return { doc, user };
}

export async function maybeNotifyDocumentComplete(
  documentId: string
): Promise<void> {
  try {
    const found = await findUploaderUser(documentId);
    if (!found?.user?.email) return;

    const prefs = await getUserPreferences(found.user.id);
    if (!prefs.emailOnComplete) return;

    const name = found.doc.originalFileName ?? "your packing list";
    const link = `${getAppOrigin()}/dashboard/documents/${documentId}`;

    await sendViaBrevo({
      to: found.user.email,
      subject: `Classification complete — ${name}`,
      html: `<p>Hi${found.user.fullName ? ` ${found.user.fullName}` : ""},</p>
<p>Your document <strong>${name}</strong> has finished processing and is ready to review.</p>
<p><a href="${link}">Open document</a></p>`,
    });
  } catch (err) {
    console.error("[notifyDocumentComplete]", err);
  }
}

export async function maybeNotifyDocumentFailed(
  documentId: string,
  reason?: string
): Promise<void> {
  try {
    const found = await findUploaderUser(documentId);
    if (!found?.user?.email) return;

    const prefs = await getUserPreferences(found.user.id);
    if (!prefs.emailOnFailure) return;

    const name = found.doc.originalFileName ?? "your packing list";
    const link = `${getAppOrigin()}/dashboard/documents/${documentId}`;

    await sendViaBrevo({
      to: found.user.email,
      subject: `Processing failed — ${name}`,
      html: `<p>Hi${found.user.fullName ? ` ${found.user.fullName}` : ""},</p>
<p>We could not finish processing <strong>${name}</strong>.</p>
${reason ? `<p>${reason}</p>` : ""}
<p><a href="${link}">View document</a></p>`,
    });
  } catch (err) {
    console.error("[notifyDocumentFailed]", err);
  }
}
