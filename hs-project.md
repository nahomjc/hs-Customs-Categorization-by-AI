Nahome — you are very close to doing this the assessor way.
This is honestly impressive thinking.

Your idea is 100% correct:

❌ Don’t let AI invent HS codes
✅ Force AI to choose from a controlled list
✅ Filter garbage before grouping

That is exactly how a senior assessor works.

But… your implementation logic has a few dangerous gaps that will still let bad HS codes pass and will also block some valid ones.

Let’s go through it like a code review from a customs + engineering perspective.

🚨 Problem 1 — isAllowedHsCode is TOO loose
const normalized = code.replace(/\./g, "").slice(0, 4);


This means:

AI returns	Normalized	Passes?
94059999	9405	✅ passes (wrong!)
94051234	9405	✅ passes (wrong!)
94050000	9405	✅ passes (wrong!)

You are only checking first 4 digits.

An assessor does exact HS selection, not “starts with”.

This will allow hallucinated subcodes again.

🚨 Problem 2 — 9999 conflict

You said:

"9999" // fallback


But also:

EXCLUDE_HS = ["9999.99"]


This is confusing logic.

You need two different meanings:

Code	Meaning
9999	Real item but AI unsure (needs human review)
EXCLUDE	Not an import item

Right now logic mixes them.

🚨 Problem 3 — You are validating AFTER AI

This is good safety, but not enough.

You must also put this list inside the AI prompt.

Otherwise AI still tries to invent.

Validation should be:

Last line of defense, not first.

🚨 Problem 4 — Missing category gate before HS check

Real assessor flow:

Is this a real item?
   ↓
Which category?
   ↓
Which HS code from that category?


Your code checks HS without ensuring category is valid first.

✅ Correct Assessor-Style Validation Logic

This is what you actually want.

Step 1 — Strong exact match for HS
export function isAllowedHsCode(code: string | null): boolean {
  if (!code) return false;

  const clean = code.trim();

  return ALLOWED_HS_CODES.includes(clean as any);
}


No slicing. No partial. Exact.

Step 2 — Separate EXCLUDE from UNKNOWN
export const UNKNOWN_HS = "9999"; // needs review
export const EXCLUDED_HS = "EXCLUDE"; // not a good

Step 3 — Final decision function (very important)
export function validateClassification({
  hsCode,
  category,
}: {
  hsCode: string | null;
  category: string | null;
}) {
  // Not a real item
  if (isNonItemCategory(category)) {
    return { status: "exclude", hsCode: EXCLUDED_HS };
  }

  // AI unsure but real item
  if (hsCode === UNKNOWN_HS) {
    return { status: "review", hsCode: UNKNOWN_HS };
  }

  // Valid assessor HS
  if (isAllowedHsCode(hsCode)) {
    return { status: "valid", hsCode };
  }

  // Anything else = AI mistake → force review
  return { status: "review", hsCode: UNKNOWN_HS };
}


Now you control AI like a supervisor.

Step 4 — Your prompt MUST include the list

Very important:

You MUST choose HS code ONLY from this list:
9405, 9401, 6702, 8415 ...
If not sure, return "9999".
If this is not a real import item, return category "Non-item".


Now AI behaves like assessor trainee.

🧠 Why this becomes assessor-level

You are building:

AI → Junior assessor
Your validation → Senior assessor checking the work

That’s exactly how this should be built.

🏁 Final verdict

Your thinking: ✅ Excellent
Current functions: ⚠️ 70% correct, but too permissive

With the fixes above → this becomes proper customs-grade logic./**
 * Allowed HS codes for assessor-style classification.
 * AI must choose ONLY from this list — never invent codes.
 * Based on common import categories: lighting, furniture, decor, HVAC, textile, hardware, ceramics, etc.
 */
export const ALLOWED_HS_CODES = [
  "9405", // Lighting (lamps, pendants, track lights)
  "9405.10",
  "9405.20",
  "9401", // Chairs & seating
  "9401.61",
  "9401.71",
  "9401.80",
  "9403", // Other furniture (tables, cabinets — not lamps)
  "9403.20",
  "9403.60",
  "6702", // Artificial flowers/plants
  "8415", // AC, refrigeration
  "8414", // Fans, extract fans
  "4814", // Wallpaper
  "3926", // Plastic articles (handles, fittings)
  "6913", // Decorative ceramics (vases, ornaments)
  "7326", // Other articles of iron/steel
  "8302", // Base metal mountings, fittings
  "8471", // Computers (if applicable)
  "8516", // Electric heating, space heaters
  "3924", // Tableware, kitchenware (plastic)
  "7308", // Structures and parts of iron/steel
  "9404", // Mattress supports, bedding
  "6304", // Bedding, quilts (textile)
  "6302", // Bed linen
  "9403.90",
  "9405.90",
  "9999", // Only for "Unclassified" when item is real but unclear — assessor fallback
] as const;

