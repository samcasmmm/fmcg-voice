import { describe, expect, test } from 'bun:test';

import type { Product, Scheme } from '@/db/schema';
import { priceLine } from '@/lib/pricing';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  sku: 'SCP-TEST',
  name: 'Test Atta',
  brand: 'Test',
  category: 'Staples',
  packSize: '5 kg',
  unitsPerCase: 4,
  mrp: 285,
  ptr: 252,
  stockStatus: 'in_stock',
  aliases: [],
  description: '',
  ...overrides,
});

const scheme = (overrides: Partial<Scheme>): Scheme => ({
  id: 1,
  code: 'TEST',
  title: 'Test scheme',
  description: '',
  type: 'percent_off',
  productId: 1,
  category: null,
  minCases: 5,
  value: 10,
  validUntil: '2999-12-31',
  ...overrides,
});

describe('priceLine', () => {
  test('prices cases at the retailer price', () => {
    const line = priceLine(product(), 3, 'cases', []);
    expect(line).toMatchObject({ units: 12, cases: 3, gross: 3024, discount: 0, net: 3024, freeCases: 0, scheme: null });
  });

  test('prices loose units', () => {
    expect(priceLine(product(), 6, 'units', []).gross).toBe(1512);
  });

  test('applies a percent scheme only at or above the minimum cases', () => {
    const percent = scheme({ type: 'percent_off', minCases: 5, value: 8 });
    expect(priceLine(product(), 4, 'cases', [percent]).discount).toBe(0);
    const line = priceLine(product({ unitsPerCase: 12, ptr: 482 }), 6, 'cases', [percent]);
    expect(line.gross).toBe(34704);
    expect(line.discount).toBe(2776.32);
    expect(line.net).toBe(31927.68);
  });

  test('flat discounts apply per block of minimum cases', () => {
    const flat = scheme({ type: 'flat_off', minCases: 10, value: 150 });
    expect(priceLine(product(), 25, 'cases', [flat]).discount).toBe(300);
  });

  test('free-case schemes add free cases without changing the value', () => {
    const free = scheme({ type: 'free_cases', minCases: 10, value: 1 });
    const line = priceLine(product(), 22, 'cases', [free]);
    expect(line.freeCases).toBe(2);
    expect(line.net).toBe(line.gross);
  });

  test('category schemes apply to products in that category', () => {
    const festive = scheme({ productId: null, category: 'Snacks', minCases: 5, value: 5 });
    expect(priceLine(product({ category: 'Snacks' }), 5, 'cases', [festive]).scheme?.code).toBe('TEST');
    expect(priceLine(product({ category: 'Staples' }), 5, 'cases', [festive]).scheme).toBeNull();
  });

  test('ignores expired schemes', () => {
    const expired = scheme({ validUntil: '2000-01-01' });
    expect(priceLine(product(), 10, 'cases', [expired]).scheme).toBeNull();
  });

  test('picks the scheme worth more to the retailer', () => {
    const percent = scheme({ id: 1, code: 'PCT', type: 'percent_off', minCases: 5, value: 5 });
    const free = scheme({ id: 2, code: 'FREE', type: 'free_cases', minCases: 5, value: 1 });
    // 10 cases: 5% of ₹10,080 = ₹504 vs 2 free cases worth ₹2,016.
    expect(priceLine(product(), 10, 'cases', [percent, free]).scheme?.code).toBe('FREE');
  });
});
