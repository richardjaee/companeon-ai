'use client';

import Link from 'next/link';
import { useState } from 'react';
import WalletConnectModal from '@/components/WalletConnectModal/WalletConnectModal';
import PurchaseCreditsModal from './PurchaseCreditsModal';

interface GetStartedSectionProps {
  onStartCoinSelection?: () => void;
  isSelectionMode?: boolean;
  isWalletConnected?: boolean;
  onNavigateToAccount?: () => void;
}

export default function GetStartedSection({ onStartCoinSelection, isSelectionMode = false, isWalletConnected = true, onNavigateToAccount }: GetStartedSectionProps) {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [showAIBanner, setShowAIBanner] = useState(true);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  return (
    <>
      {(showWelcomeBanner || showAIBanner) && (
        <div className="pt-6 mb-6">
          <div className="">
            <div className="grid grid-cols-2 gap-4">
              {/* Welcome Card */}
              {showWelcomeBanner && (
            <div className="bg-purple-50 rounded-lg shadow-sm overflow-hidden relative">
              {/* Close button */}
              <button
                onClick={() => setShowWelcomeBanner(false)}
                className="absolute top-4 right-4 text-black hover:text-gray-700 transition-colors"
              >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Content with increased padding on all sides */}
            <div className="p-4 pr-14">
              <div className="mb-1">
                <h4 className="text-base font-medium">
                  {!isWalletConnected ? "Connect Your Wallet" : "Welcome to your dashboard"}
                </h4>
              </div>

              <div className="mb-3">
                <p className="text-sm text-gray-600">
                  {!isWalletConnected
                    ? "Connect your wallet to see your crypto and manage your agent permissions."
                    : "Learn how to set agent permissions."
                  }
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {!isWalletConnected ? (
                  <>
                    <Link
                      href="/learn"
                      className="px-4 py-2 text-sm border bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-[4px] transition-colors"
                    >
                      Learn more
                    </Link>
                    <button
                      onClick={() => setShowWalletModal(true)}
                      className="text-sm font-medium text-black hover:text-gray-700 transition-colors underline"
                    >
                      Connect Wallet
                    </button>
                  </>
                ) : (
                  <Link
                    href="/learn"
                    className="text-sm font-medium text-black hover:text-gray-700 transition-colors underline"
                  >
                    Learn more
                  </Link>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Credits Card */}
          {showAIBanner && (
            <div className="bg-green-50 rounded-lg shadow-sm relative">
              {/* Close button */}
              <button
                onClick={() => setShowAIBanner(false)}
                className="absolute top-4 right-4 text-black hover:text-gray-700 transition-colors z-10"
              >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-4 pr-14">
              <div className="mb-1">
                <h4 className="text-base font-medium">
                  Get AI prompts
                </h4>
              </div>

              <div className="mb-3">
                <p className="text-sm text-gray-600">
                  You start with 20 free credits. Purchase more anytime with ETH or USDC.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowPurchaseModal(true)}
                  className="px-4 py-2 text-sm border bg-white border-gray-300 text-gray-700 hover:bg-gray-50 rounded-[4px] transition-colors"
                >
                  Buy Credits
                </button>
                <button
                  onClick={() => onNavigateToAccount?.()}
                  className="text-sm font-medium text-black hover:text-gray-700 transition-colors underline"
                >
                  View usage
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
      )}

      <WalletConnectModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />

      <PurchaseCreditsModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
      />
    </>
  );
}
