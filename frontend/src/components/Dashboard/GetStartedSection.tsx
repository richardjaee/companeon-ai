'use client';

import Link from 'next/link';
import { useState } from 'react';
import WalletConnectModal from '@/components/WalletConnectModal/WalletConnectModal';
import AgentSettingsModal, { AgentControls } from '@/components/Chat/AgentSettingsModal';

interface GetStartedSectionProps {
  onStartCoinSelection?: () => void;
  isSelectionMode?: boolean;
  isWalletConnected?: boolean;
}

export default function GetStartedSection({ onStartCoinSelection, isSelectionMode = false, isWalletConnected = true }: GetStartedSectionProps) {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [showAIBanner, setShowAIBanner] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [agentControls, setAgentControls] = useState<AgentControls>({
    autoTxMode: 'ask',
    x402Mode: 'ask'
  });

  return (
    <>
      {(showWelcomeBanner || showAIBanner) && (
        <div className="mb-6">
          <div className="p-4 -ml-4">
            <div className="flex gap-4">
              {/* Welcome Card */}
              {showWelcomeBanner && (
            <div className="bg-purple-50 rounded-lg shadow-sm overflow-hidden inline-block relative">
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
                    ? "Connect your wallet to view your cryptocurrency portfolio, NFT collection, and manage your permissions."
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

          {/* assistant Assistant Setup Card */}
          {showAIBanner && (
            <div className="bg-green-50 rounded-lg shadow-sm inline-block relative">
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
                  Set up AI assistant settings
                </h4>
              </div>

              <div className="mb-3">
                <p className="text-sm text-gray-600">
                  Customize transaction settings and paid API capabilities.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="text-sm font-medium text-black hover:text-gray-700 transition-colors underline"
                >
                  Set up
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

      <AgentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        controls={agentControls}
        onSave={(newControls) => {
          setAgentControls(newControls);
          console.log('[GetStartedSection] ⚙️ Agent settings updated:', newControls);
        }}
      />
    </>
  );
}
