'use client';
// Force cache bust v2
import { useState, useEffect } from 'react';
import { AgentAsset, SmartAccountPermission } from '@/lib/smartAccount/types';
import Image from 'next/image';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChain } from '@/hooks/useChain';
import { nftApi } from '@/lib/api/nft';
import { getTokenLogoByAddress } from '@/lib/constants/tokens';

interface StepState {
  isExpanded: boolean;
  isConfirmed: boolean;
}

interface AssetLimitsStepProps {
  step: StepState;
  assets: AgentAsset[];
  permissions: SmartAccountPermission[];
  onPermissionsChange: (permissions: SmartAccountPermission[]) => void;
  onStepExpand: () => void;
  onConfirmStep: () => void;
  onGrantPermissions?: () => void;
  hideGrantButton?: boolean;
}

export default function AssetLimitsStep({
  step,
  assets,
  permissions,
  onPermissionsChange,
  onStepExpand,
  onConfirmStep,
  onGrantPermissions,
  hideGrantButton = false
}: AssetLimitsStepProps) {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  // Track selected asset for editing
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);

  // Token prices state
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  // Track which assets are in USD input mode
  const [usdInputMode, setUsdInputMode] = useState<Record<string, boolean>>({});

  // Fetch token prices
  useEffect(() => {
    const fetchPrices = async () => {
      if (!isConnected || !address) return;
      
      try {
        const response = await nftApi.getTokens(address, config.chainId);
        const priceMap: Record<string, number> = {};

        if (response?.eth?.priceInUSD) {
          priceMap['0x0000000000000000000000000000000000000000'] = response.eth.priceInUSD;
          priceMap['native'] = response.eth.priceInUSD;
        }

        response?.tokens?.forEach((token: any) => {
          if (token.contract && token.priceInUSD) {
            priceMap[token.contract.toLowerCase()] = token.priceInUSD;
          }
        });

        setTokenPrices(priceMap);
      } catch (error) {
        // Silent fail
      }
    };

    fetchPrices();
  }, [address, isConnected, config.chainId]);

  const getAssetPrice = (assetAddress: string): number => {
    const normalizedAddress = assetAddress.toLowerCase();
    return tokenPrices[normalizedAddress] || tokenPrices['native'] || 0;
  };

  const formatUsdAmount = (value: string | number): string => {
    if (!value) return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toFixed(2);
  };

  const formatTokenAmount = (value: string | number, decimals: number = 6): string => {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    if (num === 0) return '0';
    
    const abs = Math.abs(num);
    if (abs >= 1000) return num.toFixed(0);
    if (abs >= 1) return num.toFixed(Math.min(2, decimals));
    
    let decimalPlaces = 4;
    let multiplier = 1;
    while (abs * multiplier < 1 && decimalPlaces < decimals) {
      multiplier *= 10;
      decimalPlaces += 1;
    }
    return num.toFixed(Math.min(decimalPlaces, decimals));
  };

  const toggleInputMode = (assetAddress: string) => {
    setUsdInputMode(prev => ({
      ...prev,
      [assetAddress]: !prev[assetAddress]
    }));
  };

  const handleLimitChange = (assetAddress: string, value: string, isUsdMode: boolean) => {
    // Only allow numbers and one decimal point
    const sanitizedValue = value.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = sanitizedValue.split('.');
    const validValue = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : sanitizedValue;

    const price = getAssetPrice(assetAddress);
    let tokenAmount = validValue;

    if (isUsdMode && price > 0) {
      // Convert USD to token amount
      const usdValue = parseFloat(validValue) || 0;
      tokenAmount = (usdValue / price).toString();
    }

    const updatedPermissions = permissions.map(p =>
      p.asset === assetAddress ? { ...p, dailyLimit: tokenAmount } : p
    );
    onPermissionsChange(updatedPermissions);
  };

  const getDisplayValue = (assetAddress: string, tokenValue: string): string => {
    const isUsdMode = usdInputMode[assetAddress];
    const price = getAssetPrice(assetAddress);
    
    if (!tokenValue) return '';
    
    if (isUsdMode && price > 0) {
      const tokenNum = parseFloat(tokenValue) || 0;
      return formatUsdAmount(tokenNum * price);
    }
    
    return tokenValue;
  };

  const getConversionDisplay = (assetAddress: string, tokenValue: string, symbol: string): string => {
    const isUsdMode = usdInputMode[assetAddress];
    const price = getAssetPrice(assetAddress);
    
    if (!tokenValue || !price) return isUsdMode ? `0 ${symbol}` : '$0.00 USD';
    
    const tokenNum = parseFloat(tokenValue) || 0;
    
    if (isUsdMode) {
      return `${formatTokenAmount(tokenNum)} ${symbol.length > 7 ? symbol.substring(0, 7) : symbol}`;
    } else {
      return `$${formatUsdAmount(tokenNum * price)} USD`;
    }
  };

  const handleFrequencyChange = (assetAddress: string, frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    const updatedPermissions = permissions.map(p =>
      p.asset === assetAddress ? { ...p, frequency } : p
    );
    onPermissionsChange(updatedPermissions);
  };

  const formatDateInput = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Auto-format as MM/DD/YYYY
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.substring(0, 2); // MM
      if (digits.length > 2) {
        formatted += '/' + digits.substring(2, 4); // DD
        if (digits.length > 4) {
          formatted += '/' + digits.substring(4, 8); // YYYY
        }
      }
    }

    return formatted;
  };

  const getDatePlaceholderOverlay = (value: string): string => {
    // Show remaining format based on what's typed
    const format = 'mm/dd/yyyy';
    if (!value) return format;

    // Return the remaining part of the format
    return format.substring(value.length);
  };

  const isValidDate = (month: string, day: string, year: string): boolean => {
    const m = parseInt(month);
    const d = parseInt(day);
    const y = parseInt(year);

    // Check valid ranges
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 1900 || y > 2100) return false;

    // Check if date exists (handles Feb 30, etc.)
    const date = new Date(y, m - 1, d);
    return date.getMonth() === m - 1 && date.getDate() === d;
  };

  const handleStartDateInput = (assetAddress: string, rawValue: string) => {
    // Format the input
    const dateString = formatDateInput(rawValue);

    // Always store whatever the user typed, even if incomplete
    const updatedPermissions = permissions.map(p => {
      if (p.asset === assetAddress) {
        const updates: any = { ...p, _startDateString: dateString };

        // Only set timestamp if we have a valid complete date (MM/DD/YYYY)
        if (dateString.length === 10) {
          const parts = dateString.split('/');
          const month = parts[0];
          const day = parts[1];
          const year = parts[2];

          // Validate the date
          if (isValidDate(month, day, year)) {
            const date = new Date(`${year}-${month}-${day}T00:00:00`);
            const timestamp = Math.floor(date.getTime() / 1000);
            updates.startTime = timestamp;

            // Check if start date is after end date
            if (p.endTime && timestamp > p.endTime) {
              console.warn('[Start Date] Start date cannot be after end date');
              updates._dateError = 'Start date cannot be after end date';
            } else {
              updates._dateError = undefined;
            }
          } else {
            console.warn('[Start Date] Invalid date:', dateString);
            updates.startTime = undefined;
            updates._dateError = 'Invalid date';
          }
        } else {
          updates.startTime = undefined;
        }

        return updates;
      }
      return p;
    });
    onPermissionsChange(updatedPermissions);
  };

  const handleEndDateInput = (assetAddress: string, rawValue: string) => {
    // Format the input
    const dateString = formatDateInput(rawValue);

    // Always store whatever the user typed, even if incomplete
    const updatedPermissions = permissions.map(p => {
      if (p.asset === assetAddress) {
        const updates: any = { ...p, _endDateString: dateString };

        // Only set timestamp if we have a valid complete date (MM/DD/YYYY)
        if (dateString.length === 10) {
          const parts = dateString.split('/');
          const month = parts[0];
          const day = parts[1];
          const year = parts[2];

          // Validate the date
          if (isValidDate(month, day, year)) {
            const date = new Date(`${year}-${month}-${day}T00:00:00`);
            const timestamp = Math.floor(date.getTime() / 1000);
            updates.endTime = timestamp;

            // Check if end date is before start date
            if (p.startTime && timestamp < p.startTime) {
              console.warn('[End Date] End date cannot be before start date');
              updates._dateError = 'End date cannot be before start date';
            } else {
              updates._dateError = undefined;
            }
          } else {
            console.warn('[End Date] Invalid date:', dateString);
            updates.endTime = undefined;
            updates._dateError = 'Invalid date';
          }
        } else {
          updates.endTime = undefined;
        }

        return updates;
      }
      return p;
    });
    onPermissionsChange(updatedPermissions);
  };

  const getDateInputValue = (permission: SmartAccountPermission | undefined, type: 'start' | 'end'): string => {
    if (!permission) return '';

    // Check if we have a stored date string (from user input)
    const dateString = type === 'start' ? (permission as any)._startDateString : (permission as any)._endDateString;
    if (dateString) return dateString;

    // Otherwise, format from timestamp as MM/DD/YYYY
    const timestamp = type === 'start' ? permission.startTime : permission.endTime;
    if (!timestamp) return '';

    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const getValidAssetCount = () => {
    return permissions.filter(p => p.dailyLimit && parseFloat(p.dailyLimit) > 0).length;
  };

  const canConfirm = () => {
    return permissions.some(p =>
      p.dailyLimit &&
      parseFloat(p.dailyLimit) > 0 &&
      p.frequency &&
      p.startTime &&
      p.endTime
    );
  };

  return (
    <div>
      <div
        className="px-0 py-4 cursor-pointer transition-colors"
        onClick={(e) => {
          e.preventDefault();
          if (step.isConfirmed || !step.isExpanded) {
            onStepExpand();
          }
        }}
      >
        <div className="flex justify-between items-center max-w-[656px]">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold">Set agent permissions</h2>
            <div className="flex flex-col">
            {step.isConfirmed && (
              <span className="text-base pb-[18px]" style={{ color: '#05823f' }}>
                ✓ {getValidAssetCount()} asset limit{getValidAssetCount() !== 1 ? 's' : ''} configured
              </span>
            )}
          </div>

            {step.isConfirmed && !step.isExpanded && (
              <div className="pb-0"></div>
            )}
          </div>
          <div className="text-gray-500">
            {step.isConfirmed && !step.isExpanded ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStepExpand();
                }}
                className="text-sm font-medium text-purple-600 hover:text-purple-800"
              >
                Change
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {step.isExpanded && (
        <div className="pt-2 pb-8">
          <div className="flex gap-12">
            {/* Left Column - Assets List */}
            <div className="flex flex-col gap-3 min-w-[200px]">
              {assets.map((asset, index) => {
                const permission = permissions.find(p => p.asset === asset.address);
                const hasValidData = permission?.dailyLimit && parseFloat(permission.dailyLimit) > 0
                  && permission?.frequency && permission?.startTime && permission?.endTime;
                const isSelected = index === selectedAssetIndex;

                return (
                  <div
                    key={asset.address}
                    onClick={() => setSelectedAssetIndex(index)}
                    className={`p-4 bg-gray-50 rounded-[4px] cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-[#AD29FF]' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden">
                        <Image
                          src={asset.logo || '/logos/eth-logo.png'}
                          alt={asset.symbol}
                          width={32}
                          height={32}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{asset.symbol}</p>
                        <p className="text-xs text-gray-500">{asset.name}</p>
                      </div>
                      {asset.amount && (
                        <div className="text-xs text-gray-700 font-medium ml-8 mr-2">
                          {parseFloat(asset.amount).toFixed(4)} {asset.symbol}
                          {(() => {
                            const amount = parseFloat(asset.amount);
                            const price = getAssetPrice(asset.address);
                            const usdValue = amount * price;
                            return usdValue > 0 ? ` ($${usdValue.toFixed(2)})` : '';
                          })()}
                        </div>
                      )}
                      {hasValidData && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column - Form Fields for Selected Asset */}
            <div className="flex-1">
              {(() => {
                const asset = assets[selectedAssetIndex];
                const permission = permissions.find(p => p.asset === asset.address);

                return (
                  <div className="w-full space-y-4">
                          {/* Limit field with floating label and live conversion */}
                          <div className="w-full relative">
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={getDisplayValue(asset.address, permission?.dailyLimit || '')}
                                onChange={(e) => handleLimitChange(asset.address, e.target.value, usdInputMode[asset.address] || false)}
                                placeholder=" "
                                maxLength={15}
                                className="peer w-full h-[48px] px-3 pr-36 pt-5 pb-2 text-sm leading-[14px] border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                              />
                              <label className={`absolute left-3 text-gray-500 transition-all duration-200 pointer-events-none ${
                                permission?.dailyLimit && permission.dailyLimit !== ''
                                  ? 'top-1.5 text-[11px] translate-y-0'
                                  : 'top-1/2 -translate-y-1/2 text-sm peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:translate-y-0'
                              }`}>
                                Spend limit
                              </label>
                              
                              {/* Conversion display and toggle on the right */}
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <span className="text-xs sm:text-sm text-black bg-white px-1 rounded max-w-[110px] truncate">
                                  {getConversionDisplay(asset.address, permission?.dailyLimit || '', asset.symbol)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleInputMode(asset.address);
                                  }}
                                  className="flex-shrink-0 p-1 hover:bg-gray-200 rounded-full transition-colors flex items-center justify-center"
                                  aria-label="Toggle between USD and token input"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 text-black"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Frequency dropdown with floating label */}
                          <div className="w-full">
                            <div className="relative">
                              <select
                                value={permission?.frequency || ''}
                                onChange={(e) => handleFrequencyChange(asset.address, e.target.value as any)}
                                className="peer w-full h-[48px] px-3 pt-5 pb-2 text-sm leading-[14px] border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-black focus:border-black bg-white appearance-none"
                              >
                                <option value=""></option>
                                <option value="hourly">Hourly</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                              </select>
                              <label className={`absolute left-3 text-gray-500 transition-all duration-200 pointer-events-none ${
                                permission?.frequency
                                  ? 'top-1.5 text-[11px] translate-y-0'
                                  : 'top-1/2 -translate-y-1/2 text-sm'
                              }`}>
                                Frequency
                              </label>
                              {/* Dropdown arrow */}
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Start date with floating label */}
                          <div className="w-full relative">
                            <input
                              type="text"
                              value={getDateInputValue(permission, 'start')}
                              onChange={(e) => handleStartDateInput(asset.address, e.target.value)}
                              maxLength={10}
                              className={`peer w-full h-[48px] px-3 pr-10 pt-5 pb-2 text-sm leading-[14px] border rounded-[4px] focus:outline-none focus:ring-1 ${
                                (permission as any)?._dateError
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                                  : 'border-gray-300 focus:ring-black focus:border-black'
                              }`}
                            />
                            {/* Smart placeholder overlay */}
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pt-5 pb-2 pointer-events-none peer-focus:opacity-100 opacity-0 text-sm text-gray-400 leading-[14px]">
                              <span className="invisible">{getDateInputValue(permission, 'start')}</span>
                              <span>{getDatePlaceholderOverlay(getDateInputValue(permission, 'start'))}</span>
                            </div>
                            <label className={`absolute left-3 text-gray-500 transition-all duration-200 pointer-events-none ${
                              getDateInputValue(permission, 'start')
                                ? 'top-1.5 text-[11px] translate-y-0'
                                : 'top-1/2 -translate-y-1/2 text-sm peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:translate-y-0'
                            }`}>
                              Start date
                            </label>
                            {/* Calendar icon button wrapper */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                              <input
                                key={`start-date-${asset.address}`}
                                id={`start-date-${asset.address}`}
                                name={`start-date-${asset.address}`}
                                type="date"
                                value=""
                                onChange={(e) => {
                                  console.log('[Start Date] Asset:', asset.symbol, 'Selected value:', e.target.value);
                                  if (e.target.value) {
                                    // Parse date string directly to avoid timezone issues
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                      const [year, month, day] = parts;
                                      console.log('[Start Date] Parsed:', { year, month, day, asset: asset.symbol });
                                      handleStartDateInput(asset.address, `${month}${day}${year}`);
                                    }
                                  }
                                  // Reset the input value to allow selecting the same date again
                                  e.target.value = '';
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('[Start Date] Clicked for asset:', asset.symbol);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <svg className="w-5 h-5 text-gray-400 pointer-events-none relative z-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            {/* Error message */}
                            {(permission as any)?._dateError && (
                              <p className="text-xs text-red-500 mt-1">{(permission as any)._dateError}</p>
                            )}
                          </div>

                          {/* End date with floating label */}
                          <div className="w-full relative">
                            <input
                              type="text"
                              value={getDateInputValue(permission, 'end')}
                              onChange={(e) => handleEndDateInput(asset.address, e.target.value)}
                              maxLength={10}
                              className={`peer w-full h-[48px] px-3 pr-10 pt-5 pb-2 text-sm leading-[14px] border rounded-[4px] focus:outline-none focus:ring-1 ${
                                (permission as any)?._dateError
                                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                                  : 'border-gray-300 focus:ring-black focus:border-black'
                              }`}
                            />
                            {/* Smart placeholder overlay */}
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pt-5 pb-2 pointer-events-none peer-focus:opacity-100 opacity-0 text-sm text-gray-400 leading-[14px]">
                              <span className="invisible">{getDateInputValue(permission, 'end')}</span>
                              <span>{getDatePlaceholderOverlay(getDateInputValue(permission, 'end'))}</span>
                            </div>
                            <label className={`absolute left-3 text-gray-500 transition-all duration-200 pointer-events-none ${
                              getDateInputValue(permission, 'end')
                                ? 'top-1.5 text-[11px] translate-y-0'
                                : 'top-1/2 -translate-y-1/2 text-sm peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:translate-y-0'
                            }`}>
                              End date
                            </label>
                            {/* Calendar icon button wrapper */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                              <input
                                key={`end-date-${asset.address}`}
                                id={`end-date-${asset.address}`}
                                name={`end-date-${asset.address}`}
                                type="date"
                                value=""
                                onChange={(e) => {
                                  console.log('[End Date] Asset:', asset.symbol, 'Selected value:', e.target.value);
                                  if (e.target.value) {
                                    // Parse date string directly to avoid timezone issues
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                      const [year, month, day] = parts;
                                      console.log('[End Date] Parsed:', { year, month, day, asset: asset.symbol });
                                      handleEndDateInput(asset.address, `${month}${day}${year}`);
                                    }
                                  }
                                  // Reset the input value to allow selecting the same date again
                                  e.target.value = '';
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('[End Date] Clicked for asset:', asset.symbol);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <svg className="w-5 h-5 text-gray-400 pointer-events-none relative z-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            {/* Error message */}
                            {(permission as any)?._dateError && (
                              <p className="text-xs text-red-500 mt-1">{(permission as any)._dateError}</p>
                            )}
                          </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Grant permissions button */}
          {!hideGrantButton && (
            <div className="py-2 flex justify-end">
              <button
                onClick={() => {
                  if (onGrantPermissions) {
                    onGrantPermissions();
                  }
                }}
                disabled={!canConfirm()}
                className={`px-6 py-2 rounded-[4px] text-sm font-medium ${
                  canConfirm()
                    ? 'bg-[#AD29FF] text-white hover:bg-opacity-90'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Grant permissions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
