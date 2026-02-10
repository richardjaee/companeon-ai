'use client';

import { Suspense, useState } from 'react';
import NextDynamic from 'next/dynamic';

const DashboardLayout = NextDynamic(() => import('@/components/Dashboard/DashboardLayout'), { ssr: false });
const Sidebar = NextDynamic(() => import('@/components/Dashboard/Sidebar'), { ssr: false });
const PortfolioView = NextDynamic(() => import('@/components/Dashboard/views/PortfolioView'), { ssr: false });
const AccountView = NextDynamic(() => import('@/components/Dashboard/views/AccountView'), { ssr: false });

export const dynamic = 'force-dynamic';

export type DashboardSection = 'portfolio' | 'account';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  const [currentSection, setCurrentSection] = useState<DashboardSection>('portfolio');

  const renderContent = () => {
    switch (currentSection) {
      case 'account':
        return <AccountView />;
      case 'portfolio':
      default:
        return <PortfolioView />;
    }
  };

  return (
    <DashboardLayout
      sidebar={<Sidebar currentSection={currentSection} onSectionChange={setCurrentSection} />}
      mainContent={renderContent()}
    />
  );
}
