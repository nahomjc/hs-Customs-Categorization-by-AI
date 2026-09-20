import { z } from "zod";
import { VDD_FIELD_KEYS } from "./column-map";

const vddFieldKeySchema = z.enum(
  VDD_FIELD_KEYS as unknown as [string, ...string[]],
);

/** Partial map: only mapped fields are present (Zod 4 needs partialRecord). */
export const vddColumnMappingsSchema = z
  .partialRecord(vddFieldKeySchema, z.string().min(1))
  .optional();

export const vddPreviewOptionsSchema = z.object({
  sheetName: z.string().min(1).optional(),
  columnMappings: vddColumnMappingsSchema,
  previewLimit: z.coerce.number().int().min(1).max(100).optional(),
});

export const vddImportOptionsSchema = z.object({
  sheetName: z.string().min(1).optional(),
  columnMappings: vddColumnMappingsSchema,
});

export type VddPreviewOptions = z.infer<typeof vddPreviewOptionsSchema>;
export type VddImportOptions = z.infer<typeof vddImportOptionsSchema>;
