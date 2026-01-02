'use client';

import { Suspense } from 'react';
import NextDynamic from 'next/dynamic';

const DashboardLayout = NextDynamic(() => import('@/components/Dashboard/DashboardLayout'), { ssr: false });
const Sidebar = NextDynamic(() => import('@/components/Dashboard/Sidebar'), { ssr: false });
const PortfolioView = NextDynamic(() => import('@/components/Dashboard/views/PortfolioView'), { ssr: false });

export const dynamic = 'force-dynamic';

export type DashboardSection = 'portfolio' | 'settings';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  return (
    <DashboardLayout
      sidebar={<Sidebar currentSection="portfolio" onSectionChange={() => {}} />}
      mainContent={<PortfolioView />}
    />
  );
}
