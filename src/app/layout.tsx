import type { Metadata } from 'next';
import { Anek_Devanagari, Anek_Latin } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

const anekLatin = Anek_Latin({
  variable: '--font-anek-latin',
  subsets: ['latin'],
  axes: ['wdth'],
});

const anekDevanagari = Anek_Devanagari({
  variable: '--font-anek-devanagari',
  subsets: ['devanagari'],
  axes: ['wdth'],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: 'FMCG Voice',
    template: '%s · FMCG Voice',
  },
  description: 'AI voice agent for FMCG retailer engagement',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className={`${anekLatin.className} ${anekDevanagari.variable} h-full antialiased`}>
      <body className='min-h-full flex flex-col'>
        {children}
        <Toaster position='top-center' />
      </body>
    </html>
  );
}
