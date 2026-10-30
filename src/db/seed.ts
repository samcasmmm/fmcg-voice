// Resets the database to the demo dataset. All companies, brands, people and phone numbers are fictional.
// Run with: bun run db:seed
import { sql } from 'drizzle-orm';

import { db } from './index';
import { products, retailers, schemes } from './schema';

const PRODUCTS = [
  {
    sku: 'SCP-ATTA-5',
    name: 'Khetsona Chakki Atta',
    brand: 'Khetsona',
    category: 'Staples',
    packSize: '5 kg',
    unitsPerCase: 4,
    mrp: 285,
    ptr: 252,
    stockStatus: 'in_stock',
    aliases: ['atta', 'aata', 'wheat flour', 'आटा', 'गेहूं का आटा'],
    description: 'Stone-ground whole wheat atta, our fastest moving staple.',
  },
  {
    sku: 'SCP-ATTA-10',
    name: 'Khetsona Chakki Atta',
    brand: 'Khetsona',
    category: 'Staples',
    packSize: '10 kg',
    unitsPerCase: 2,
    mrp: 545,
    ptr: 485,
    stockStatus: 'low_stock',
    aliases: ['atta', 'aata', 'wheat flour', 'आटा'],
    description: 'Family pack of Khetsona atta.',
  },
  {
    sku: 'SCP-TEA-250',
    name: 'Chaiwala Gold Tea',
    brand: 'Chaiwala',
    category: 'Beverages',
    packSize: '250 g',
    unitsPerCase: 24,
    mrp: 150,
    ptr: 128,
    stockStatus: 'in_stock',
    aliases: ['tea', 'chai', 'chai patti', 'चाय', 'चाय पत्ती'],
    description: 'Strong Assam CTC tea blend.',
  },
  {
    sku: 'SCP-TEA-1K',
    name: 'Chaiwala Gold Tea',
    brand: 'Chaiwala',
    category: 'Beverages',
    packSize: '1 kg',
    unitsPerCase: 12,
    mrp: 560,
    ptr: 482,
    stockStatus: 'in_stock',
    aliases: ['tea', 'chai', 'chai patti', 'चाय'],
    description: 'Value pack of Chaiwala Gold for high-volume shops and tea stalls.',
  },
  {
    sku: 'SCP-SOAP-4X100',
    name: 'Kesar Glow Soap',
    brand: 'Kesar Glow',
    category: 'Personal Care',
    packSize: '4 × 100 g',
    unitsPerCase: 18,
    mrp: 140,
    ptr: 118,
    stockStatus: 'in_stock',
    aliases: ['soap', 'sabun', 'bathing soap', 'साबुन'],
    description: 'Saffron and sandal bathing soap, pack of four.',
  },
  {
    sku: 'SCP-SHMP-180',
    name: 'Kesar Glow Shampoo',
    brand: 'Kesar Glow',
    category: 'Personal Care',
    packSize: '180 ml',
    unitsPerCase: 24,
    mrp: 175,
    ptr: 148,
    stockStatus: 'out_of_stock',
    aliases: ['shampoo', 'शैम्पू'],
    description: 'Anti-dandruff shampoo. Restock expected in about 10 days.',
  },
  {
    sku: 'SCP-DET-1K',
    name: 'Dhoop Detergent Powder',
    brand: 'Dhoop',
    category: 'Home Care',
    packSize: '1 kg',
    unitsPerCase: 20,
    mrp: 120,
    ptr: 101,
    stockStatus: 'in_stock',
    aliases: ['detergent', 'washing powder', 'surf', 'सर्फ', 'कपड़े धोने का पाउडर'],
    description: 'Lemon fresh washing powder for bucket and machine wash.',
  },
  {
    sku: 'SCP-DISH-500',
    name: 'Nimbu Fresh Dishwash Gel',
    brand: 'Nimbu Fresh',
    category: 'Home Care',
    packSize: '500 ml',
    unitsPerCase: 24,
    mrp: 110,
    ptr: 92,
    stockStatus: 'low_stock',
    aliases: ['dishwash', 'bartan liquid', 'बर्तन धोने का लिक्विड'],
    description: 'Lemon dishwash gel that cuts grease fast.',
  },
  {
    sku: 'SCP-BHUJIA-200',
    name: 'Crunchos Aloo Bhujia',
    brand: 'Crunchos',
    category: 'Snacks',
    packSize: '200 g',
    unitsPerCase: 40,
    mrp: 55,
    ptr: 46,
    stockStatus: 'in_stock',
    aliases: ['bhujia', 'namkeen', 'भुजिया', 'नमकीन'],
    description: 'Spicy potato bhujia, a counter favourite.',
  },
  {
    sku: 'SCP-BISC-100',
    name: 'Crunchos Cream Biscuits',
    brand: 'Crunchos',
    category: 'Snacks',
    packSize: '100 g',
    unitsPerCase: 96,
    mrp: 20,
    ptr: 16.5,
    stockStatus: 'in_stock',
    aliases: ['biscuit', 'cream biscuit', 'बिस्कुट'],
    description: 'Elaichi cream biscuits for impulse sales.',
  },
] satisfies (typeof products.$inferInsert)[];

