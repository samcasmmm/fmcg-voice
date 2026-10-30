import type { Product, Scheme } from '@/db/schema';

export type QuantityUnit = 'cases' | 'units';

export type PricedLine = {
  units: number;
  cases: number;
  gross: number;
  discount: number;
  net: number;
  freeCases: number;
  scheme: Scheme | null;
};

export function schemeApplies(scheme: Scheme, product: Product, today = todayISO()) {
  const targetsProduct = scheme.productId === product.id || (scheme.productId === null && scheme.category === product.category);
  return targetsProduct && scheme.validUntil >= today;
}

/** Prices an order line at PTR and applies the best active scheme for the quantity. */
export function priceLine(product: Product, quantity: number, unit: QuantityUnit, schemes: Scheme[]): PricedLine {
  const units = unit === 'cases' ? quantity * product.unitsPerCase : quantity;
  const cases = units / product.unitsPerCase;
  const gross = round(units * product.ptr);

  let best: Pick<PricedLine, 'discount' | 'freeCases' | 'scheme'> = { discount: 0, freeCases: 0, scheme: null };
  for (const scheme of schemes) {
    if (!schemeApplies(scheme, product) || cases < scheme.minCases) continue;
    const blocks = Math.floor(cases / scheme.minCases);
    const candidate =
      scheme.type === 'percent_off'
        ? { discount: round((gross * scheme.value) / 100), freeCases: 0, scheme }
        : scheme.type === 'flat_off'
          ? { discount: blocks * scheme.value, freeCases: 0, scheme }
          : { discount: 0, freeCases: blocks * scheme.value, scheme };
    if (benefit(candidate, product) > benefit(best, product)) best = candidate;
  }

  return { units, cases, gross, net: round(gross - best.discount), ...best };
}

function benefit(line: Pick<PricedLine, 'discount' | 'freeCases'>, product: Product) {
  return line.discount + line.freeCases * product.unitsPerCase * product.ptr;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
