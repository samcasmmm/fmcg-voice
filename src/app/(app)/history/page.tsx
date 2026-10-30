import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { OutcomeBadge } from '@/components/outcome-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listConversations } from '@/lib/conversations';
import { formatDateTime, formatINR } from '@/lib/format';

export const metadata: Metadata = { title: 'Call history' };

export default function HistoryPage() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-condensed text-3xl leading-none font-extrabold tracking-[-0.01em]'>Call history</h1>
        <p className='text-muted-foreground'>Every conversation with its outcome, captured order value and follow-ups.</p>
      </div>
      <Suspense fallback={<Skeleton className='h-80 w-full' />}>
        <HistoryTable />
      </Suspense>
    </div>
  );
}

async function HistoryTable() {
  await connection();
  const calls = await listConversations();

  if (!calls.length) {
    return (
      <div className='flex flex-col items-start gap-3 rounded-lg border border-dashed p-8'>
        <p className='font-medium'>No calls yet</p>
        <p className='text-sm text-muted-foreground'>Start a call and it will show up here once it ends.</p>
        <Button asChild>
          <Link href='/'>Start a call</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className='rounded-lg border bg-card'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Retailer</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className='text-right'>Order lines</TableHead>
            <TableHead className='text-right'>Est. value</TableHead>
            <TableHead className='text-right'>Follow-ups</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id} className='relative'>
              <TableCell className='whitespace-nowrap tabular-nums'>
                {/* The link covers the whole row; other cells stay plain text. */}
                <Link
                  href={`/history/${call.id}`}
                  className='outline-none after:absolute after:inset-0 focus-visible:underline'
                >
                  {formatDateTime(call.startedAt)}
                </Link>
              </TableCell>
              <TableCell>
                <span className='font-medium'>{call.shopName ?? 'Unidentified retailer'}</span>
                {call.town && <span className='block text-xs text-muted-foreground'>{call.town}</span>}
              </TableCell>
              <TableCell>
                <OutcomeBadge outcome={call.outcome} status={call.status} />
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                {call.orderLines}
                {call.interestLines > 0 && (
                  <span className='block text-xs text-muted-foreground'>+{call.interestLines} interest</span>
                )}
              </TableCell>
              <TableCell className='text-right font-medium tabular-nums'>
                {call.value ? formatINR(call.value) : '—'}
              </TableCell>
              <TableCell className='text-right tabular-nums'>{call.followUps || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
