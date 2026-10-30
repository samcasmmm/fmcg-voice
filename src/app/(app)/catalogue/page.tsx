import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ProductThumb } from '@/components/product-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { COMPANY } from '@/lib/agent/prompt';
import { getDisplayCatalogue, getSchemes } from '@/lib/catalogue';
import { formatDate, formatINR, stockLabels } from '@/lib/format';
import { todayISO } from '@/lib/pricing';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Catalogue' };

const stockStyles = {
  in_stock: 'border-foreground/20 bg-transparent text-foreground',
  low_stock: 'bg-accent text-accent-foreground border-transparent',
  out_of_stock: 'bg-live/10 text-live border-transparent',
} as const;

export default function CataloguePage() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-condensed text-3xl leading-none font-extrabold tracking-[-0.01em]'>Catalogue</h1>
        <p className='text-muted-foreground text-pretty'>
          The sample data Asha answers from: products, retailer prices, stock and active schemes of {COMPANY} (a fictional company).
        </p>
      </div>
      <Suspense fallback={<Skeleton className='h-[36rem] w-full' />}>
        <CatalogueTables />
      </Suspense>
    </div>
  );
}

async function CatalogueTables() {
  await connection();
  const [catalogue, schemes] = await Promise.all([getDisplayCatalogue(), getSchemes()]);
  const today = todayISO();

  return (
    <>
      <section className='rounded-lg border bg-card'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className='text-right'>Retailer price</TableHead>
              <TableHead className='text-right'>Per case</TableHead>
              <TableHead className='text-right'>MRP</TableHead>
              <TableHead className='text-right'>Margin</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Schemes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalogue.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className='flex items-center gap-3'>
                    <ProductThumb product={product} className='size-12 [&_span]:hidden [&_svg]:size-5' />
                    <div>
                      <span className='font-medium'>
                        {product.name} {product.packSize}
                      </span>
                      <span className='block text-xs text-muted-foreground'>{product.sku}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell className='text-right tabular-nums'>{formatINR(product.ptr)}</TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatINR(product.ptr * product.unitsPerCase)}
                  <span className='block text-xs text-muted-foreground'>{product.unitsPerCase} units</span>
                </TableCell>
                <TableCell className='text-right tabular-nums'>{formatINR(product.mrp)}</TableCell>
                <TableCell className='text-right tabular-nums'>
                  {Math.round(((product.mrp - product.ptr) / product.mrp) * 100)}%
                </TableCell>
                <TableCell>
                  <Badge className={cn(stockStyles[product.stockStatus])}>{stockLabels[product.stockStatus]}</Badge>
                </TableCell>
                <TableCell>
                  {product.schemes.length ? (
                    <ul className='flex flex-col gap-1'>
                      {product.schemes.map((scheme) => (
                        <li key={scheme.id}>
                          <Badge variant='secondary'>{scheme.code}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-semibold'>Schemes</h2>
        <ul className='grid gap-3 sm:grid-cols-2'>
          {schemes.map((scheme) => (
            <li key={scheme.id} className='flex flex-col gap-1 rounded-lg border bg-card p-4'>
              <div className='flex items-center justify-between gap-2'>
                <span className='font-medium'>{scheme.title}</span>
                <Badge variant='secondary'>{scheme.code}</Badge>
              </div>
              <p className='text-sm text-muted-foreground'>{scheme.description}</p>
              <p className='text-xs text-muted-foreground tabular-nums'>
                {scheme.validUntil < today ? 'Expired' : 'Valid until'} {formatDate(scheme.validUntil)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