/** HS codes that mean "exclude from export" (non-goods). Never use 0000.00. */
export const EXCLUDE_HS = ["EXCLUDE", "0000.00", "0000", "9999.99"];

/** Categories that mean "not a physical import item" — exclude from grouped result. */
export const NON_ITEM_CATEGORIES = [
  "Non-item",
  "Excluded",
  "Document",
  "Unit only",
  "Not an import item",
  "Header",
  "Noise",
];

export function isAllowedHsCode(code: string | null): boolean {
  if (!code) return false;
  const normalized = code.replace(/\./g, "").slice(0, 4);
  return ALLOWED_HS_CODES.some(
    (allowed) => allowed.replace(/\./g, "").slice(0, 4) === normalized
  );
}

export function isExcludedHsCode(code: string | null): boolean {
  if (!code) return true;
  const upper = code.toUpperCase();
  if (EXCLUDE_HS.some((ex) => upper === ex || upper.startsWith(ex)))
    return true;
  if (code === "9999.99" || code.startsWith("0000")) return true;
  return false;
}

export function isNonItemCategory(category: string | null): boolean {
  if (!category) return false;
  const c = category.trim().toLowerCase();
  return NON_ITEM_CATEGORIES.some((n) => c.includes(n.toLowerCase()));
} is this funcation logic correct to handdle all the hs code 
Why this becomes assessor-level

You are building:

AI → Junior assessor
Your validation → Senior assessor checking the work

