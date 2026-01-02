import React from 'react';
import type { Metadata } from "next";
import { Space_Grotesk } from 'next/font/google';
import "./globals.css";
import "@/styles/scrollbar-hide.css";
import ClientLayout from '@/components/ClientLayout';
import Providers from '@/components/Providers';

const spaceGrotesk = Space_Grotesk({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk'
});

export const metadata: Metadata = {
  title: "Companeon | AI Crypto Companion",
  description: "Companeon — your AI companion for crypto portfolio insights and actions.",
  metadataBase: new URL("https://companeon.io"),
  keywords: [
    'Companeon', 
    'crypto security', 
    'AI crypto assistant', 
    'asset protection', 
    'soulbound NFT', 
    'untransferable digital assets',
    'secure crypto storage', 
    'NFT security vault',
    'Ethereum asset protection',
    'secure wallet protection',
    'Companeon',
    'cryptocurrency security platform',
    'digital asset security',
    'safe deposit box',
    'safe'
  ],
  alternates: { canonical: 'https://companeon.io' },
  openGraph: {
    title: "Companeon | AI Crypto Companion",
    description: "Companeon — your AI companion for crypto portfolio insights and actions.",
    url: "https://companeon.io",
    siteName: "Companeon",
    images: ["/companeon-og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Companeon | AI Crypto Companion",
    description: "Companeon — your AI companion for crypto portfolio insights and actions.",
    images: ["/companeon-og-image.png"],
    creator: "@companeon",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/companeon_symbol_square.png', sizes: '16x16', type: 'image/png' },
      { url: '/companeon_symbol_square.png', sizes: '32x32', type: 'image/png' },
      { url: '/companeon_symbol_square.png', sizes: '192x192', type: 'image/png' },
      { url: '/companeon_symbol_square.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/companeon_symbol_square.png', sizes: '180x180' }
    ],
    shortcut: '/favicon.ico'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FFFFFF" />
      </head>
      <body className="min-h-screen bg-white">
        <Providers>
        <ClientLayout>
          {children}
        </ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
