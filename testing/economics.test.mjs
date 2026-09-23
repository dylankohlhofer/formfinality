import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { economics } from '../commercial/economics.mjs';
const a = JSON.parse(await readFile(new URL('../commercial/assumptions.json', import.meta.url)));
test('illustrative VAT and store commission apply in the stated order', () => {
  assert.ok(Math.abs(economics(a, 4.99).storeProceeds - 3.534583333333333) < 1e-10);
});
test('refund allowance and support time reduce proceeds, not the store tax base', () => {
  const r = economics(a, 4.99);
  assert.ok(Math.abs(r.economicContribution - (3.534583333333333 * .95 - 2 / 60 * 20)) < 1e-10);
  assert.equal(r.cashOverheadSales, 60);
  assert.equal(r.includingTimeSales, 1561);
});
test('zero/negative unit margin never claims profitable break-even', () => {
  const r = economics({ ...a, acquisitionCostPerPurchase: 100 }, 4.99);
  assert.equal(r.cashOverheadSales, null);
  assert.equal(r.includingTimeSales, null);
});
test('fully refunded sales retain support costs', () => {
  const r = economics({ ...a, refundRate: 1 }, 4.99);
  assert.equal(r.cashContribution, 0);
  assert.ok(r.economicContribution < 0);
});
test('CAC limit is before fixed costs and unaffected by already-entered CAC', () => {
  const x = economics(a, 7.99), y = economics({ ...a, acquisitionCostPerPurchase: 1 }, 7.99);
  assert.equal(x.maxAcquisitionCostBeforeFixedCosts, y.maxAcquisitionCostBeforeFixedCosts);
  assert.ok(Math.abs(x.economicContribution - y.economicContribution - 1) < 1e-10);
});
test('non-finite, negative and out-of-range assumptions fail visibly', () => {
  for (const value of [NaN, Infinity, -1, undefined])
    assert.throws(() => economics({ ...a, hourlyCost: value }, 4.99));
  for (const key of ['storeFeeRate', 'refundRate'])
    assert.throws(() => economics({ ...a, [key]: 1.1 }, 4.99));
  for (const price of [0, -1, NaN, '4.99']) assert.throws(() => economics(a, price));
});