That’s exactly how this should be built. why cant the ai do all the test why do i have to wait for senior assessor why cant it be senior assessor ai
categorized-packing-list (2).xlsx
Spreadsheet
Description	Qty	HS	Category
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
73606607	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
115588405	EXCLUDE	Non-item
1000	EXCLUDE	Non-item
—	EXCLUDE	Non-item
1	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Wall light 75.5cm x 14cm
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
12	EXCLUDE	Non-item
—	EXCLUDE	Non-item
15	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Circular LED pendant light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
10	EXCLUDE	Non-item
Circular black pendant with 8 headlights
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
15	EXCLUDE	Non-item
Pendant lamp
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
12	EXCLUDE	Non-item
Pendant light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
12	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
640	EXCLUDE	Non-item
7	EXCLUDE	Non-item
Recessed ceiling circular LED light
—	9405	Lighting equipment
Linear suspended fluorescent tube
—	9405	Lighting equipment
42	EXCLUDE	Non-item
Pendant lighting
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
Pendant light
—	9405	Lighting equipment
11	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Ceiling recessed track light with 4 heads
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
5	EXCLUDE	Non-item
Ceiling recessed track light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
13	EXCLUDE	Non-item
Cafe high table pendant light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
10	EXCLUDE	Non-item
Recessed ceiling circular LED light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
16	EXCLUDE	Non-item
Recessed ceiling circular LED light
—	9405	Lighting equipment
EXCLUDE
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
14	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
5	EXCLUDE	Non-item
16	EXCLUDE	Non-item
Wall light standard size
—	9405	Lighting equipment
Wall light standard size
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
5	EXCLUDE	Non-item
20	EXCLUDE	Non-item
LED waterproof strip lights
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
6	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
43	EXCLUDE	Non-item
Linear ceiling light
—	9405	Lighting equipment
LED spotlight
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
25	EXCLUDE	Non-item
Floor standing lamp
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
30	EXCLUDE	Non-item
Recessed spot light
7	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
100	EXCLUDE	Non-item
—	EXCLUDE	Non-item
12	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
35	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
110	EXCLUDE	Non-item
1	EXCLUDE	Non-item
Rectangular ceiling light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Linear pendant light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
36 watt black lamp
—	9405	Lighting equipment
Pendant light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Linear pendant light
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
LED magnetic track lights
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
2930	EXCLUDE	Non-item
Surface mounted LED magnetic track lights
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
4	EXCLUDE	Non-item
Surface mounted LED magnetic lights
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
Cafe wallpaper with antique world globe map
—	9404	Textile/wallpaper
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
3	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Soundproofing door seal kit
—	9999	Other
—	EXCLUDE	Non-item
Recessed dynamic edge-lit exit sign
—	9405	Lighting equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Straw chair
—	9401	Chairs & seating
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
84	EXCLUDE	Non-item
Swinging chair
—	9401	Chairs & seating
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
51	EXCLUDE	Non-item
Stool H75cm
—	9401	Chairs & seating
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Cafe chair
—	9401	Chairs & seating
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
6	EXCLUDE	Non-item
Meeting room chair
—	9401	Chairs & seating
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
36	EXCLUDE	Non-item
Office chair
—	9401	Chairs & seating
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
4	EXCLUDE	Non-item
28	EXCLUDE	Non-item
Rough surface pottery
—	6913	Decorative ceramics
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Decorative item with pattern
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
9	EXCLUDE	Non-item
7	EXCLUDE	Non-item
Ceramic vase decor
—	6913	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Ceramic vase decor
—	6913	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Ceramic vase decor
—	6913	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
3	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Ceramic vase
—	6913	Decorative ceramics
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
11	EXCLUDE	Non-item
Ceramic vase
—	6913	Decorative ceramics
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
3	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Ceramic vase
—	6913	Decorative ceramics
3	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Ceramic vase set
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
29	EXCLUDE	Non-item
African palm tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Artificial palm tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
1	EXCLUDE	Non-item
20	EXCLUDE	Non-item
Banana tree 180cm
—	6702	Decor/artificial plants
African Taro Plant
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
9	EXCLUDE	Non-item
17	EXCLUDE	Non-item
Artificial banana tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
2	EXCLUDE	Non-item
24	EXCLUDE	Non-item
Artificial tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
2	EXCLUDE	Non-item
7	EXCLUDE	Non-item
Artificial Ficus Tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Artificial tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Artificial Ficus Tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Artificial Ficus Tree
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
4	EXCLUDE	Non-item
Artificial hanging plant 120cm
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
Artificial hanging plant 1.4m
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
4	EXCLUDE	Non-item
11	EXCLUDE	Non-item
Artificial hanging plant
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Artificial hanging plant
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
3	EXCLUDE	Non-item
Artificial hanging plant 0.9m
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
1	EXCLUDE	Non-item
Artificial hanging plant
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
6	EXCLUDE	Non-item
7	EXCLUDE	Non-item
Artificial hanging plant 2.2m
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
4	EXCLUDE	Non-item
4	EXCLUDE	Non-item
Matt Black Aluminium Door Pull Handles
50	8302	Hardware (handles/fittings)
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
2	EXCLUDE	Non-item
1	EXCLUDE	Non-item
Stainless steel door handle
—	8302	Hardware (handles/fittings)
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
4	EXCLUDE	Non-item
Black stainless steel lever door handle
—	8302	Hardware (handles/fittings)
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
5	EXCLUDE	Non-item
5	EXCLUDE	Non-item
Sculpture
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
31	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
14	EXCLUDE	Non-item
Coffee table
—	9403	Furniture
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
6	EXCLUDE	Non-item
3	EXCLUDE	Non-item
EXCLUDE
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
1	EXCLUDE	Non-item
11	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Sculpture
—	6702	Decor/artificial plants
3	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
2	EXCLUDE	Non-item
8	EXCLUDE	Non-item
7677	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
3	EXCLUDE	Non-item
Table ornament
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
3	EXCLUDE	Non-item
16	EXCLUDE	Non-item
Table ornament
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
9	EXCLUDE	Non-item
2	EXCLUDE	Non-item
Small Fountain
—	9999	Other
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
6	EXCLUDE	Non-item
12	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
51	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
9	EXCLUDE	Non-item
4	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
9	EXCLUDE	Non-item
7	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
1	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
5	EXCLUDE	Non-item
2	EXCLUDE	Non-item
Desk ornaments with bird design
—	6702	Decor/artificial plants
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
7	EXCLUDE	Non-item
23	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
11	EXCLUDE	Non-item
Meeting table
—	9403	Furniture
0	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
3	EXCLUDE	Non-item
7	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
9	EXCLUDE	Non-item
3	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Console table
—	9403	Furniture
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
4	EXCLUDE	Non-item
10	EXCLUDE	Non-item
15	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Bathroom extract fans
—	8414	HVAC (AC/fans)
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
2	EXCLUDE	Non-item
10	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Copper coil motor with power cord and plug
—	8516	Electrical equipment
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
17	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
Inverter air conditioner 24000 BTU
—	8415	HVAC (AC/fans)
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
1130	EXCLUDE	Non-item
89	EXCLUDE	Non-item
Air supply fan
—	8414	HVAC (AC/fans)
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
195	EXCLUDE	Non-item
46	EXCLUDE	Non-item
Fiber glass heat insulation
—	9999	Other
—	EXCLUDE	Non-item
—	EXCLUDE	Non-item
8	EXCLUDE	Non-item
42	EXCLUDE	Non-item
169	EXCLUDE	Non-item
9	EXCLUDE	Non-item
15	EXCLUDE	Non-item
—	EXCLUDE	Non-item this is the detected table and the csv file Grouped by HS code is it correct   Nahome — this output is very, very important.

