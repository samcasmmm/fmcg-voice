import Link from 'next/link';
import { Suspense } from 'react';

import { Logo } from '@/components/logo';
import { MainNav, NavLinks } from '@/components/main-nav';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className='flex min-h-dvh flex-col'>
      <header className='border-b bg-background/95'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6'>
          <Link href='/' className='inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'>
            <Logo className='text-lg' />
          </Link>
          <Suspense fallback={<NavLinks pathname={null} />}>
            <MainNav />
          </Suspense>
        </div>
      </header>
      <main className='mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6'>{children}</main>
    </div>
  );
}
