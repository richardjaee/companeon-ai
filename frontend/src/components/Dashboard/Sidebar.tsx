'use client';

import { DashboardSection } from '@/app/[chain]/dashboard/page';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import DisconnectConfirmModal from '@/components/Auth/DisconnectConfirmModal';

interface SidebarProps {
  currentSection: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

interface NavItem {
  id: DashboardSection;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    id: 'account',
    label: 'Usage',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  }
];

export default function Sidebar({ currentSection, onSectionChange, isMobile = false, onClose }: SidebarProps) {
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleSectionClick = (section: DashboardSection) => {
    onSectionChange(section);
    if (isMobile && onClose) {
      onClose();
    }
  };

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleSectionClick(item.id)}
                  className={`flex items-center w-full px-4 py-3 text-left rounded-lg transition-colors ${
                    currentSection === item.id
                      ? 'text-purple-700 bg-purple-50 border border-purple-200'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="mr-3">
                    {item.icon}
                  </div>
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <DisconnectConfirmModal
          isOpen={showDisconnectModal}
          onClose={() => setShowDisconnectModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white w-20 border-r border-gray-200">
      {/* Logo Section - aligned with the Portfolio header */}
      <div className="pt-5 pb-6 px-3 flex-shrink-0 flex justify-center">
        <Link href="/" className="flex items-center justify-center">
          <Image
            src="/companeon_symbol_square.png"
            alt="Companeon"
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        <ul className="space-y-4 mt-2">
          {navItems.map((item) => (
            <li key={item.id} className="flex justify-center">
              <button
                onClick={() => handleSectionClick(item.id)}
                className={`flex flex-col items-center px-2 py-3 text-xs font-medium transition-colors w-16 rounded-lg ${
                  currentSection === item.id
                    ? 'text-purple-700 bg-purple-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                title={item.label}
              >
                <div className="mb-1">
                  {item.icon}
                </div>
                <span className="text-center leading-tight">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <DisconnectConfirmModal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
      />
    </div>
  );
} 
