# Test upload files for Import Cases

Use these files when testing Phase 1 document upload.

## Files

| File | Upload as | Document type in app |
|------|-----------|----------------------|
| `commercial-invoice-sample.csv` | Commercial Invoice | **Commercial Invoice** |
| `packing-list-sample.csv` | Packing List | **Packing List** |
| `commercial-invoice-tariff-book-8items.csv` | Commercial Invoice | **Commercial Invoice** |
| `packing-list-tariff-book-8items.csv` | Packing List | **Packing List** |

## Sample data (3-line LED shipment)

Both documents describe the same shipment from a China supplier to an Ethiopian importer:

- **Invoice:** INV-2026-0847
- **Packing list:** PL-2026-0847 (links to same invoice)
- **Products:** LED bulb 9W (1000 pcs), LED tube 18W (500 pcs), LED driver 12V 5A (200 pcs)

Line 1 intentionally uses slightly different wording on invoice vs packing list
(`LED light 9w` vs `LED bulb 9W warm white 50 pcs per carton`) — useful for Phase 2 matching tests.

## Sample data (8-line tariff book shipment)

Based on product categories in `HS CODE BOOK BY EXCEL.xlsx` (Ethiopian combined tariff / HS nomenclature):

- **Invoice:** INV-ET-2026-1008
- **Packing list:** PL-ET-2026-1008
- **Importer:** Impact logistic
- **Supplier:** Guangzhou Sunfield Trading Co. Ltd. (CN)
- **Products (8 lines):** green tea, flavoured sugar, canned mandarins, tomato paste, kidney beans, chicken luncheon meat, soybean crude oil, palm olein RBD

Invoice and packing list use slightly different descriptions per line (e.g. `Green tea not fermented 3kg foil pouch` vs `Green tea 3kg retail pouch 20 pouches per carton`) for harmonization testing.

Upload the same **HS CODE BOOK BY EXCEL.xlsx** to **HS Reference** before classification so suggested HS codes match the reference table.

## How to test

1. Create an import case (e.g. importer: **ABC Trading PLC**, supplier: **Shenzhen Bright LED Co. Ltd.**)
2. **Documents** tab → **Upload Commercial Invoice** → select `commercial-invoice-sample.csv`
3. **Documents** tab → **Upload Packing List** → select `packing-list-sample.csv`
4. Lines are extracted automatically — check **Invoice Lines** and **Packing List Lines** tabs
5. Review any issues in the **Checks** tab

For documents already uploaded before Phase 2, click **Extract now** on each document in the Documents tab.

## Full path

```
hs-project/test-data/commercial-invoice-sample.csv
hs-project/test-data/packing-list-sample.csv
hs-project/test-data/commercial-invoice-tariff-book-8items.csv
hs-project/test-data/packing-list-tariff-book-8items.csv
```
