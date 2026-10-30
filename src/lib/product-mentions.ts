import type { Product } from '@/db/schema';

type Mentionable = Pick<Product, 'sku' | 'name' | 'brand' | 'packSize' | 'aliases'>;

const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  किलो: 'kg',
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  ग्राम: 'g',
  ml: 'ml',
  मिली: 'ml',
};

const PACK_PATTERN = /(\d+(?:\.\d+)?)\s*(kgs?|kilos?|किलो|gms?|grams?|g|ग्राम|ml|मिली)(?![\p{L}])/iu;

function normalisePack(text: string) {
  const match = PACK_PATTERN.exec(text);
  return match ? `${Number(match[1])} ${UNIT_ALIASES[match[2].toLowerCase()]}` : null;
}

/** Words that tell products of the same brand apart ("bhujia" vs "biscuits"), plus their colloquial aliases. */
function productWords(product: Mentionable) {
  const brandWords = new Set(product.brand.toLowerCase().split(/\s+/));
  const nameWords = product.name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => !brandWords.has(w))
    .map((w) => w.replace(/s$/, ''));
  return [...nameWords, ...product.aliases.map((a) => a.toLowerCase())].filter((w) => w.length > 2);
}

/**
 * Finds catalogue products named in a reply, in order of first mention.
 * A mention is the brand name followed shortly by a product word ("Crunchos bhujia"); a pack size
 * right after it ("Chaiwala Gold Tea 1 kg") narrows it to one SKU. A bare brand matches all its products.
 */
export function findProductMentions<T extends Mentionable>(text: string, catalogue: T[]): T[] {
  const lower = text.toLowerCase();
  const found = new Map<string, { product: T; at: number }>();
  const brands = [...new Set(catalogue.map((p) => p.brand))];

  for (const brand of brands) {
    const family = catalogue.filter((p) => p.brand === brand);
    const needle = brand.toLowerCase();
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
      const after = lower.slice(at + needle.length, at + needle.length + 40);
      let matches = family.filter((p) => productWords(p).some((w) => after.includes(w)));
      if (!matches.length) matches = family;

      const pack = normalisePack(after);
      const sized = pack ? matches.filter((p) => normalisePack(p.packSize) === pack) : [];
      if (sized.length) matches = sized;

      for (const product of matches) {
        if (!found.has(product.sku)) found.set(product.sku, { product, at });
      }
    }
  }

  return [...found.values()].sort((a, b) => a.at - b.at).map((entry) => entry.product);
}
