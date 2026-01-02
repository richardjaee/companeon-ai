'use client';

import { useState, cloneElement, ReactElement, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import Image from 'next/image';

import * as Sentry from '@sentry/nextjs';

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  rightPanel?: React.ReactNode;
}

export default function DashboardLayout({ 
  sidebar, 
  mainContent, 
  rightPanel 
}: DashboardLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  
  const { isConnected, disconnectWallet } = useWallet();
  



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header with Menu Button - Only show on mobile */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Logo for mobile (placeholder text, no image asset) */}
        <div className="text-base font-semibold">Companeon</div>
        
        {/* Right panel toggle for tablet/mobile */}
        {rightPanel && (
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="xl:hidden p-2 rounded-md hover:bg-gray-100"
            aria-label="Toggle right panel"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex min-h-screen lg:h-screen bg-gray-50">
        {/* Mobile Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            
            {/* Sidebar */}
            <div className="relative flex flex-col w-64 bg-white border-r border-gray-200">
              {/* Close button */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="text-base font-semibold">Companeon</div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-2 rounded-md hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Mobile sidebar content */}
              <div className="flex-1 overflow-y-auto">
                {cloneElement(sidebar as ReactElement<any>, { 
                  isMobile: true, 
                  onClose: () => setIsMobileSidebarOpen(false) 
                })}
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="w-20">
          {sidebar}
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          {mainContent}
        </div>
        
        {/* Right Panel - Responsive behavior */}
        {rightPanel && (
          <>
            {/* Desktop Right Panel (always visible on XL screens) */}
            <div className="hidden xl:flex xl:flex-shrink-0">
              <div className="w-[400px] bg-white border-l border-gray-200">
                {rightPanel}
              </div>
            </div>
            
            {/* Tablet/Mobile Right Panel (toggleable overlay) */}
            {isRightPanelOpen && (
              <div className="xl:hidden fixed inset-y-0 right-0 z-40 w-[400px] max-w-[90vw] bg-white border-l border-gray-200 shadow-lg">
                {/* Close button for mobile/tablet */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Panel</h3>
                  <button
                    onClick={() => setIsRightPanelOpen(false)}
                    className="p-2 rounded-md hover:bg-gray-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
            {rightPanel}
          </div>
              </div>
            )}
            
            {/* Backdrop for right panel on tablet/mobile */}
            {isRightPanelOpen && (
              <div 
                className="xl:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                onClick={() => setIsRightPanelOpen(false)}
              />
            )}
          </>
        )}
      </div>
      
    </div>
  );
} 
