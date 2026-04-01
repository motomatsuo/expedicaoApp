import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Moto Matsuo | Expedicao',
  description: 'Portal da equipe de expedicao Moto Matsuo',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#980f0f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-app text-primary">{children}</body>
    </html>
  );
}
