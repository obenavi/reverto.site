# Yield — Sysco Invoice Parser Specification

> Priority: Highest. Sysco is the #1 US foodservice distributor.  
> Goal: Extract TRUE cost per lb/oz/unit from every line item, defeating all intentional obfuscation.

---

## Why Sysco Invoices Are Difficult

Sysco deliberately structures invoices to obscure per-unit cost:

1. **Case-pack pricing** — price shown is per case, not per pound/ounce
2. **Variable pack sizes** — "4/5lb" means 4 bags × 5 lb each; "6/#10 can" means 6 cans × 10-size (96 oz)
3. **Catch weight items** — proteins (chicken, beef) billed by actual weight, not nominal case weight; total cost can vary ±20% from estimated
4. **Split case surcharge** — ordering less than a full case adds a per-unit fee ($1.00–$3.50 typical) that isn't labeled as such
5. **Fuel surcharge** — line item or percentage added on top; often buries the real cost
6. **Cryovac/vacuum-pack weight** — includes packaging weight in billed weight for catch weight items
7. **Cryptic item codes** — item numbers don't map to any public database; must build internal lookup table
8. **Multiple UOM columns** — "PRICE/CS", "QTY", "UNIT" can mean different things by item type
9. **Brand name obfuscation** — Sysco brand (Sysco Classic, Sysco Imperial, etc.) + generic description makes cross-supplier comparison hard
10. **No per-oz column** — the most actionable price unit is never shown

---

## Azure Document Intelligence Setup

### Model
Use **prebuilt-invoice** model — it handles tabular line item extraction natively.

### Endpoint
```
POST https://{resource}.cognitiveservices.azure.com/formrecognizer/documentModels/prebuilt-invoice:analyze
```

### Key Fields Extracted by Prebuilt-Invoice
- `VendorName` — "Sysco San Francisco LLC" etc.
- `InvoiceDate`
- `InvoiceId` (invoice number)
- `Items[]`:
  - `Description`
  - `Quantity`
  - `Unit`
  - `UnitPrice`
  - `Amount` (extended)
  - `ProductCode` (Sysco item number)

### Supplemental Extraction
The prebuilt model sometimes misses Sysco-specific fields. Use a **custom extraction prompt** or post-process with regex for:
- Pack size string (e.g., "4/5#", "6/10#", "2/12CT") — usually in description
- Catch weight indicator ("CW" or "CATCH WT" in description)
- Split case indicator ("SC" in unit column or description)
- Fuel surcharge line (look for "FUEL SURCHARGE" or "FSC" in description)

---

## Line Item Processing Pipeline

```
Raw Azure output for each item
  → cleanDescription(text)          — strip noise, normalize
  → extractPackSize(description)    — parse "4/5#", "6/10#", etc.
  → detectCatchWeight(description)  — flag CW items
  → detectSplitCase(description, unitCol) — flag SC items
  → lookupItemMaster(itemCode, businessId) — get cached unit size if known
  → computeUnitCosts(item)          — calculate cost_per_lb, cost_per_oz, cost_per_each
  → matchUsdaCommodity(description) — link to USDA price for comparison
```

---

## Pack Size Parser

Pack size strings follow patterns. Examples and their meaning:

