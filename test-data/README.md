# Test upload files for Import Cases

Use these files when testing Phase 1 document upload.

## Files

| File | Upload as | Document type in app |
|------|-----------|----------------------|
| `commercial-invoice-sample.csv` | Commercial Invoice | **Commercial Invoice** |
| `packing-list-sample.csv` | Packing List | **Packing List** |
| `commercial-invoice-tariff-book-8items.csv` | Commercial Invoice | **Commercial Invoice** |
| `packing-list-tariff-book-8items.csv` | Packing List | **Packing List** |
| `commercial-invoice-vdd-demo.csv` | Commercial Invoice | **Commercial Invoice** |
| `packing-list-vdd-demo.csv` | Packing List | **Packing List** |
| `VDD-SAMPLE-DEMO.xlsx` | Settings → VDD | Excel import |

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

## Sample data (VDD + import-case demo)

Linked invoice, packing list, and VDD Excel for end-to-end testing. Descriptions use the same brand/model/commercial wording as `VDD-SAMPLE-DEMO.xlsx` so harmonize can find exact VDD hits.

- **Invoice:** INV-VDD-2026-001
- **Packing list:** PL-VDD-2026-001 (related invoice matches)
- **Importer:** Impact Logistic PLC
- **Supplier:** Guangzhou Gonglang Electric Co. Ltd. (CN)
- **Products (6 lines):**
  1. GONGLANG YY7134 motor (exact VDD hit → HS 85011030)
  2. SUNTEX ST-150D polyester yarn (exact → 54023300)
  3. Keda KD-PT100 printing thickener (exact → 38099100)
  4. BrightLite BL-9W LED bulb (exact → 85395000)
  5. GoldenCan GC-400 tomato paste (exact → 20029020)
  6. GONGLANG YY8200 motor (near-miss / different model → 85014090)
- **VDD file:** `VDD-SAMPLE-DEMO.xlsx` — 8 historical rows + extra column **New Customs Flag**

### End-to-end test order

1. **Dashboard → Settings → VDD** → Import Excel → `VDD-SAMPLE-DEMO.xlsx`
2. Create import case (importer: **Impact Logistic PLC**, supplier: **Guangzhou Gonglang Electric Co. Ltd.**, origin/export: **CN**)
3. Upload `commercial-invoice-vdd-demo.csv` + `packing-list-vdd-demo.csv`
4. Extract → review lines → **Harmonize** → expand a product → **Similar VDD Records** should list high-score brand/model hits
5. Confirm products → **Classify** → candidate evidence includes VDD consensus (decision support only)

Regenerate the Excel anytime with:

```
npx tsx test-data/generate-vdd-sample-xlsx.ts
```

## How to test (LED sample)

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
hs-project/test-data/commercial-invoice-vdd-demo.csv
hs-project/test-data/packing-list-vdd-demo.csv
hs-project/test-data/VDD-SAMPLE-DEMO.xlsx
```
