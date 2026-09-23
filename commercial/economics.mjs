// Planning assumptions, not accounting, tax advice, observed demand or forecasts.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function economics(a, price) {
  if (!Number.isFinite(price) || price <= 0) throw new Error('Positive price required');
  for (const key of ['taxRate', 'supportMinutesPerPurchase', 'hourlyCost', 'otherVariableCost',
    'acquisitionCostPerPurchase', 'annualCashOverhead', 'annualDevelopmentHours'])
    if (!Number.isFinite(a[key]) || a[key] < 0) throw new Error(`Invalid ${key}`);
  for (const key of ['storeFeeRate', 'refundRate'])
    if (!Number.isFinite(a[key]) || a[key] < 0 || a[key] > 1) throw new Error(`Invalid ${key}`);
  const storeProceeds = price / (1 + a.taxRate) * (1 - a.storeFeeRate);
  const cashContribution = storeProceeds * (1 - a.refundRate) - a.otherVariableCost - a.acquisitionCostPerPurchase;
  const supportCost = a.supportMinutesPerPurchase / 60 * a.hourlyCost;
  const economicContribution = cashContribution - supportCost;
  const breakEven = (cost, margin) => margin > 0 ? Math.ceil(cost / margin) : null;
  return { price, storeProceeds, cashContribution, supportCost, economicContribution,
    cashOverheadSales: breakEven(a.annualCashOverhead, cashContribution),
    includingTimeSales: breakEven(a.annualCashOverhead + a.annualDevelopmentHours * a.hourlyCost, economicContribution),
    maxAcquisitionCostBeforeFixedCosts: storeProceeds * (1 - a.refundRate) - a.otherVariableCost - supportCost };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--assumptions')) throw new Error('Usage: npm run business:model [-- --assumptions file.json]');
  const a = JSON.parse(await readFile(args[1] || new URL('./assumptions.json', import.meta.url), 'utf8'));
  if (a.currency !== 'GBP' || !Array.isArray(a.prices) || !a.prices.length) throw new Error('GBP prices required');
  console.log('ILLUSTRATIVE ONLY — every input is an assumption, not observed demand.');
  console.log(JSON.stringify(a, null, 2));
  console.table(a.prices.map(price => {
    const r = economics(a, price);
    return { price: price.toFixed(2), proceeds: r.storeProceeds.toFixed(2),
      'after refunds/support/CAC': r.economicContribution.toFixed(2),
      'cash overhead sales': r.cashOverheadSales, 'including time sales': r.includingTimeSales };
  }));
  console.log('Cash overhead excludes founder labour. Including time values development and support.');
  console.log('Excludes business income taxes, liability/legal advice, hardware and any costs not entered.');
}