| Raw String | Pack Count | Unit Size | Total Weight |
|-----------|-----------|-----------|-------------|
| `4/5#` | 4 | 5 lb | 20 lb/case |
| `4/5LB` | 4 | 5 lb | 20 lb |
| `6/10#` | 6 | 10 lb | 60 lb/case |
| `6/#10 CAN` | 6 | 96 oz (# = lb × 16 oz? No — #10 can = 6 lb 6 oz = 102 oz) | 6 × 102 oz |
| `2/12CT` | 2 | 12 count | 24 each/case |
| `12/1QT` | 12 | 1 quart (32 oz) | 384 oz/case |
| `1/25LB` | 1 | 25 lb | 25 lb/case |
| `4/1GAL` | 4 | 1 gallon (128 oz) | 512 oz/case |
| `30LB AVG` | catch weight | ~30 lb average | varies |
| `6/4/2.5LB` | 6 cases × 4 bags × 2.5 lb | 2.5 lb | 60 lb/case |

### Parser Logic (JavaScript)

```js
function parsePackSize(str) {
  if (!str) return null;
  str = str.toUpperCase().trim();

  // Pattern: COUNT/SIZE UNIT e.g. "4/5LB", "6/10#", "12/1QT"
  const m1 = str.match(/^(\d+)\/(\d+(?:\.\d+)?)(LB|#|OZ|KG|GAL|QT|CT|EA|PC)$/);
  if (m1) {
    const count = parseFloat(m1[1]);
    const size = parseFloat(m1[2]);
    const unit = m1[3];
    return { count, size, unit: normalizeUnit(unit) };
  }

  // Pattern: WEIGHT only e.g. "25LB", "10#"
  const m2 = str.match(/^(\d+(?:\.\d+)?)(LB|#|OZ|KG)(\s+AVG)?$/);
  if (m2) {
    return { count: 1, size: parseFloat(m2[1]), unit: normalizeUnit(m2[2]), catchWeight: !!m2[3] };
  }

  // Pattern: COUNT/UNIT e.g. "12/1QT", "6/#10 CAN"
  // #10 can is a specific size: ~6 lbs 6 oz = 102 oz
  if (str.includes('#10') || str.includes('# 10')) {
    const countMatch = str.match(/^(\d+)\//);
    return { count: countMatch ? parseInt(countMatch[1]) : 6, size: 102, unit: 'oz', container: '#10_can' };
  }

  return null; // unknown — flag for manual review
}

function normalizeUnit(u) {
  if (u === '#') return 'lb';
  if (u === 'LB') return 'lb';
  if (u === 'OZ') return 'oz';
  if (u === 'KG') return 'kg';
  if (u === 'GAL') return 'gal';
  if (u === 'QT') return 'qt';
  if (u === 'CT' || u === 'EA' || u === 'PC') return 'each';
  return u.toLowerCase();
}
```

---

## Unit Cost Computation

```js
function computeUnitCosts(item, packSizeData) {
  const casePrice = item.unitPrice;         // price per case (from invoice)
  const qty = item.quantity || 1;            // cases ordered

  if (!packSizeData) {
    return { cost_per_each: casePrice, note: 'pack_size_unknown' };
  }

  const { count, size, unit } = packSizeData;

  // Compute total oz in case
  let totalOz;
  if (unit === 'lb') totalOz = count * size * 16;
  else if (unit === 'oz') totalOz = count * size;
  else if (unit === 'kg') totalOz = count * size * 35.274;
  else if (unit === 'gal') totalOz = count * size * 128;
  else if (unit === 'qt') totalOz = count * size * 32;
  else if (unit === 'each') {
    return {
      cost_per_each: +(casePrice / (count * size)).toFixed(4),
      units_per_case: count * size
    };
  }

  const costPerOz = casePrice / totalOz;
  const costPerLb = costPerOz * 16;

  return {
    cost_per_oz: +costPerOz.toFixed(4),
    cost_per_lb: +costPerLb.toFixed(4),
    cost_per_case: +casePrice.toFixed(4),
    total_oz_per_case: +totalOz.toFixed(2),
    units_per_case: count
  };
}
```

---

## Catch Weight Handling

Catch weight items (whole birds, beef primals, fresh fish) are billed by actual weight at delivery, not nominal case weight.

### Detection
```js
function isCatchWeight(description) {
  const patterns = [/\bCW\b/, /CATCH\s*WT/, /CATCH\s*WEIGHT/, /SOLD\s*BY\s*WT/i];
  return patterns.some(p => p.test(description.toUpperCase()));
}
```

### Invoice Structure for CW Items
Sysco invoices show:
- **Ordered qty**: nominal (e.g., 2 cs)
- **Shipped qty**: actual weight (e.g., 47.23 lb)
- **Unit price**: per lb (e.g., $3.45/lb)
- **Extended**: shipped qty × unit price

### Processing
```js
if (item.catchWeight) {
  // Azure usually extracts actual shipped weight as Quantity for CW items
  const actualLb = item.quantity;
  const pricePerLb = item.unitPrice;
  return {
    cost_per_lb: pricePerLb,
    cost_per_oz: +(pricePerLb / 16).toFixed(4),
    actual_weight_lb: actualLb,
    catch_weight: true
  };
}
```

---

## Split Case Surcharge

Split cases (ordering partial case = fewer than a full case quantity) incur a surcharge, typically $1.50–$3.50 per split line item.

### Detection
```js
function isSplitCase(description, unitCol) {
  return /\bSC\b|\bSPLIT\b|\bSPLIT\s*CASE/i.test(description) ||
         /\bSC\b/.test(unitCol || '');
}

// Split case surcharge appears as a separate line item OR embedded
// Look for line items with description matching:
const SPLIT_SURCHARGE_PATTERNS = [
  /SPLIT\s*CASE\s*CHARGE/i,
  /SC\s*SURCHARGE/i,
  /SC\s*FEE/i
];
```

### Attribution
Split case surcharges should be attributed to the affected line items, not treated as a separate overhead cost. If a surcharge line follows a split case item, attach it to that item's record.

---

## Fuel Surcharge

Sysco adds fuel surcharges either as a percentage of invoice total or as a per-case charge.

### Detection
```js
const FUEL_PATTERNS = [
  /FUEL\s*SURCHARGE/i,
  /FSC/i,
  /FUEL\s*CHARGE/i
];
```

### Handling
Fuel surcharges are a real cost of the order. Two approaches:
1. **Distribute proportionally** across all line items (by extended price)
2. **Show as separate overhead** and factor into food cost % calculation

Recommended: **distribute proportionally** so cost_per_unit reflects true delivered cost.

```js
function distributeFuelSurcharge(items, totalFuelSurcharge) {
  const totalExtended = items.reduce((sum, i) => sum + (i.extended_price || 0), 0);
  return items.map(item => {
    const ratio = (item.extended_price || 0) / totalExtended;
    item.fuel_surcharge = +(totalFuelSurcharge * ratio).toFixed(2);
    item.true_cost = item.extended_price + item.fuel_surcharge;
    // Recompute per-unit costs using true_cost instead of extended_price
    item.true_cost_per_lb = item.cost_per_lb ? +(item.true_cost / (item.extended_price / item.cost_per_lb)).toFixed(4) : null;
    return item;
  });
}
```

---

## Sysco Item Number → Common Name Lookup

Sysco item numbers (6–9 digit codes) are not in any public database. We build our own mapping:

### Strategy
1. **Initial parse**: Use description text + category heuristics to assign `common_name`
2. **User confirmation**: Show parsed item with suggested name; user can override
3. **Business-level learning**: Store `item_master` per business — same Sysco code gets same name next time
4. **Cross-business patterns**: After sufficient data, share anonymized mappings (opt-in, Phase 2)

### Common Name Assignment (Heuristic)
```js
function guessCommonName(description) {
  const d = description.toUpperCase();
  
  // Proteins
  if (/CHICKEN\s*BREAST/.test(d)) return 'Chicken Breast';
  if (/CHICKEN\s*THIGH/.test(d)) return 'Chicken Thigh';
  if (/GROUND\s*BEEF/.test(d)) return 'Ground Beef';
  if (/SALMON/.test(d)) return 'Salmon';
  if (/SHRIMP/.test(d)) return 'Shrimp';
  if (/PORK\s*LOIN/.test(d)) return 'Pork Loin';
  if (/RIBEYE/.test(d)) return 'Ribeye';
  if (/NY\s*STRIP/.test(d)) return 'NY Strip';
  
  // Produce
  if (/AVOCADO/.test(d)) return 'Avocado';
  if (/ROMAINE/.test(d)) return 'Romaine Lettuce';
  if (/TOMATO/.test(d)) return 'Tomato';
  if (/ONION/.test(d)) return 'Onion';
  if (/POTATO/.test(d)) return 'Potato';
  if (/GARLIC/.test(d)) return 'Garlic';
  
  // Dairy
  if (/HEAVY\s*CREAM/.test(d)) return 'Heavy Cream';
  if (/BUTTER/.test(d)) return 'Butter';
  if (/MOZZARELLA/.test(d)) return 'Mozzarella';
  if (/PARMESAN/.test(d)) return 'Parmesan';
  
  // Return null → user must name it
  return null;
}
```

---

## USDA Commodity Matching

Map Sysco descriptions to USDA AMS commodity codes for price comparison:

```js
const USDA_MAP = {
  'Chicken Breast': 'chicken_breast_boneless_skinless',
  'Ground Beef': 'ground_beef_80_20',
  'Salmon': 'salmon_atlantic_fresh',
  'Shrimp': 'shrimp_21_25_raw',
  'Avocado': 'avocado_hass_california',
  'Romaine Lettuce': 'lettuce_romaine_24ct',
  'Tomato': 'tomato_6x7',
  'Butter': 'butter_salted_print',
  'Heavy Cream': 'cream_heavy_40pct',
};
```

---

## Quality Assurance / Confidence Score

Each parsed invoice gets a confidence score. Low confidence triggers manual review flag.

```js
function computeConfidence(invoice) {
  let score = 100;
  
  // Deductions
  if (!invoice.invoiceNumber) score -= 20;
  if (!invoice.invoiceDate) score -= 10;
  const unknownPackSize = invoice.items.filter(i => !i.pack_size_parsed).length;
  score -= (unknownPackSize / invoice.items.length) * 30;
  const unknownNames = invoice.items.filter(i => !i.common_name).length;
  score -= (unknownNames / invoice.items.length) * 20;
  
  return Math.max(0, Math.round(score));
}
```

Confidence thresholds:
- **≥ 85**: Auto-accept, show to user for spot check
- **60–84**: Highlight uncertain fields, prompt user to review
- **< 60**: Full manual review required, flag in UI

---

## Edge Cases

| Case | Handling |
|------|---------|
| PDF is scanned image (not text PDF) | Azure Doc Intelligence handles OCR on images ✅ |
| Multiple invoices in one PDF | Split by invoice number / page break detection |
| Invoice in Spanish | Azure returns English field names; description stays in original language — use bilingual pattern matching |
| Item removed / credit line | Negative amount → mark as `credit: true`, exclude from cost computation |
| Delivery charge as line item | Detect "DELIVERY" / "HANDLING" → categorize as overhead, not food cost |
| Tax lines | Detect "TAX" / "SALES TAX" → separate from food cost |
| Price adjustment / promotional | Look for "ADJ" / "PROMO" → flag for user; may distort true cost |
| Sysco invoice PDF is password-protected | Some customers get encrypted PDFs — prompt user to save as unprotected |

---

## Testing Corpus

Build a test set of real Sysco invoices (anonymized) to validate parser accuracy:

```
test-invoices/
  sysco-norcal-produce-2025-01.pdf     — all produce, mostly catch weight
  sysco-socal-protein-2025-02.pdf      — proteins with catch weight + split cases
  sysco-generic-mixed-2025-03.pdf      — mixed categories
  sysco-image-scan-2025-04.pdf         — scanned (not text PDF)
  sysco-credits-2025-05.pdf            — invoice with credit lines
```

Target accuracy:
- Invoice header (date, number, total): 99%+
- Line item count: 99%+
- Per-unit cost (within 1%): 95%+
- Common name assignment: 80%+ without user correction

---

## UI Display

For each parsed line item, show:
```
[Chicken Breast — Sysco #1234567]       [Sysco Classic]
  Case price:  $89.40     (6 × 10 lb = 60 lb)
  ✦ Per lb:    $1.49      ← prominently displayed
  ✦ Per oz:    $0.093
  Market ref:  $1.62/lb (USDA NorCal)  ↓ 8% below market ✅
  Last order:  $1.55/lb (3 weeks ago)  ↑ 4% vs prev
```

Color coding:
- Green: at or below USDA market price
- Yellow: 5–15% above market
- Red: 15%+ above market
