'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Call' },
  { href: '/history', label: 'History' },
  { href: '/catalogue', label: 'Catalogue' },
] as const;

export function MainNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Without a pathname (the prerendered shell) no link is highlighted. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label='Main'>
      <ul className='flex items-center gap-1'>
        {LINKS.map(({ href, label }) => {
          const active = pathname !== null && (href === '/' ? pathname === '/' : pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'bg-signal text-signal-foreground hover:text-signal-foreground',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
