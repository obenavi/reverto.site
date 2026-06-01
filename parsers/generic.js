// Generic fallback invoice parser for unknown suppliers

const { guessCommonName, guessCategory, computeUnitCosts, parsePackSize } = require('./sysco');

function parseGeneric(azureResult) {
  const items = [];
  const azureItems = azureResult.documents?.[0]?.fields?.Items?.valueArray || [];

  for (const ai of azureItems) {
    const f = ai.valueObject || {};
    const description = f.Description?.content || f.Description?.valueString || '';
    const productCode = f.ProductCode?.content || '';
    const quantity = parseFloat(f.Quantity?.valueNumber || f.Quantity?.content || 1);
    const unitPrice = parseFloat(f.UnitPrice?.valueCurrency?.amount || f.UnitPrice?.content || 0);
    const amount = parseFloat(f.Amount?.valueCurrency?.amount || f.Amount?.content || (unitPrice * quantity));

    if (!description || !unitPrice) continue;

    const packMatch = description.match(/\b(\d+\/\d+(?:\.\d+)?(?:LB|#|OZ|KG|GAL|QT|CT|EA|PC)|\d+(?:\.\d+)?(?:LB|#|OZ|KG))\b/i);
    const packSize = parsePackSize(packMatch?.[1]);

    items.push({
      supplier_item_code: productCode,
      description,
      category: guessCategory(description),
      common_name: guessCommonName(description),
      pack_size: packMatch?.[1] || null,
      quantity,
      unit: 'cs',
      unit_price: unitPrice,
      extended_price: amount,
      ...computeUnitCosts(unitPrice, packSize)
    });
  }

  return items;
}

module.exports = { parseGeneric };
