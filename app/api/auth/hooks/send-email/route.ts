import { NextResponse } from "next/server";

import { handleSendEmailHook } from "@/lib/emails/handle-send-email-hook";

export const runtime = "nodejs";

function headersRecord(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function POST(request: Request) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const rawBody = await request.text();

  try {
    await handleSendEmailHook(rawBody, headersRecord(request));
    return NextResponse.json({});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send auth email";
    console.error("[send-email-hook]", error);
    return NextResponse.json(
      { error: { message } },
      { status: message.includes("verify") ? 401 : 500 }
    );
  }
}
