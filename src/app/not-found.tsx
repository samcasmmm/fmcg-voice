import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/logo';
import { CallLine } from '@/components/not-found/call-line';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main className='flex flex-1 flex-col bg-signal text-signal-foreground selection:bg-signal-foreground selection:text-signal'>
      <div className='mx-auto flex min-h-dvh w-full max-w-352 flex-col gap-10 px-[clamp(1.25rem,4vw,4rem)] py-[clamp(1.25rem,3vw,2.5rem)]'>
        <header>
          <Link
            href='/'
            className='inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-signal-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-signal'
          >
            <Logo surface='signal' className='text-xl' />
          </Link>
        </header>

        <CallLine>
          <h1 className='max-w-[18ch] font-condensed text-[clamp(2.75rem,1.25rem+5.5vw,6rem)] leading-[0.9] font-extrabold tracking-[-0.02em] text-balance'>
            The number you have dialled does not exist.
          </h1>
          <p className='mt-6 max-w-[52ch] text-lg text-signal-foreground/75 text-pretty'>
            Please check the link and try again, or head back to the start.
          </p>
        </CallLine>
      </div>
    </main>
  );
}
