'use client';

import { AgentAsset, SmartAccountPermission } from '@/lib/smartAccount/types';
import { WalletLimit } from '@/lib/api/wallet';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface AgentPermissionsSummaryProps {
  walletAddress: string | null;
  chainName: string;
  selectedAssets: AgentAsset[];
  permissions: SmartAccountPermission[];
  walletLimits?: WalletLimit[]; // Actual remaining limits from backend
  expiryDays: number;
  enableRateLimit: boolean;
  rateLimit: { count: number; interval: number };
  enableCallLimit: boolean;
  callLimit: number;
  enableGasLimit: boolean;
  gasLimit: string;
  onGrantPermissions: () => void;
  onBack: () => void;
  isGranting: boolean;
  grantError: string | null;
  grantSuccess: boolean;
  showGrantButton: boolean;
}

export default function AgentPermissionsSummary({
  walletAddress,
  chainName,
  selectedAssets,
  permissions,
  walletLimits = [],
  expiryDays,
  enableRateLimit,
  rateLimit,
  enableCallLimit,
  callLimit,
  enableGasLimit,
  gasLimit,
  onGrantPermissions,
  onBack,
  isGranting,
  grantError,
  grantSuccess,
  showGrantButton
}: AgentPermissionsSummaryProps) {

  const [flashSpendLimit, setFlashSpendLimit] = useState(false);
  const previousSpendLimitRef = useRef<string | null>(null);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatExpiryDate = () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    return expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Detect spend limit changes and trigger flash effect
  useEffect(() => {
    if (selectedAssets.length > 0) {
      const firstAsset = selectedAssets[0];
      const permission = permissions.find(p => p.asset?.toLowerCase() === firstAsset.address.toLowerCase());
      const currentLimit = permission?.dailyLimit || '0';

      if (previousSpendLimitRef.current && previousSpendLimitRef.current !== currentLimit) {
        const current = parseFloat(currentLimit);
        const previous = parseFloat(previousSpendLimitRef.current);

        // Only flash on decrease (when spending)
        if (!isNaN(current) && !isNaN(previous) && current < previous) {
          setFlashSpendLimit(true);
          setTimeout(() => setFlashSpendLimit(false), 1000);
        }
      }

      previousSpendLimitRef.current = currentLimit;
    }
  }, [permissions, selectedAssets]);

  return (
    <div className="h-full flex flex-col">
      {/* Header - aligned with depositing summary */}
      <div className="xl:px-6 px-0 pt-6 pb-6">
        <h3 className="text-2xl font-bold mb-4">Agent permissions</h3>

        <div className="space-y-3">
          {/* Show limits for each asset */}
          {selectedAssets.map((asset) => {
            const permission = permissions.find(p => p.asset?.toLowerCase() === asset.address.toLowerCase());
            const walletLimit = walletLimits.find(l => l.asset === asset.symbol);

            return (
              <div key={asset.address} className="space-y-3 pb-4 border-b border-gray-100 last:border-0">
                {/* Asset Header */}
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src={asset.logo || '/logos/eth-logo.png'}
                    alt={asset.symbol}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <span className="font-semibold text-base text-black">{asset.symbol}</span>
                </div>

                {/* Configured Limit */}
                <div className="flex justify-between text-base">
                  <span className="text-black">Spend limit</span>
                  <span className="font-medium text-black">
                    {walletLimit?.configuredLimit ||
                     (permission?.dailyLimit && parseFloat(permission.dailyLimit) > 0
                      ? `${permission.dailyLimit} ${asset.symbol}`
                      : 'No limit')}
                  </span>
                </div>

                {/* Remaining Limit */}
                <div className="flex justify-between text-base">
                  <span className="text-black">Remaining limit</span>
                  <span
                    className={`font-medium transition-colors duration-1000 ${
                      flashSpendLimit
                        ? 'text-red-600'
                        : 'text-black'
                    }`}
                  >
                    {walletLimit?.available ? `${walletLimit.available} ${asset.symbol}` :
                     (permission?.dailyLimit && parseFloat(permission.dailyLimit) > 0
                      ? `${permission.dailyLimit} ${asset.symbol}`
                      : 'No limit')}
                  </span>
                </div>

                {/* Frequency */}
                <div className="flex justify-between text-base">
                  <span className="text-black">Frequency</span>
                  <span className="font-medium text-black capitalize">
                    {walletLimit?.periodDuration || permission?.frequency || 'Daily'}
                  </span>
                </div>

                {/* Start Date */}
                <div className="flex justify-between text-base">
                  <span className="text-black">Start date</span>
                  <span className="font-medium text-black">
                    {permission?.startTime ? formatTimestamp(permission.startTime) : 'Not set'}
                  </span>
                </div>

                {/* End Date */}
                <div className="flex justify-between text-base">
                  <span className="text-black">End date</span>
                  <span className="font-medium text-black">
                    {permission?.endTime ? formatTimestamp(permission.endTime) : 'Not set'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Rate Limit */}
          {enableRateLimit && (
            <div className="flex justify-between text-base">
              <span className="text-black">Rate limit:</span>
              <span className="font-medium text-black">
                {rateLimit.count} tx/{rateLimit.interval / 3600}h
              </span>
            </div>
          )}

          {/* Call Limit */}
          {enableCallLimit && (
            <div className="flex justify-between text-base">
              <span className="text-black">Total transactions:</span>
              <span className="font-medium text-black">{callLimit.toLocaleString()}</span>
            </div>
          )}

          {/* Gas Budget */}
          {enableGasLimit && (
            <div className="flex justify-between text-base">
              <span className="text-black">Gas budget:</span>
              <span className="font-medium text-black">{parseInt(gasLimit).toLocaleString()}</span>
            </div>
          )}

          {/* Assets Section */}
          <div className="mb-6">
            <div className="flex justify-between mb-3 text-base">
              <span className="text-black">Assets with limits ({selectedAssets.length})</span>
            </div>
            <div className="space-y-2 mb-6">
              {selectedAssets.length === 0 && (
                <div className="text-gray-500 text-base italic py-2 px-2">
                  No assets selected yet.
                </div>
              )}
              {selectedAssets.map((asset) => {
                const permission = permissions.find(p => p.asset?.toLowerCase() === asset.address.toLowerCase());
                const hasLimit = permission?.dailyLimit && parseFloat(permission.dailyLimit) > 0;
                const frequency = permission?.frequency || 'daily';

                return (
                  <div key={asset.address} className="py-3 border-b border-gray-100 last:border-0 px-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden">
                        <Image
                          src={asset.logo || '/logos/eth-logo.png'}
                          alt={asset.symbol}
                          width={32}
                          height={32}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col justify-center">
                        <p className="text-base font-medium text-black">{asset.symbol}</p>
                        <p className="text-base text-gray-500">{asset.name}</p>
                      </div>
                    </div>
                    <div className="ml-11 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Limit:</span>
                        <span className="font-medium text-black">
                          {hasLimit ? `${permission.dailyLimit} ${asset.symbol}` : 'No limit'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Frequency:</span>
                        <span className="font-medium text-black capitalize">{frequency}</span>
                      </div>
                      {permission?.startTime && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Start:</span>
                          <span className="font-medium text-black">{formatTimestamp(permission.startTime)}</span>
                        </div>
                      )}
                      {permission?.endTime && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">End:</span>
                          <span className="font-medium text-black">{formatTimestamp(permission.endTime)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error/Success Messages */}
          {grantError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-base font-medium text-red-900 mb-1">Error</div>
                  <div className="text-base text-red-700">{grantError}</div>
                </div>
              </div>
            </div>
          )}

          {grantSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <div className="text-base font-medium text-green-900 mb-1">Success!</div>
                  <div className="text-base text-green-700">Permissions granted successfully</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with action buttons - matching DashboardDepositingSummary */}
      <div className="xl:px-6 px-0 pb-6 space-y-3">
        {showGrantButton && (
          <button
            onClick={onGrantPermissions}
            disabled={isGranting || grantSuccess}
            className={`w-full h-[48px] px-6 rounded-[4px] text-sm font-medium transition-all ${
              isGranting || grantSuccess
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#AD29FF] text-white hover:opacity-90'
            }`}
          >
            {isGranting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Granting permissions...
              </span>
            ) : grantSuccess ? (
              'Permissions granted!'
            ) : (
              'Grant permissions'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
