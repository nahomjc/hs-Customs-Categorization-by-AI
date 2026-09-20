import type { ImportProductRow } from "@/db/schema/importProducts";

export type VddSearchProfile = {
  brand: string | null;
  model: string | null;
  productName: string | null;
  description: string | null;
  productType: string | null;
  material: string | null;
  originCode: string | null;
  unitOfMeasure: string | null;
  condition: string | null;
  unitPrice: number | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function buildSearchProfileFromProduct(
  product: Pick<
    ImportProductRow,
    | "brand"
    | "modelNumber"
    | "productName"
    | "normalizedDescription"
    | "rawDescription"
    | "productType"
    | "material"
    | "countryOfOriginCode"
    | "unitOfMeasure"
    | "unitPrice"
  >,
): VddSearchProfile {
  return {
    brand: trimOrNull(product.brand),
    model: trimOrNull(product.modelNumber),
    productName: trimOrNull(product.productName),
    description: trimOrNull(
      product.normalizedDescription ?? product.rawDescription,
    ),
    productType: trimOrNull(product.productType),
    material: trimOrNull(product.material),
    originCode: trimOrNull(product.countryOfOriginCode)?.toUpperCase() ?? null,
    unitOfMeasure: trimOrNull(product.unitOfMeasure)?.toUpperCase() ?? null,
    condition: null,
    unitPrice:
      product.unitPrice != null && product.unitPrice !== ""
        ? Number(product.unitPrice)
        : null,
  };
}

export function buildSearchProfileFromFields(
  fields: Partial<VddSearchProfile>,
): VddSearchProfile {
  return {
    brand: trimOrNull(fields.brand),
    model: trimOrNull(fields.model),
    productName: trimOrNull(fields.productName),
    description: trimOrNull(fields.description),
    productType: trimOrNull(fields.productType),
    material: trimOrNull(fields.material),
    originCode: trimOrNull(fields.originCode)?.toUpperCase() ?? null,
    unitOfMeasure: trimOrNull(fields.unitOfMeasure)?.toUpperCase() ?? null,
    condition: trimOrNull(fields.condition),
    unitPrice:
      fields.unitPrice != null && !Number.isNaN(Number(fields.unitPrice))
        ? Number(fields.unitPrice)
        : null,
  };
}
