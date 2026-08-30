import { db } from "@/db";
import { importCases } from "@/db/schema";
import { DEFAULT_TENANT_ID } from "@/lib/auth/constants";
import { and, eq, sql } from "drizzle-orm";

export async function generateCaseNumber(
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IMP-${year}-`;

  const [row] = await db
    .select({
      maxNum: sql<number>`COALESCE(
        MAX(
          CAST(
            NULLIF(SPLIT_PART(${importCases.caseNumber}, '-', 3), '')
            AS INTEGER
          )
        ),
        0
      )`,
    })
    .from(importCases)
    .where(
      and(
        eq(importCases.tenantId, tenantId),
        sql`${importCases.caseNumber} LIKE ${prefix + "%"}`,
      ),
    );

  const nextNum = Number(row?.maxNum ?? 0) + 1;
  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}
