'use client';

import { useState, useEffect } from 'react';
import { AgentAsset, SmartAccountPermission } from '@/lib/smartAccount/types';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChain } from '@/hooks/useChain';
import GrantPermissionsModal from '@/components/GrantPermissionsModal/GrantPermissionsModal';
import AgentPermissionsSummary from '../AgentPermissionsSummary';
import Image from 'next/image';
import AssetLimitsStep from '../AgentView/steps/AssetLimitsStep';

interface AgentPermissionsViewProps {
  selectedAssets: AgentAsset[];
  onComplete?: () => void | Promise<void>;
  onCancel?: () => void;
}

type ViewState = 'configure' | 'granting';

export default function AgentPermissionsView({
  selectedAssets,
  onComplete,
  onCancel
}: AgentPermissionsViewProps) {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  const [assets, setAssets] = useState<AgentAsset[]>(selectedAssets);
  const [permissions, setPermissions] = useState<SmartAccountPermission[]>([]);

  // Step state matching DepositingView pattern
  const [permissionSteps, setPermissionSteps] = useState({
    assetLimits: { isExpanded: true, isConfirmed: false }
  });

  // View state - configure (set limits) or granting (processing permissions)
  const [viewState, setViewState] = useState<ViewState>('configure');

  // Initialize permissions for each asset
  useEffect(() => {
    const initialPermissions = selectedAssets.map(asset => ({
      type: 'spending-limit' as const,
      asset: asset.address,
      dailyLimit: '',
      expiryDays: 30
    }));
    setPermissions(initialPermissions);
  }, [selectedAssets]);

  const handleExpandStep = (step: 'assetLimits') => {
    setPermissionSteps(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        updated[key as keyof typeof updated] = {
          ...updated[key as keyof typeof updated],
          isExpanded: key === step
        };
      });
      return updated;
    });
  };

  const handleConfirmStep = (step: 'assetLimits') => {
    setPermissionSteps(prev => {
      const updated = { ...prev };
      updated[step] = { ...updated[step], isConfirmed: true, isExpanded: false };
      return updated;
    });
  };

  const handleGrantPermissions = () => {
    const hasValidLimit = permissions.some(p => p.dailyLimit && parseFloat(p.dailyLimit) > 0);
    if (!hasValidLimit) return;

    // Switch to granting view (inline in the bottom sheet)
    setViewState('granting');
  };

  const handleGrantComplete = async () => {
    
    if (onComplete) {
      await onComplete();
      
    }
  };

  const handleGrantCancel = () => {
    // Go back to configure view
    setViewState('configure');
  };

  const handleBack = () => {
    if (onCancel) onCancel();
  };

  const canGrantPermissions = () => {
    return permissions.some(p =>
      p.dailyLimit &&
      parseFloat(p.dailyLimit) > 0 &&
      p.frequency &&
      p.startTime &&
      p.endTime
    );
  };

  const shortenAddress = (addr: string | null) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const WalletButton = () => {
    if (!isConnected || !address) {
      return null;
    }

    return (
      <div className="relative group">
        <button className="flex items-center gap-2 pl-4 pr-0 py-2 rounded-[20px] relative">
          <Image src="/icons/wallet-address-icon.png" alt="Wallet Address" className="w-6 h-6" width={24} height={24} />
          <span className="text-black">{shortenAddress(address)}</span>
          <svg
            className="w-4 h-4 transition-transform duration-200 stroke-black group-hover:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-600">Please connect your wallet</p>
      </div>
    );
  }

  // If in granting state, show the grant permissions content inline
  if (viewState === 'granting') {
    return (
      <div className="relative h-full flex flex-col">
        {/* Close button - top right */}
        <button
          onClick={handleGrantCancel}
          className="absolute top-6 right-6 z-10 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Grant Permissions Content - rendered inline */}
        <GrantPermissionsModal
          isOpen={true}
          onClose={handleGrantCancel}
          selectedAssets={assets}
          permissions={permissions}
          expiryDays={30}
          enableRateLimit={false}
          rateLimit={{ count: 10, interval: 3600 }}
          enableCallLimit={false}
          callLimit={1000}
          enableGasLimit={false}
          gasLimit={'5000000'}
          onComplete={handleGrantComplete}
          walletAddress={address || undefined}
          walletEthereum={typeof window !== 'undefined' ? (window as any).ethereum : undefined}
          inline={true}
        />
      </div>
    );
  }

  // Configure view - set limits
  return (
    <div className="relative h-full flex flex-col">
      {/* Close button - top right */}
      <button
        onClick={handleBack}
        className="absolute top-6 right-6 z-10 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex justify-center">
        <div className="px-6 py-6 space-y-6 flex flex-col items-start">
          {/* Asset Limits Step */}
          <div>
            <AssetLimitsStep
              step={permissionSteps.assetLimits}
              assets={assets}
              permissions={permissions}
              onPermissionsChange={setPermissions}
              onStepExpand={() => handleExpandStep('assetLimits')}
              onConfirmStep={() => handleConfirmStep('assetLimits')}
              onGrantPermissions={handleGrantPermissions}
              hideGrantButton={true}
            />
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-center">
        <div className="w-[656px] flex gap-3">
          <button
            onClick={handleBack}
            className="px-6 h-[48px] rounded-[4px] text-sm font-medium bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleGrantPermissions}
            disabled={!canGrantPermissions()}
            className={`flex-1 h-[48px] px-6 rounded-[4px] text-sm font-medium transition-all ${
              canGrantPermissions()
                ? 'bg-[#AD29FF] text-white hover:opacity-90'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Grant permissions
          </button>
        </div>
      </div>
    </div>
  );
}
