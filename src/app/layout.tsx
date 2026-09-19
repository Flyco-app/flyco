import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flyco',
  description: 'Flyco engineering foundation.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = (await headers()).get('x-flyco-locale') ?? 'fr';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  );
}
