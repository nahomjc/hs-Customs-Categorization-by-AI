import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Invalidate the import case detail RSC tree after workflow mutations. */
export function revalidateImportCasePage(caseId: string) {
  revalidatePath(`/dashboard/import-cases/${caseId}`);
}

export function importCaseJson<T>(caseId: string, body: T, init?: ResponseInit) {
  revalidateImportCasePage(caseId);
  return NextResponse.json(body, init);
}
