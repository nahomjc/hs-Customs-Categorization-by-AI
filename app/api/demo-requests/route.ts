import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { demoRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  isDemoRequestStatus,
  type DemoRequestStatus,
} from "@/lib/demo-requests/constants";
import { listDemoRequests } from "@/lib/demo-requests/queries";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Admin list of landing-page demo leads. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.trim() || undefined;
  const statusRaw = params.get("status")?.trim() ?? "";
  const status =
    statusRaw && isDemoRequestStatus(statusRaw)
      ? (statusRaw as DemoRequestStatus)
      : "";
  const limit = Number(params.get("limit") ?? 50);
  const offset = Number(params.get("offset") ?? 0);

  try {
    const result = await listDemoRequests({ search, status, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[demo-requests GET]", err);
    return NextResponse.json(
      { error: "Could not load demo requests." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: {
    fullName?: string;
    email?: string;
    company?: string;
    phone?: string;
    jobTitle?: string;
    monthlyVolume?: string;
    message?: string;
    source?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const company = String(body.company ?? "").trim();

  if (!fullName || fullName.length < 2) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 }
    );
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid work email." },
      { status: 400 }
    );
  }
  if (!company || company.length < 2) {
    return NextResponse.json(
      { error: "Please enter your company name." },
      { status: 400 }
    );
  }

  const phone = String(body.phone ?? "").trim() || null;
  const jobTitle = String(body.jobTitle ?? "").trim() || null;
  const monthlyVolume = String(body.monthlyVolume ?? "").trim() || null;
  const message = String(body.message ?? "").trim() || null;
  const source = String(body.source ?? "landing").trim().slice(0, 80) || "landing";

  try {
    const [row] = await db
      .insert(demoRequests)
      .values({
        fullName,
        email,
        company,
        phone,
        jobTitle,
        monthlyVolume,
        message,
        source,
        status: "new",
      })
      .returning({ id: demoRequests.id });

    return NextResponse.json({ ok: true, id: row?.id });
  } catch (err) {
    console.error("[demo-requests POST]", err);
    return NextResponse.json(
      { error: "Could not save your request. Please try again." },
      { status: 500 }
    );
  }
}
