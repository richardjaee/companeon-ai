import { ReactNode } from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Companeon',
  description: 'Manage your crypto portfolio and use the Companeon AI assistant.',
  keywords: ['companeon dashboard', 'crypto portfolio', 'secure wallet dashboard'],
  alternates: { canonical: 'https://companeon.io/dashboard' },
  openGraph: {
    title: 'Dashboard | Companeon',
    description: 'Manage your crypto portfolio and use the Companeon AI assistant.',
    url: 'https://companeon.io/dashboard',
    type: 'website',
  },
  robots: {
    index: false,
    follow: true,
  },
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
