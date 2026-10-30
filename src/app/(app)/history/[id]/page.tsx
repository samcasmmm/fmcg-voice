import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { z } from 'zod';

import { Transcript } from '@/components/call/transcript';
import { OutcomeBadge } from '@/components/outcome-badge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AgentUIMessage } from '@/lib/agent/tools';
import { getDisplayCatalogue } from '@/lib/catalogue';
import { getConversationDetail } from '@/lib/conversations';
import { followUpLabels, formatDate, formatDateTime, formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Call details' };

export default function CallDetailPage({ params }: PageProps<'/history/[id]'>) {
  return (
    <div className='flex flex-col gap-6'>
      <Link href='/history' className='w-fit text-sm text-muted-foreground hover:text-foreground'>
        ← All calls
      </Link>
      <Suspense fallback={<Skeleton className='h-[32rem] w-full' />}>
        <CallDetail params={params} />
      </Suspense>
    </div>
  );
}

async function CallDetail({ params }: Pick<PageProps<'/history/[id]'>, 'params'>) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, catalogue] = await Promise.all([getConversationDetail(id), getDisplayCatalogue()]);
  if (!detail) notFound();

  const { conversation, retailer, items, followUps } = detail;
  const orders = items.filter(({ item }) => item.kind === 'order');
  const interests = items.filter(({ item }) => item.kind === 'interest');
  const total = orders.reduce((sum, { item }) => sum + (item.estimatedValue ?? 0), 0);
  const minutes =
    conversation.endedAt && Math.max(1, Math.round((conversation.endedAt.getTime() - conversation.startedAt.getTime()) / 60000));

  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]'>
      <div className='flex flex-col gap-6'>
        <header className='flex flex-col gap-2'>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='font-condensed text-3xl leading-none font-extrabold tracking-[-0.01em]'>
              {retailer?.shopName ?? conversation.retailerName ?? 'Unidentified retailer'}
            </h1>
            <OutcomeBadge outcome={conversation.outcome} status={conversation.status} />
            {!retailer && conversation.retailerName && <Badge variant='outline'>New lead</Badge>}
          </div>
          <p className='text-sm text-muted-foreground tabular-nums'>
            {retailer && `${retailer.ownerName} · ${retailer.area}, ${retailer.town} · `}
            {formatDateTime(conversation.startedAt)}
            {minutes && ` · ${minutes} min`} · {conversation.language === 'hi' ? 'Hindi' : 'English'}
          </p>
        </header>

        <section className='flex flex-col gap-3 rounded-lg border bg-card p-5'>
          <h2 className='text-sm font-semibold'>Summary</h2>
          <p className='leading-relaxed text-pretty'>{conversation.summary ?? 'This call was not ended, so no summary was generated.'}</p>
          {conversation.nextSteps && conversation.nextSteps !== 'None' && (
            <p className='text-sm'>
              <span className='font-semibold'>Next step: </span>
              {conversation.nextSteps}
            </p>
          )}
        </section>

        <section className='flex flex-col gap-3'>
          <h2 className='text-sm font-semibold'>Order enquiry</h2>
          {orders.length ? (
            <div className='rounded-lg border bg-card'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className='text-right'>Quantity</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead className='text-right'>Est. value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(({ item, product, scheme }) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className='font-medium'>
                          {product.name} {product.packSize}
                        </span>
                        <span className='block text-xs text-muted-foreground'>{product.sku}</span>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {item.quantity} {item.unit}
                        {item.freeCases ? <span className='block text-xs text-muted-foreground'>+{item.freeCases} free</span> : null}
                      </TableCell>
                      <TableCell>{scheme ? <Badge variant='secondary'>{scheme.title}</Badge> : '—'}</TableCell>
                      <TableCell className='text-right font-medium tabular-nums'>{formatINR(item.estimatedValue ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Estimated total (at retailer price, after schemes)</TableCell>
                    <TableCell className='text-right font-semibold tabular-nums'>{formatINR(total)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>No order lines captured.</p>
          )}
        </section>

        {interests.length > 0 && (
          <section className='flex flex-col gap-3'>
            <h2 className='text-sm font-semibold'>Product interest</h2>
            <ul className='flex flex-wrap gap-2'>
              {interests.map(({ item, product }) => (
                <li key={item.id}>
                  <Badge variant='outline'>
                    {product.name} {product.packSize}
                    {product.stockStatus === 'out_of_stock' && ' · out of stock'}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className='flex flex-col gap-3'>
          <h2 className='text-sm font-semibold'>Follow-ups</h2>
          {followUps.length ? (
            <ul className='flex flex-col divide-y rounded-lg border bg-card'>
              {followUps.map((followUp) => (
                <li key={followUp.id} className='flex flex-col gap-0.5 px-4 py-3'>
                  <span className='text-sm font-medium'>
                    {followUpLabels[followUp.type]}
                    {followUp.dueDate && (
                      <span className='font-normal text-muted-foreground tabular-nums'> · {formatDate(followUp.dueDate)}</span>
                    )}
                  </span>
                  <span className='text-sm text-muted-foreground'>{followUp.notes}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-muted-foreground'>No follow-ups.</p>
          )}
        </section>
      </div>

      <section className='flex flex-col gap-3'>
        <h2 className='text-sm font-semibold'>Transcript</h2>
        <div className='flex max-h-[44rem] flex-col rounded-lg border bg-card px-4'>
          <Transcript messages={conversation.messages as AgentUIMessage[]} interim='' catalogue={catalogue} />
        </div>
      </section>
    </div>
  );
}