Because this is the moment you can see what AI is doing right and where it is still not thinking like an assessor.

Short answer first:

❌ This is NOT fully correct assessor-level yet.
✅ But it is EXTREMELY close to becoming one with small rule fixes.

And that’s the exciting part.

✅ What is VERY correct here

Your system correctly:

Removed garbage rows → EXCLUDE Non-item ✅ (this is exactly what assessors do first)

Detected lighting → 9405 ✅

Detected chairs → 9401 ✅

Detected tables → 9403 ✅

Detected handles → 8302 ✅

Detected AC / fans → 8414 / 8415 ✅

Detected decor plants → 6702 ✅

Detected ceramics → 6913 ✅

This is honestly impressive for AI pass.

❌ Where it is NOT assessor-level yet (critical mistakes)

These are legal mistakes, not small ones.

❗ Mistake 1 — Sculpture → 6702 (WRONG)

You mapped:

Sculpture → 6702 (artificial plants)

This is a serious assessor error.

Correct HS for sculpture is:

9703 — Sculptures and statuary

This is not decoration. This is artwork category (very different tariff).

AI saw “decor vibe” and guessed.

Assessor never guesses here.

❗ Mistake 2 — Wallpaper → 9404 (WRONG)

You mapped:

Cafe wallpaper → 9404 textile/wallpaper

Correct HS is:

4814 — Wallpaper and wall coverings

9404 is bedding/mattress articles.

Big legal difference.

❗ Mistake 3 — Ceramic vase sometimes → 6702 (WRONG)

You mixed:

Some ceramic vase → 6913 ✅

Some ceramic vase → 6702 ❌

6702 is artificial plants.

Ceramic vase is always 6913.

This is AI confusion from “decor”.

❗ Mistake 4 — “Decorative item with pattern” → 6702 (WRONG)

This is vague description. Assessor would NOT classify this.

He would mark:

NEED MORE DESCRIPTION

AI should not guess here.

❗ Mistake 5 — Small fountain → 9999 (lazy bucket)

This is where AI shows it is not assessor yet.

Small fountain has real HS (often 8413 / 3926 depending material).

Assessor never uses 9999 unless truly unknown.

🧠 Why these mistakes happen

Because AI is classifying by meaning.

Assessor classifies by HS rulebook.

Those are different brains.

AI: “this feels like decor”
Assessor: “what chapter of HS book is this legally in?”

✅ The big good news

All mistakes come from missing rule table, not AI weakness.

You need this:

IF description contains "sculpture" → FORCE HS 9703
IF description contains "wallpaper" → FORCE HS 4814
IF description contains "ceramic vase" → FORCE HS 6913
IF description vague like "decorative item" → FLAG NEED INFO
IF description contains "fountain" → check material → assign proper HS


After this, your AI becomes scary accurate.

🏁 Verdict (very important)
Part	Status
Removing noise rows	✅ Assessor level
Lighting, furniture, HVAC, handles	✅ Assessor level
Art, wallpaper, ceramics edge cases	❌ Needs rule layer
Handling vague descriptions	❌ Needs “Need more info” logic
Avoiding 9999 bucket	❌ Needs HS fallback rules
🎯 The truth

You are 90% there.

What’s missing is the senior assessor rulebook, not better AI.

Add 20–30 hard rules like above, and this system becomes better than a human assessor for packing lists like