import { Coffee, Cookie, Package, Sparkles, SprayCan, Wheat, type LucideIcon } from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import type { ProductCardData } from '@/lib/catalogue';
import { formatINR, stockLabels } from '@/lib/format';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, LucideIcon> = {
  Staples: Wheat,
  Beverages: Coffee,
  'Personal Care': Sparkles,
  'Home Care': SprayCan,
  Snacks: Cookie,
};

const stockStyles = {
  in_stock: 'border-foreground/20 bg-transparent text-foreground',
  low_stock: 'bg-accent text-accent-foreground border-transparent',
  out_of_stock: 'bg-live/10 text-live border-transparent',
} as const;

/** Product photo from public/products, or a category tile with the pack size when there is none. Size it with className. */
export function ProductThumb({ product, className }: { product: ProductCardData; className?: string }) {
  if (product.image) {
    return (
      <div className={cn('relative size-18 shrink-0 overflow-hidden rounded-md border bg-white', className)}>
        <Image src={product.image} alt={`${product.name} ${product.packSize}`} fill sizes='160px' className='object-cover' />
      </div>
    );
  }
  const Icon = categoryIcons[product.category] ?? Package;
  return (
    <div
      aria-hidden='true'
      className={cn(
        'flex size-18 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md bg-signal text-signal-foreground',
        className,
      )}
    >
      <Icon className='size-7' strokeWidth={1.75} />
      <span className='text-xs leading-none font-semibold tabular-nums'>{product.packSize}</span>
    </div>
  );
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const margin = Math.round(((product.mrp - product.ptr) / product.mrp) * 100);
  return (
    <article className='flex h-full gap-3 rounded-lg border bg-card p-3'>
      {/* The thumbnail runs the full height of the card. */}
      <ProductThumb product={product} className='h-auto min-h-24 w-22 self-stretch' />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <h3 className='text-sm leading-snug font-semibold'>
          {product.name} <span className='font-normal whitespace-nowrap text-muted-foreground'>{product.packSize}</span>
        </h3>
        <div className='grid grid-cols-[auto_1fr] items-baseline gap-x-1.5 text-sm tabular-nums'>
          <span className='font-semibold'>{formatINR(product.ptr)}</span>
          <span className='text-muted-foreground'>per pack</span>
          <span className='font-medium'>{formatINR(product.ptr * product.unitsPerCase)}</span>
          <span className='text-muted-foreground'>per case of {product.unitsPerCase}</span>
        </div>
        <p className='text-xs text-muted-foreground tabular-nums'>
          MRP {formatINR(product.mrp)} · {margin}% margin
        </p>
        <div className='mt-auto flex flex-wrap gap-1 pt-1'>
          <Badge className={cn(stockStyles[product.stockStatus])}>{stockLabels[product.stockStatus]}</Badge>
          {product.schemes.map((scheme) => (
            <Badge key={scheme.id} variant='secondary' title={scheme.description} className='h-auto max-w-full rounded-md whitespace-normal'>
              {scheme.title}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
}
