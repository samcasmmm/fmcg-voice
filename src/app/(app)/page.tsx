import { connection } from 'next/server';
import { Suspense } from 'react';

import { CallExperience } from '@/components/call/call-experience';
import { Skeleton } from '@/components/ui/skeleton';
import { sarvamConfigured } from '@/lib/ai/sarvam';
import { getDisplayCatalogue, getRetailers } from '@/lib/catalogue';

export default function CallPage() {
  return (
    <Suspense fallback={<SetupSkeleton />}>
      <CallLoader />
    </Suspense>
  );
}

async function CallLoader() {
  await connection();
  const [retailers, catalogue] = await Promise.all([getRetailers(), getDisplayCatalogue()]);
  return <CallExperience retailers={retailers} catalogue={catalogue} sarvam={sarvamConfigured()} />;
}

function SetupSkeleton() {
  return (
    <div className='mx-auto flex max-w-xl flex-col gap-8 py-6'>
      <Skeleton className='h-20 w-full' />
      <Skeleton className='h-96 w-full' />
    </div>
  );
}
