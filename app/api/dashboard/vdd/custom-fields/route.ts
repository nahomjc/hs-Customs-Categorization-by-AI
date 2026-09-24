import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vddCustomFields } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { slugifyVddFieldKey } from "@/lib/vdd/fingerprint";
import { z } from "zod";
import { validationErrorResponse } from "@/lib/import-cases/api-helpers";

export const runtime = "nodejs";

const createSchema = z.object({
  label: z.string().trim().min(1).max(150),
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, underscores")
    .optional(),
  valueType: z.enum(["text", "number"]).optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const tenantId = admin.session.profile.tenantId ?? DEFAULT_TENANT_ID;
  const rows = await db
    .select()
    .from(vddCustomFields)
    .where(eq(vddCustomFields.tenantId, tenantId))
    .orderBy(asc(vddCustomFields.createdAt));

  return NextResponse.json({
    ok: true,
    fields: rows.map((r) => ({
      id: r.id,
      fieldKey: r.fieldKey,
      label: r.label,
      valueType: r.valueType,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const tenantId = admin.session.profile.tenantId ?? DEFAULT_TENANT_ID;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const label = parsed.data.label;
  const fieldKey = parsed.data.fieldKey ?? slugifyVddFieldKey(label);
  const valueType = parsed.data.valueType ?? "text";

  try {
    const [row] = await db
      .insert(vddCustomFields)
      .values({
        tenantId,
        fieldKey,
        label,
        valueType,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      field: {
        id: row.id,
        fieldKey: row.fieldKey,
        label: row.label,
        valueType: row.valueType,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    if (/unique|duplicate/i.test(message)) {
      return NextResponse.json(
        { error: `Custom column "${fieldKey}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const tenantId = admin.session.profile.tenantId ?? DEFAULT_TENANT_ID;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const deleted = await db
    .delete(vddCustomFields)
    .where(
      and(eq(vddCustomFields.id, id), eq(vddCustomFields.tenantId, tenantId)),
    )
    .returning({ id: vddCustomFields.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}
