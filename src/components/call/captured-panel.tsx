import { CalendarClock, PackageCheck, Sparkles, Store } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { CapturedState } from '@/lib/agent/captured';
import { followUpLabels, formatDate, formatINR } from '@/lib/format';

export function CapturedPanel({
  captured,
  fallbackRetailer,
}: {
  captured: CapturedState;
  fallbackRetailer: { shopName: string; ownerName: string; town: string } | null;
}) {
  const retailer = captured.retailer ?? fallbackRetailer;
  const orders = captured.lines.filter((line) => line.kind === 'order');
  const interests = captured.lines.filter((line) => line.kind === 'interest');

  return (
    <aside aria-label='Captured during this call' className='flex flex-col gap-6 rounded-lg border bg-card p-5'>
      <section className='flex flex-col gap-1.5'>
        <h2 className='flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
          <Store className='size-3.5' aria-hidden='true' />
          Retailer
        </h2>
        {retailer ? (
          <p className='font-medium'>
            {retailer.shopName}
            <span className='block text-sm font-normal text-muted-foreground'>
              {retailer.ownerName} · {retailer.town}
            </span>
          </p>
        ) : (
          <p className='text-sm text-muted-foreground'>Not identified yet</p>
        )}
      </section>

      <section className='flex flex-col gap-2'>
        <h2 className='flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
          <PackageCheck className='size-3.5' aria-hidden='true' />
          Order enquiry
        </h2>
        {orders.length ? (
          <ul className='flex flex-col divide-y'>
            {orders.map((line) => (
              <li key={line.sku} className='flex flex-col gap-0.5 py-2 first:pt-0'>
                <div className='flex items-baseline justify-between gap-3'>
                  <span className='text-sm font-medium'>{line.product}</span>
                  <span className='text-sm font-semibold tabular-nums'>{formatINR(line.estimatedValue ?? 0)}</span>
                </div>
                <span className='text-xs text-muted-foreground tabular-nums'>
                  {line.quantity} {line.unit}
                  {line.freeCases ? ` + ${line.freeCases} free` : ''}
                  {line.discount ? ` · saves ${formatINR(line.discount)}` : ''}
                </span>
                {line.scheme && (
                  <Badge variant='secondary' className='mt-1 w-fit'>
                    {line.scheme}
                  </Badge>
                )}
              </li>
            ))}
            <li className='flex items-baseline justify-between pt-2'>
              <span className='text-sm text-muted-foreground'>Estimated total</span>
              <span className='font-semibold tabular-nums'>{formatINR(captured.total)}</span>
            </li>
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>Nothing ordered yet</p>
        )}
      </section>

      {interests.length > 0 && (
        <section className='flex flex-col gap-2'>
          <h2 className='flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
            <Sparkles className='size-3.5' aria-hidden='true' />
            Interested in
          </h2>
          <ul className='flex flex-wrap gap-1.5'>
            {interests.map((line) => (
              <li key={line.sku}>
                <Badge variant='outline'>{line.product}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className='flex flex-col gap-2'>
        <h2 className='flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
          <CalendarClock className='size-3.5' aria-hidden='true' />
          Follow-ups
        </h2>
        {captured.followUps.length ? (
          <ul className='flex flex-col gap-2'>
            {captured.followUps.map((followUp) => (
              <li key={followUp.id} className='text-sm'>
                <span className='font-medium'>{followUpLabels[followUp.type]}</span>
                {followUp.dueDate && (
                  <span className='text-muted-foreground tabular-nums'> · {formatDate(followUp.dueDate)}</span>
                )}
                <span className='block text-muted-foreground'>{followUp.notes}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>None yet</p>
        )}
      </section>
    </aside>
  );
}