const RETAILERS = [
  { shopName: 'Sharma Kirana Store', ownerName: 'Rajesh Sharma', phone: '9000000001', town: 'Pune', area: 'Kothrud', language: 'en' },
  { shopName: 'Gupta General Store', ownerName: 'Sunita Gupta', phone: '9000000002', town: 'Indore', area: 'Vijay Nagar', language: 'hi' },
  { shopName: 'Patel Provision Stores', ownerName: 'Hitesh Patel', phone: '9000000003', town: 'Ahmedabad', area: 'Maninagar', language: 'en' },
  { shopName: 'Laxmi Super Mart', ownerName: 'Meena Iyer', phone: '9000000004', town: 'Nagpur', area: 'Dharampeth', language: 'en' },
  { shopName: 'Khan Brothers Kirana', ownerName: 'Imran Khan', phone: '9000000005', town: 'Lucknow', area: 'Aminabad', language: 'hi' },
  { shopName: 'Shree Ganesh Traders', ownerName: 'Prakash Jadhav', phone: '9000000006', town: 'Nashik', area: 'College Road', language: 'hi' },
] satisfies (typeof retailers.$inferInsert)[];

async function main() {
  await db.execute(
    sql`truncate table follow_ups, captured_items, conversations, schemes, retailers, products restart identity cascade`,
  );

  const inserted = await db.insert(products).values(PRODUCTS).returning({ id: products.id, sku: products.sku });
  const id = (sku: string) => inserted.find((p) => p.sku === sku)!.id;

  await db.insert(schemes).values([
    {
      code: 'KHET-10+1',
      title: 'Buy 10 cases, get 1 free',
      description: 'On Khetsona Chakki Atta 5 kg: 1 free case for every 10 cases ordered.',
      type: 'free_cases',
      productId: id('SCP-ATTA-5'),
      minCases: 10,
      value: 1,
      validUntil: '2026-12-31',
    },
    {
      code: 'CHAI-8',
      title: '8% off on Chaiwala Gold 1 kg',
      description: '8% off the retailer price when ordering 5 or more cases of Chaiwala Gold Tea 1 kg.',
      type: 'percent_off',
      productId: id('SCP-TEA-1K'),
      minCases: 5,
      value: 8,
      validUntil: '2026-11-30',
    },
    {
      code: 'KESAR-3+1',
      title: 'Buy 3 cases, get 1 free',
      description: 'On Kesar Glow Soap 4 × 100 g: 1 free case for every 3 cases ordered.',
      type: 'free_cases',
      productId: id('SCP-SOAP-4X100'),
      minCases: 3,
      value: 1,
      validUntil: '2026-12-15',
    },
    {
      code: 'DHOOP-150',
      title: '₹150 off every 10 cases',
      description: 'Flat ₹150 off for every 10 cases of Dhoop Detergent Powder 1 kg.',
      type: 'flat_off',
      productId: id('SCP-DET-1K'),
      minCases: 10,
      value: 150,
      validUntil: '2026-12-31',
    },
    {
      code: 'FESTIVE-SNACKS',
      title: 'Festive 5% off on snacks',
      description: '5% off on any Crunchos snack when ordering 5 or more cases of that product.',
      type: 'percent_off',
      category: 'Snacks',
      minCases: 5,
      value: 5,
      validUntil: '2026-11-30',
    },
  ]);

  await db.insert(retailers).values(RETAILERS);

  console.log(`Seeded ${PRODUCTS.length} products, 5 schemes, ${RETAILERS.length} retailers.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
