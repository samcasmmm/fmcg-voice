import { describe, expect, test } from 'bun:test';

import { findProductMentions } from '@/lib/product-mentions';

const catalogue = [
  { sku: 'ATTA-5', name: 'Khetsona Chakki Atta', brand: 'Khetsona', packSize: '5 kg', aliases: ['atta', 'आटा'] },
  { sku: 'ATTA-10', name: 'Khetsona Chakki Atta', brand: 'Khetsona', packSize: '10 kg', aliases: ['atta', 'आटा'] },
  { sku: 'TEA-250', name: 'Chaiwala Gold Tea', brand: 'Chaiwala', packSize: '250 g', aliases: ['chai'] },
  { sku: 'TEA-1K', name: 'Chaiwala Gold Tea', brand: 'Chaiwala', packSize: '1 kg', aliases: ['chai'] },
  { sku: 'SOAP', name: 'Kesar Glow Soap', brand: 'Kesar Glow', packSize: '4 × 100 g', aliases: ['soap'] },
  { sku: 'SHMP', name: 'Kesar Glow Shampoo', brand: 'Kesar Glow', packSize: '180 ml', aliases: ['shampoo'] },
  { sku: 'BHUJIA', name: 'Crunchos Aloo Bhujia', brand: 'Crunchos', packSize: '200 g', aliases: ['namkeen'] },
  { sku: 'BISC', name: 'Crunchos Cream Biscuits', brand: 'Crunchos', packSize: '100 g', aliases: ['biscuit'] },
];

const skus = (text: string) => findProductMentions(text, catalogue).map((p) => p.sku);

describe('findProductMentions', () => {
  test('a pack size picks one SKU', () => {
    expect(skus('Chaiwala Gold Tea 1 kg is ₹482 per pack.')).toEqual(['TEA-1K']);
    expect(skus('Khetsona atta 5kg is in stock')).toEqual(['ATTA-5']);
  });

  test('without a pack size, every pack of that product matches', () => {
    expect(skus('We have Chaiwala Gold Tea in two packs.')).toEqual(['TEA-250', 'TEA-1K']);
  });

  test('product words tell apart products of one brand', () => {
    expect(skus('Kesar Glow Shampoo is out of stock, but Kesar Glow Soap is available.')).toEqual(['SHMP', 'SOAP']);
    expect(skus('Try Crunchos Cream Biscuits with your tea.')).toEqual(['BISC']);
  });

  test('keeps the order of first mention', () => {
    expect(skus('Crunchos Aloo Bhujia 200 g and Chaiwala Gold Tea 250 g')).toEqual(['BHUJIA', 'TEA-250']);
  });

  test('a bare brand matches all its products', () => {
    expect(skus('Crunchos snacks have a festive scheme.')).toEqual(['BHUJIA', 'BISC']);
  });

  test('works in Hindi replies with English brand names', () => {
    expect(skus('Khetsona आटा 5 किलो का रेट ₹252 प्रति पैक है।')).toEqual(['ATTA-5']);
  });

  test('ignores text without brands', () => {
    expect(skus('Thank you, goodbye.')).toEqual([]);
  });
});
