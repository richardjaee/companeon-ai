'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import GrantPermissionsModal from '@/components/GrantPermissionsModal/GrantPermissionsModal';
import { AgentAsset, SmartAccountPermission } from '@/lib/smartAccount/types';

interface YourPermissionsProps {
  walletLimits: any[];
  fetchWalletLimits: () => Promise<void>;
  isConnected: boolean;
  isLoading?: boolean;
}

// Helper to get token name from symbol
const getTokenName = (symbol: string): string => {
  const tokenNames: Record<string, string> = {
    'ETH': 'Ethereum',
    'USDC': 'USD Coin',
    'USDT': 'Tether',
    'DAI': 'Dai Stablecoin',
    'WETH': 'Wrapped Ether',
    'WBTC': 'Wrapped Bitcoin',
    'LINK': 'Chainlink',
    'UNI': 'Uniswap',
    'AAVE': 'Aave',
    'SOL': 'Solana',
    'SHIB': 'Shiba Inu',
  };
  return tokenNames[symbol.toUpperCase()] || symbol;
};

export default function YourPermissions({
  walletLimits,
  fetchWalletLimits,
  isConnected,
  isLoading = false,
}: YourPermissionsProps) {
  const [flashingLimits, setFlashingLimits] = useState<Record<string, 'decrease' | 'increase'>>({});
  const previousLimitsRef = useRef<Record<string, string>>({});
  // Detect limit changes and trigger flash effects (same pattern as TokenList)
  useEffect(() => {
    walletLimits.forEach(limit => {
      const limitKey = limit.asset;
      const currentRemaining = limit.remainingLimit;
      const previousRemaining = previousLimitsRef.current[limitKey];

      if (previousRemaining && previousRemaining !== currentRemaining) {
        const currentValue = parseFloat(currentRemaining);
        const previousValue = parseFloat(previousRemaining);

        if (!isNaN(currentValue) && !isNaN(previousValue) && currentValue !== previousValue) {
          const changeType = currentValue > previousValue ? 'increase' : 'decrease';

          setFlashingLimits(prev => ({
            ...prev,
            [limitKey]: changeType
          }));

          setTimeout(() => {
            setFlashingLimits(prev => {
              const newState = { ...prev };
              delete newState[limitKey];
              return newState;
            });
          }, 1000);
        }
      }

      previousLimitsRef.current[limitKey] = currentRemaining;
    });
  }, [walletLimits]);

  const [inlineEditAsset, setInlineEditAsset] = useState<string | null>(null);
  const [inlineEditValues, setInlineEditValues] = useState<{
    spendLimit: string;
    frequency: string;
    startDate: string;
    endDate: string;
  }>({ spendLimit: '', frequency: 'daily', startDate: '', endDate: '' });
  const [showGrantSheet, setShowGrantSheet] = useState(false);
  const [isGrantSheetClosing, setIsGrantSheetClosing] = useState(false);
  const [grantSheetAsset, setGrantSheetAsset] = useState<AgentAsset | null>(null);
  const [grantSheetPermission, setGrantSheetPermission] = useState<any>(null);

  // Start inline editing for a permission
  const handleStartInlineEdit = (permission: any) => {
    const frequencyMap: Record<string, string> = {
      'per hour': 'hourly',
      'per day': 'daily',
      'per week': 'weekly',
      'per month': 'monthly'
    };
    const freq = permission.frequency?.toLowerCase() || 'daily';
    const mappedFreq = frequencyMap[freq] || freq;

    const parseDate = (dateStr: string) => {
      if (!dateStr || dateStr === 'Not set') return '';
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return dateStr;
    };

    setInlineEditAsset(permission.asset);
    setInlineEditValues({
      spendLimit: permission.configuredLimit?.split(' ')[0] || '',
      frequency: mappedFreq,
      startDate: parseDate(permission.startDate),
      endDate: parseDate(permission.endDate)
    });
  };

  const handleCancelInlineEdit = () => {
    setInlineEditAsset(null);
    setInlineEditValues({ spendLimit: '', frequency: 'daily', startDate: '', endDate: '' });
  };

  const handleSaveInlineEdit = (permission: any) => {
    const asset: AgentAsset = {
      symbol: permission.asset,
      name: permission.asset,
      address: permission.tokenAddress || '0x0000000000000000000000000000000000000000',
      logo: `/logos/${permission.asset.toLowerCase()}-logo.png`,
      isSelected: true,
      amount: '0'
    };

    const updatedPermission = {
      asset: permission.asset,
      tokenAddress: permission.tokenAddress,
      spendLimit: inlineEditValues.spendLimit,
      frequency: inlineEditValues.frequency,
      startDate: inlineEditValues.startDate,
      endDate: inlineEditValues.endDate
    };

    setGrantSheetAsset(asset);
    setGrantSheetPermission(updatedPermission);
    setShowGrantSheet(true);
    setInlineEditAsset(null);
  };

  const handleCloseGrantSheet = () => {
    setIsGrantSheetClosing(true);
  };

  const handleGrantSheetComplete = async () => {
    await fetchWalletLimits();
    setIsGrantSheetClosing(true);
  };

  if (!isConnected) {
    return null;
  }

  return (
    <>
      <div className="pt-6 pb-6 lg:px-6 px-4">
        <h2 className="text-lg font-medium text-gray-900 mb-4 mt-0">Your permissions</h2>
        <div className="space-y-3">
          {walletLimits.length > 0 ? (
            walletLimits.map((tokenLimit: any) => {
              const isEditing = inlineEditAsset === tokenLimit.asset;

              return (
                <div key={tokenLimit.asset} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 overflow-hidden transition-all duration-300 ease-in-out">
                  {/* View Mode - Always rendered for consistent width */}
                  <div className={`transition-all duration-300 ease-in-out ${isEditing ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                      {/* Left: Logo + Asset Name (matching TokenList styling) */}
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full overflow-hidden">
                            <Image
                              src={`/logos/${tokenLimit.asset.toLowerCase()}-logo.png`}
                              alt={tokenLimit.asset}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/logos/eth-logo.png';
                              }}
                            />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col">
                            <span className="text-base font-semibold leading-tight truncate">{tokenLimit.asset}</span>
                            <span className="text-sm text-gray-600 leading-tight truncate mt-1">{getTokenName(tokenLimit.asset)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Limits in horizontal layout */}
                      <div className="flex flex-wrap items-center gap-4 lg:gap-6 flex-1">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-600">Spend limit</span>
                          <span className="text-sm font-medium text-gray-900">{tokenLimit.configuredLimit}</span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-xs text-gray-600">Remaining</span>
                          <span className={`text-sm font-medium transition-colors duration-1000 ${
                            flashingLimits[tokenLimit.asset] === 'decrease'
                              ? 'text-red-600'
                              : flashingLimits[tokenLimit.asset] === 'increase'
                              ? 'text-green-600'
                              : 'text-gray-900'
                          }`}>{tokenLimit.remainingLimit}</span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-xs text-gray-600">Frequency</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">{tokenLimit.frequency}</span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-xs text-gray-600">Duration</span>
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{tokenLimit.startDate} - {tokenLimit.endDate}</span>
                        </div>
                      </div>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleStartInlineEdit(tokenLimit);
                        }}
                        className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Edit Mode - Animated expand */}
                  <div className={`transition-all duration-300 ease-in-out ${isEditing ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div className="flex gap-6 items-start">
                      {/* Left: Token card - compact with purple ring (matching TokenList styling) */}
                      <div className="p-4 bg-gray-50 rounded-[16px] ring-2 ring-[#AD29FF] min-w-[200px] self-start">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden">
                              <Image
                                src={`/logos/${tokenLimit.asset.toLowerCase()}-logo.png`}
                                alt={tokenLimit.asset}
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/logos/eth-logo.png';
                                }}
                              />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col">
                              <span className="text-base font-semibold leading-tight truncate">{tokenLimit.asset}</span>
                              <span className="text-sm text-gray-600 leading-tight truncate mt-1">{getTokenName(tokenLimit.asset)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-700 font-medium">
                          Current: {tokenLimit.configuredLimit}
                        </div>
                      </div>

                      {/* Right: Stacked form inputs */}
                      <div className="flex-1 space-y-3">
                        {/* Spend Limit Input */}
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={inlineEditValues.spendLimit}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              setInlineEditValues(prev => ({ ...prev, spendLimit: val }));
                            }}
                            placeholder=" "
                            className="peer w-full h-[48px] px-3 pt-5 pb-2 text-sm border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                          />
                          <label className={`absolute left-3 text-gray-500 transition-all duration-200 pointer-events-none ${
                            inlineEditValues.spendLimit
                              ? 'top-1.5 text-[11px]'
                              : 'top-1/2 -translate-y-1/2 text-sm peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:translate-y-0'
                          }`}>
                            Spend limit
                          </label>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{tokenLimit.asset}</span>
                        </div>

                        {/* Frequency Dropdown */}
                        <div className="relative">
                          <select
                            value={inlineEditValues.frequency}
                            onChange={(e) => setInlineEditValues(prev => ({ ...prev, frequency: e.target.value }))}
                            className="peer w-full h-[48px] px-3 pt-5 pb-2 text-sm border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-black focus:border-black bg-white appearance-none cursor-pointer"
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                          <label className="absolute left-3 top-1.5 text-[11px] text-gray-500 pointer-events-none">
                            Frequency
                          </label>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Start Date */}
                        <div className="relative">
                          <input
                            type="date"
                            value={inlineEditValues.startDate}
                            onChange={(e) => setInlineEditValues(prev => ({ ...prev, startDate: e.target.value }))}
                            className="peer w-full h-[48px] px-3 pt-5 pb-2 text-sm border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                          />
                          <label className="absolute left-3 top-1.5 text-[11px] text-gray-500 pointer-events-none">
                            Start date
                          </label>
                        </div>

                        {/* End Date */}
                        <div className="relative">
                          <input
                            type="date"
                            value={inlineEditValues.endDate}
                            onChange={(e) => setInlineEditValues(prev => ({ ...prev, endDate: e.target.value }))}
                            className="peer w-full h-[48px] px-3 pt-5 pb-2 text-sm border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                          />
                          <label className="absolute left-3 top-1.5 text-[11px] text-gray-500 pointer-events-none">
                            End date
                          </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCancelInlineEdit();
                            }}
                            className="px-6 h-[48px] text-sm font-medium text-red-600 border-2 border-red-600 rounded-[4px] hover:bg-red-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveInlineEdit(tokenLimit);
                            }}
                            className="flex-1 h-[48px] bg-[#AD29FF] text-white text-sm font-medium rounded-[4px] hover:opacity-90 transition-colors"
                          >
                            Save changes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 overflow-hidden animate-pulse">
              <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                <div className="flex items-center gap-3 min-w-[120px]">
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                  <div className="flex flex-col gap-1">
                    <div className="h-4 w-12 bg-gray-200 rounded" />
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 lg:gap-6 flex-1">
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-14 bg-gray-200 rounded" />
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-14 bg-gray-200 rounded" />
                    <div className="h-4 w-12 bg-gray-200 rounded" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-14 bg-gray-200 rounded" />
                    <div className="h-4 w-10 bg-gray-200 rounded" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-12 bg-gray-200 rounded" />
                    <div className="h-4 w-24 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                <div className="flex flex-wrap items-center gap-4 lg:gap-6 flex-1">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Spend limit</span>
                    <span className="text-sm font-medium text-gray-500">Not set</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Remaining</span>
                    <span className="text-sm font-medium text-gray-500">Not set</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Frequency</span>
                    <span className="text-sm font-medium text-gray-500">Not set</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Duration</span>
                    <span className="text-sm font-medium text-gray-500">Not set</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grant Permissions Bottom Sheet - for editing permissions */}
      {showGrantSheet && grantSheetAsset && grantSheetPermission && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-end"
          onClick={handleCloseGrantSheet}
        >
          <div
            className={`bg-white rounded-t-2xl shadow-xl w-full flex flex-col overflow-hidden ${
              isGrantSheetClosing ? 'animate-slide-down' : 'animate-slide-up'
            }`}
            style={{ height: '70vh' }}
            onClick={(e) => e.stopPropagation()}
            onAnimationEnd={(e) => {
              if (e.animationName === 'slideDown') {
                setShowGrantSheet(false);
                setIsGrantSheetClosing(false);
                setGrantSheetAsset(null);
                setGrantSheetPermission(null);
              }
            }}
          >
            <GrantPermissionsModal
              isOpen={true}
              inline={true}
              onClose={handleCloseGrantSheet}
              selectedAssets={[grantSheetAsset]}
              permissions={[{
                type: 'spending-limit' as const,
                asset: grantSheetPermission.tokenAddress || '0x0000000000000000000000000000000000000000',
                dailyLimit: grantSheetPermission.spendLimit,
                frequency: grantSheetPermission.frequency,
                startTime: grantSheetPermission.startDate ? Math.floor(new Date(grantSheetPermission.startDate).getTime() / 1000) : undefined,
                endTime: grantSheetPermission.endDate ? Math.floor(new Date(grantSheetPermission.endDate).getTime() / 1000) : undefined,
              } as SmartAccountPermission]}
              expiryDays={grantSheetPermission.endDate
                ? Math.ceil((new Date(grantSheetPermission.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 30}
              enableRateLimit={false}
              rateLimit={{ count: 0, interval: 0 }}
              enableCallLimit={false}
              callLimit={0}
              enableGasLimit={false}
              gasLimit=""
              onComplete={handleGrantSheetComplete}
            />
          </div>
        </div>
      )}
    </>
  );
}
