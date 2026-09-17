import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flyco',
  description: 'Flyco engineering foundation.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
