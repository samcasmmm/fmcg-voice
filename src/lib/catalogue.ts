import 'server-only';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { asc } from 'drizzle-orm';

import { db } from '@/db';
import { products, retailers, schemes, type Product, type Scheme } from '@/db/schema';
import { schemeApplies } from '@/lib/pricing';

export type CatalogueEntry = Product & { schemes: Scheme[] };

export async function getCatalogue(): Promise<CatalogueEntry[]> {
  const [allProducts, allSchemes] = await Promise.all([
    db.select().from(products).orderBy(asc(products.category), asc(products.name), asc(products.id)),
    db.select().from(schemes),
  ]);
  return allProducts.map((product) => ({
    ...product,
    schemes: allSchemes.filter((scheme) => schemeApplies(scheme, product)),
  }));
}

export type ProductCardData = CatalogueEntry & { image: string | null };

const IMAGE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg'];

/** Catalogue plus product photos dropped into public/products/<SKU>.<ext>; cards fall back to a tile without one. */
export async function getDisplayCatalogue(): Promise<ProductCardData[]> {
  const catalogue = await getCatalogue();
  return catalogue.map((product) => {
    const ext = IMAGE_EXTENSIONS.find((e) => existsSync(path.join(process.cwd(), 'public', 'products', `${product.sku}.${e}`)));
    return { ...product, image: ext ? `/products/${product.sku}.${ext}` : null };
  });
}

export async function getSchemes() {
  return db.select().from(schemes).orderBy(asc(schemes.validUntil));
}

export async function getRetailers() {
  return db.select().from(retailers).orderBy(asc(retailers.shopName));
}
