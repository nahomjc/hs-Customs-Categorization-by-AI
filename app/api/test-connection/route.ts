import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { success: false, message: "DATABASE_URL is not set" },
      { status: 500 }
    );
  }

  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({
      success: true,
      message: "Database connection OK",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { success: false, message: "Connection failed", error: message },
      { status: 500 }
    );
  }
}
