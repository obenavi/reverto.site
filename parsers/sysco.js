// Sysco invoice parser — extracts true cost per unit

function parsePackSize(str) {
  if (!str) return null;
  str = str.toUpperCase().trim();

  // #10 can (102 oz per can)
  if (str.includes('#10') || str.includes('# 10')) {
    const m = str.match(/^(\d+)\//);
    return { count: m ? parseInt(m[1]) : 6, size: 102, unit: 'oz', container: '#10_can' };
  }

  // COUNT/SIZE UNIT e.g. "4/5LB", "6/10#", "12/1QT", "4/1GAL", "2/12CT"
  const m1 = str.match(/^(\d+)\/(\d+(?:\.\d+)?)\s*(LB|#|OZ|KG|GAL|QT|CT|EA|PC)$/);
  if (m1) {
    return { count: parseFloat(m1[1]), size: parseFloat(m1[2]), unit: normalizeUnit(m1[3]) };
  }

  // COUNT/COUNT SUBUNIT e.g. "6/4/2.5LB"
  const m3 = str.match(/^(\d+)\/(\d+)\/(\d+(?:\.\d+)?)\s*(LB|#|OZ)$/);
  if (m3) {
    return { count: parseFloat(m3[1]) * parseFloat(m3[2]), size: parseFloat(m3[3]), unit: normalizeUnit(m3[4]) };
  }

  // Weight only e.g. "25LB", "10#", "30LB AVG"
  const m2 = str.match(/^(\d+(?:\.\d+)?)\s*(LB|#|OZ|KG)(\s+AVG)?$/);
  if (m2) {
    return { count: 1, size: parseFloat(m2[1]), unit: normalizeUnit(m2[2]), catchWeight: !!m2[3] };
  }

  return null;
}

function normalizeUnit(u) {
  if (u === '#' || u === 'LB') return 'lb';
  if (u === 'OZ') return 'oz';
  if (u === 'KG') return 'kg';
  if (u === 'GAL') return 'gal';
  if (u === 'QT') return 'qt';
  if (u === 'CT' || u === 'EA' || u === 'PC') return 'each';
  return u.toLowerCase();
}

function computeUnitCosts(casePrice, packSize) {
  if (!packSize) return { cost_per_case: casePrice };
  const { count, size, unit } = packSize;

  if (unit === 'each') {
    const totalEach = count * size;
    return { cost_per_case: casePrice, cost_per_each: +(casePrice / totalEach).toFixed(4), units_per_case: totalEach };
  }

  let totalOz;
  if (unit === 'lb') totalOz = count * size * 16;
  else if (unit === 'oz') totalOz = count * size;
  else if (unit === 'kg') totalOz = count * size * 35.274;
  else if (unit === 'gal') totalOz = count * size * 128;
  else if (unit === 'qt') totalOz = count * size * 32;
  else return { cost_per_case: casePrice };

  const costPerOz = casePrice / totalOz;
  return {
    cost_per_case: +casePrice.toFixed(4),
    cost_per_oz: +costPerOz.toFixed(4),
    cost_per_lb: +(costPerOz * 16).toFixed(4),
    total_oz_per_case: +totalOz.toFixed(2),
    units_per_case: count
  };
}

function isCatchWeight(description) {
  return /\bCW\b|CATCH\s*WT|CATCH\s*WEIGHT|SOLD\s*BY\s*WT/i.test(description);
}

function isSplitCase(description) {
  return /\bSC\b|\bSPLIT\s*CASE\b/i.test(description);
}

function isFuelSurcharge(description) {
  return /FUEL\s*SURCHARGE|^FSC$|\bFUEL\s*CHG\b/i.test(description);
}

function isOverheadLine(description) {
  return /DELIVERY\s*CHG|HANDLING|SALES\s*TAX|\bTAX\b|SURCHARGE|ADJUSTMENT/i.test(description) ||
         isFuelSurcharge(description);
}

function guessCommonName(description) {
  const d = description.toUpperCase();
  const MAP = [
    [/CHICKEN\s*BREAST/, 'Chicken Breast'],
    [/CHICKEN\s*THIGH/, 'Chicken Thigh'],
    [/CHICKEN\s*WING/, 'Chicken Wing'],
    [/WHOLE\s*CHICKEN|FRYER/, 'Whole Chicken'],
    [/GROUND\s*BEEF/, 'Ground Beef'],
    [/RIBEYE|RIB\s*EYE/, 'Ribeye'],
    [/NY\s*STRIP|NEW\s*YORK\s*STRIP/, 'NY Strip'],
    [/SALMON/, 'Salmon'],
    [/SHRIMP/, 'Shrimp'],
    [/PORK\s*LOIN/, 'Pork Loin'],
    [/PORK\s*BELLY/, 'Pork Belly'],
    [/BACON/, 'Bacon'],
    [/AVOCADO/, 'Avocado'],
    [/ROMAINE/, 'Romaine Lettuce'],
    [/ICEBERG/, 'Iceberg Lettuce'],
    [/TOMATO/, 'Tomato'],
    [/ONION/, 'Onion'],
    [/POTATO(?!ES)/, 'Potato'],
    [/GARLIC/, 'Garlic'],
    [/LEMON/, 'Lemon'],
    [/LIME/, 'Lime'],
    [/HEAVY\s*CREAM|HEAVY\s*WHIP/, 'Heavy Cream'],
    [/BUTTER/, 'Butter'],
    [/MOZZARELLA/, 'Mozzarella'],
    [/PARMESAN/, 'Parmesan'],
    [/CHEDDAR/, 'Cheddar'],
    [/CANOLA\s*OIL/, 'Canola Oil'],
    [/OLIVE\s*OIL/, 'Olive Oil'],
  ];
  for (const [re, name] of MAP) {
    if (re.test(d)) return name;
  }
  return null;
}

function guessCategory(description) {
  const d = description.toUpperCase();
  if (/CHICKEN|BEEF|SALMON|SHRIMP|PORK|BACON|FISH|TUNA|COD|TILAPIA|STEAK|RIBEYE/.test(d)) return 'protein';
  if (/TOMATO|LETTUCE|ONION|POTATO|AVOCADO|PEPPER|CARROT|CELERY|GARLIC|LEMON|LIME|HERB|BASIL/.test(d)) return 'produce';
  if (/CHEESE|BUTTER|CREAM|MILK|YOGURT|MOZZARELLA|PARMESAN|CHEDDAR/.test(d)) return 'dairy';
  if (/OIL|VINEGAR|SAUCE|SYRUP|SUGAR|SALT|FLOUR|PASTA|RICE|BREAD|DRY/.test(d)) return 'dry';
  if (/PAPER|NAPKIN|GLOVE|TOWEL|BAG|WRAP|FOIL|CONTAINER/.test(d)) return 'supplies';
  return 'other';
}

function parseSyscoo(azureResult) {
  const items = [];
  const fuelCharges = [];

  const azureItems = azureResult.documents?.[0]?.fields?.Items?.valueArray || [];

  for (const ai of azureItems) {
    const f = ai.valueObject || {};
    const description = f.Description?.content || f.Description?.valueString || '';
    const productCode = f.ProductCode?.content || f.ProductCode?.valueString || '';
    const quantity = parseFloat(f.Quantity?.valueNumber || f.Quantity?.content || 1);
    const unitPrice = parseFloat(f.UnitPrice?.valueCurrency?.amount || f.UnitPrice?.content || 0);
    const amount = parseFloat(f.Amount?.valueCurrency?.amount || f.Amount?.content || (unitPrice * quantity));

    if (!description) continue;

    if (isFuelSurcharge(description)) {
      fuelCharges.push(amount);
      continue;
    }

    if (/SPLIT\s*CASE\s*CHARGE|^SC\s*FEE$/i.test(description)) continue;

    // Extract pack size from description (Sysco embeds it in the description text)
    const packMatch = description.match(/\b(\d+\/\d+(?:\.\d+)?(?:LB|#|OZ|KG|GAL|QT|CT|EA|PC)|\d+(?:\.\d+)?(?:LB|#|OZ|KG)(?:\s+AVG)?)\b/i);
    const packSizeStr = packMatch ? packMatch[1] : null;
    const packSize = parsePackSize(packSizeStr);

    const catchWeight = isCatchWeight(description);
    const splitCase = isSplitCase(description);

    let costs;
    if (catchWeight && f.Quantity?.valueNumber) {
      const actualLb = quantity;
      const pricePerLb = unitPrice;
      costs = {
        cost_per_lb: pricePerLb,
        cost_per_oz: +(pricePerLb / 16).toFixed(4),
        actual_weight_lb: actualLb,
        catch_weight: true
      };
    } else {
      costs = computeUnitCosts(unitPrice, packSize);
    }

    items.push({
      supplier_item_code: productCode,
      description,
      category: guessCategory(description),
      common_name: guessCommonName(description),
      pack_size: packSizeStr,
      catch_weight: catchWeight,
      quantity,
      unit: 'cs',
      unit_price: unitPrice,
      extended_price: amount,
      split_case_surcharge: splitCase ? 0 : 0, // will be attributed below
      ...costs
    });
  }

  // Distribute total fuel surcharge proportionally
  if (fuelCharges.length && items.length) {
    const totalFuel = fuelCharges.reduce((s, v) => s + v, 0);
    const totalExt = items.reduce((s, i) => s + (i.extended_price || 0), 0);
    for (const item of items) {
      const ratio = (item.extended_price || 0) / totalExt;
      item.fuel_surcharge = +(totalFuel * ratio).toFixed(2);
    }
  }

  return items;
}

// Export with both spellings for safety
module.exports = { parseSysco: parseSyscoo, parsePackSize, computeUnitCosts, guessCommonName, guessCategory };
