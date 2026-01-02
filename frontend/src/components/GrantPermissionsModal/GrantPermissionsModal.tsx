'use client';
import { useChain } from '@/hooks/useChain';
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@/hooks/useWallet';
import { apiClient } from '@/lib/api/apiClient';
import * as Sentry from '@sentry/nextjs';
import StepList from '@/components/shared/StepList';
import ErrorAlert from '@/components/shared/ErrorAlert';
import { XMarkIcon as XIcon } from '@heroicons/react/24/outline';
import { SmartAccountPermission, AgentAsset } from '@/lib/smartAccount/types';
import { createSmartAccount, detectSmartAccountImplementation } from '@/lib/smartAccount/router';
import { isMetaMaskFlask } from '@/lib/smartAccount/detectFlask';

interface GrantPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: AgentAsset[];
  permissions: SmartAccountPermission[];
  expiryDays: number;
  enableRateLimit: boolean;
  rateLimit: { count: number; interval: number };
  enableCallLimit: boolean;
  callLimit: number;
  enableGasLimit: boolean;
  gasLimit: string;
  onComplete?: () => void | Promise<void>;
  walletAddress?: string;
  walletEthereum?: any;
  /** If true, renders content inline without modal wrapper (for embedding in bottom sheets) */
  inline?: boolean;
}

type StepStatus = 'pending' | 'loading' | 'completed' | 'error';
interface Step {
  title: string;
  status: StepStatus;
  txHash?: string;
}

const LoadingAnimation = ({ size = 16 }: { size?: number }) => (
  <div
    className="inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
    style={{ width: `${size}px`, height: `${size}px` }}
    role="status"
  >
    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
      Loading...
    </span>
  </div>
);

export default function GrantPermissionsModal({
  isOpen,
  onClose,
  selectedAssets,
  permissions,
  expiryDays,
  enableRateLimit,
  rateLimit,
  enableCallLimit,
  callLimit,
  enableGasLimit,
  gasLimit,
  onComplete,
  walletAddress,
  walletEthereum,
  inline = false,
}: GrantPermissionsModalProps) {
  const { address: connectedWalletAddress, isConnected } = useWallet();
  const { config } = useChain();
  const [currentView, setCurrentView] = useState<'processing' | 'success'>('processing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [steps, setSteps] = useState<Step[]>([
    { title: '1. Grant ERC-7715 permissions', status: 'pending' },
    { title: '2. Register wallet agent', status: 'pending' }
  ]);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [permissionsContext, setPermissionsContext] = useState<string | null>(null);
  const [allPermissionContexts, setAllPermissionContexts] = useState<Record<string, string> | null>(null);
  const [delegationManager, setDelegationManager] = useState<string | null>(null);
  const [accountMeta, setAccountMeta] = useState<any>(null);
  const [implementation, setImplementation] = useState<'erc7715' | null>(null);
  const processStarted = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);

  const effectiveAddress = walletAddress || connectedWalletAddress;
  const effectiveEthereum = walletEthereum || (typeof window !== 'undefined' ? (window as any).ethereum : null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('processing');
      setIsProcessing(false);
      setError(null);
      setCurrentStage('');
      setSmartAccountAddress(null);
      setPermissionsContext(null);
      setAllPermissionContexts(null);
      setDelegationManager(null);
      setAccountMeta(null);
      setImplementation(null);
      processStarted.current = false;
      setHasStarted(false);
      setSteps([
        { title: '1. Grant ERC-7715 permissions', status: 'pending' as const },
        { title: '2. Register wallet agent', status: 'pending' as const }
      ]);
    }
  }, [isOpen]);

  // Auto-start on open
  useEffect(() => {
    if (isOpen && !isProcessing && effectiveAddress && isConnected && !hasStarted && !processStarted.current) {
      setHasStarted(true);
      processStarted.current = true;
      handleStartGrantPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isProcessing, effectiveAddress, isConnected, hasStarted]);

  const handleStartGrantPermissions = async () => {
    try {
      if (isProcessing) return;

      if (!isConnected || !effectiveAddress) return;

      if (!effectiveEthereum) {
        setError('Please connect your MetaMask wallet');
        return;
      }

      setIsProcessing(true);
      setError(null);
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));

      // Switch to Sepolia before capability detection
      setCurrentStage('Switching to Sepolia...');
      const currentChainId = await effectiveEthereum.request({ method: 'eth_chainId' });
      const currentChainNumber = parseInt(currentChainId, 16);

      if (currentChainNumber !== 11155111) {
        console.log(`[GrantPermissions] Wallet on chain ${currentChainNumber}, switching to Sepolia...`);
        try {
          await effectiveEthereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia
          });
          console.log('[GrantPermissions] Switched to Sepolia');
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await effectiveEthereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
              }],
            });
          } else if (switchError.code === 4001) {
            throw new Error('Please switch to Sepolia testnet to use ERC-7715 permissions');
          } else {
            throw new Error('Please switch to Sepolia testnet to use ERC-7715 permissions');
          }
        }
      }

      // Check if MetaMask Flask is being used (after switching to Sepolia)
      // Note: Flask detection can be unreliable, so we just log and proceed
      // The actual requestExecutionPermissions call will confirm if Flask works
      const hasFlask = await isMetaMaskFlask(effectiveEthereum);
      if (!hasFlask) {
        console.warn('[GrantPermissions] Flask detection returned false, but proceeding anyway');
        console.warn('[GrantPermissions] The test page works without detection, so we should too');
      } else {
        console.log('[GrantPermissions] Flask detected successfully');
      }

      setCurrentStage('');

      // Step 1: Grant ERC-7715 permissions and create smart account
      await handleGrantPermissions();
    } catch (error: any) {
      Sentry.captureException(error);
      setError(error?.message || 'Failed to start permission granting process');
      setIsProcessing(false);
    }
  };

  const handleGrantPermissions = async () => {
    try {
      setCurrentStage('Granting ERC-7715 permissions...');

      if (!effectiveEthereum) {
        throw new Error('Please connect your MetaMask wallet');
      }

      if (!effectiveAddress) {
        throw new Error('Wallet address is required');
      }

      // Detect smart account implementation
      const detection = await detectSmartAccountImplementation(effectiveEthereum);
      console.log(`[Permission Grant] Using ${detection.implementation}: ${detection.message}`);
      setImplementation(detection.implementation);

      // Validate at least one permission has a limit set
      const validPermissions = permissions.filter(p => p.dailyLimit && parseFloat(p.dailyLimit) > 0);
      if (validPermissions.length === 0) {
        throw new Error('No valid permission limits set');
      }

      // Create smart account with ERC-7715 permissions
      // The createSmartAccount function will handle the conversion to ERC-7715 format internally
      // Use backend delegation key so the backend can execute trades autonomously within ERC-7715 limits
      const backendDelegationAddress = process.env.NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS;
      if (!backendDelegationAddress) {
        throw new Error('Backend delegation address not configured. Set NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS in environment variables.');
      }

      const smartAccountResult = await createSmartAccount(
        effectiveEthereum,
        effectiveAddress,
        validPermissions,
        backendDelegationAddress // Backend can execute trades within ERC-7715 limits
      );

      // Log the NEW permission contexts from MetaMask (for debugging stale context issues)
      console.log('[GrantPermissions] ✅ NEW smartAccountResult:', {
        smartAccountAddress: smartAccountResult.smartAccountAddress,
        permissionsContext: smartAccountResult.permissionsContext?.slice(0, 40) + '...',
        allPermissionContexts: smartAccountResult.allPermissionContexts ? Object.keys(smartAccountResult.allPermissionContexts) : [],
        delegationManager: smartAccountResult.delegationManager
      });

      setSmartAccountAddress(smartAccountResult.smartAccountAddress);
      setPermissionsContext(smartAccountResult.permissionsContext || null);
      setAllPermissionContexts(smartAccountResult.allPermissionContexts || null);
      setDelegationManager(smartAccountResult.delegationManager || null);

      // Complete step 1
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'completed' } : s));
      setCurrentStage('');

      console.log('[GrantPermissions] ERC-7715 permissions granted, proceeding to register wallet agent');
      console.log('[GrantPermissions] All permission contexts:', smartAccountResult.allPermissionContexts);

      // Proceed to step 2 - PASS ALL CONTEXTS so backend can use the right one per token
      setTimeout(() => {
        handleRegisterWalletAgent(
          smartAccountResult.smartAccountAddress,
          smartAccountResult.permissionsContext, // Primary context (backward compat)
          smartAccountResult.delegationManager,
          smartAccountResult.allPermissionContexts || null // All contexts by token
        );
      }, 500);

    } catch (error: any) {
      Sentry.captureException(error);

      let errorMessage = error?.message || 'Failed to grant permissions';

      // Check for wallet_grantPermissions not available error
      if (error?.message?.includes('wallet_grantPermissions') ||
          error?.message?.includes('does not exist') ||
          error?.message?.includes('not available')) {
        errorMessage = 'MetaMask Advanced Permissions (ERC-7715) requires MetaMask Flask v13.5.0+. Please install MetaMask Flask from https://metamask.io/flask/ to use this feature.';
      }

      // Check for user rejection
      if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') {
        errorMessage = 'Request was declined. Please try again and approve the MetaMask request.';
      }

      setError(errorMessage);
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'error' } : s));
      setIsProcessing(false);
    }
  };

  const handleRegisterWalletAgent = async (
    smartAccount: string,
    permContext: string | undefined,
    delegManager: string | undefined,
    allContexts: Record<string, string> | null // All permission contexts by token
  ) => {
    try {
      // Step 2: Register Wallet Agent
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'loading' } : s));
      setCurrentStage('Registering wallet agent...');

      // DEBUG: Log what we received to register
      console.log('[RegisterWalletAgent] ✅ Received permContext:', permContext?.slice(0, 40) + '...');
      console.log('[RegisterWalletAgent] ✅ Received allContexts:', allContexts ? Object.keys(allContexts) : 'none');
      console.log('[RegisterWalletAgent] Received delegManager:', delegManager);

      if (!effectiveAddress) {
        throw new Error('Wallet address is required');
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + (expiryDays * 24 * 60 * 60);

      // Helper to convert frequency to period duration in seconds
      const frequencyToDuration = (frequency?: string): number => {
        switch (frequency) {
          case 'hourly': return 3600;      // 1 hour
          case 'daily': return 86400;      // 1 day
          case 'weekly': return 604800;    // 7 days
          case 'monthly': return 2592000;  // 30 days
          case 'yearly': return 31536000;  // 365 days
          default: return 86400;           // Default to daily
        }
      };

      // Build scopes array that matches what we sent to MetaMask (ERC-7715 format)
      // Backend needs this to track and enforce limits
      // See: https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf
      const scopes: Array<{
        type: string;
        periodAmount: string;
        periodAmountFormatted: string;
        periodDuration: number;
        frequency?: string;
        startTime?: number;
        expiresAt?: number;  // Per-token expiration (mapped from endTime)
        tokenAddress?: string;
        tokenSymbol?: string;
        decimals?: number;
      }> = [];

      // Get spending limit permissions
      const spendingLimits = permissions.filter(perm => perm.type === 'spending-limit');
      
      // Check if we have an explicit native token permission
      const hasExplicitNativePermission = spendingLimits.some(
        perm => perm.asset?.toLowerCase() === '0x0000000000000000000000000000000000000000'
      );

      // ALWAYS add native token scope first (required for ERC-7715 enforcer chain)
      // If user didn't specify one, use default 0.1 ETH for gas fees
      if (!hasExplicitNativePermission) {
        const defaultNativeAmount = '100000000000000000'; // 0.1 ETH in wei
        scopes.push({
          type: 'nativeTokenPeriodTransfer',
          periodAmount: defaultNativeAmount,
          periodAmountFormatted: '0.1 ETH',
          periodDuration: 86400, // Default daily for gas allowance
          frequency: 'daily'
        });
      }

      // Convert each permission to the backend scope format
      for (const perm of spendingLimits) {
        const isNativeToken = perm.asset?.toLowerCase() === '0x0000000000000000000000000000000000000000';
        const decimals = isNativeToken ? 18 : 6; // ETH = 18, assume ERC-20 tokens are 6 (USDC)
        
        // Parse the limit to wei/smallest unit
        const limitFloat = parseFloat(perm.dailyLimit || '0');
        if (limitFloat <= 0) continue; // Skip if no valid limit

        // Calculate period amount in smallest unit (wei for ETH, 6 decimals for USDC)
        const periodAmountBigInt = BigInt(Math.floor(limitFloat * Math.pow(10, decimals)));
        const periodAmount = periodAmountBigInt.toString();

        // Get period duration from frequency
        const periodDuration = frequencyToDuration(perm.frequency);
        const frequencyLabel = perm.frequency || 'daily';

        if (isNativeToken) {
          scopes.push({
            type: 'nativeTokenPeriodTransfer',
            periodAmount: periodAmount,
            periodAmountFormatted: `${perm.dailyLimit} ETH`,
            periodDuration: periodDuration,
            frequency: frequencyLabel,
            startTime: perm.startTime,
            expiresAt: perm.endTime  // Map endTime to expiresAt for backend
          });
        } else {
          // Find the asset info from selectedAssets
          const asset = selectedAssets.find(a => a.address.toLowerCase() === perm.asset?.toLowerCase());
          scopes.push({
            type: 'erc20PeriodTransfer',
            tokenAddress: perm.asset,
            tokenSymbol: asset?.symbol || 'TOKEN',
            decimals: decimals,
            periodAmount: periodAmount,
            periodAmountFormatted: `${perm.dailyLimit} ${asset?.symbol || 'TOKEN'}`,
            periodDuration: periodDuration,
            frequency: frequencyLabel,
            startTime: perm.startTime,
            expiresAt: perm.endTime  // Map endTime to expiresAt for backend
          });
        }
      }

      // Prepare request body according to API specs
      const backendDelegationAddress = process.env.NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS;
      const requestBody = {
        walletAddress: effectiveAddress,
        backendDelegationAddress: backendDelegationAddress, // Backend key that has ERC-7715 permissions
        permissionsContext: permContext, // Primary context (backward compat)
        allPermissionContexts: allContexts, // All contexts keyed by token address ('native' for ETH)
        delegationManager: delegManager,
        chainId: 11155111, // Sepolia
        expiresAt: expiresAt,
        smartAccountAddress: smartAccount,
        scopes: scopes
      };

      console.log('[Wallet Agent] Registering with backend delegation key:', backendDelegationAddress);
      console.log('[Wallet Agent] Scopes:', scopes);
      console.log('[Wallet Agent] All permission contexts:', allContexts ? Object.keys(allContexts) : 'none');
      console.log('Registering wallet agent with params:', requestBody);

      // Call REGISTER_WALLET_AGENT_URL endpoint
      const response = await apiClient.post('REGISTER_WALLET_AGENT_URL', requestBody) as any;

      console.log('Wallet agent registered:', response);

      if (!response.success) {
        throw new Error(response.message || 'Failed to register wallet agent');
      }

      // Complete step 2
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'completed' } : s));
      setCurrentStage('');
      setIsProcessing(false);

      // Show success view
      setCurrentView('success');

    } catch (err: any) {
      console.error('Error registering wallet agent:', err);
      Sentry.captureException(err);
      setError(err?.message || 'Failed to register wallet agent');
      setIsProcessing(false);
      setCurrentStage('');
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'error' } : s));
    }
  };

  const handleRetry = () => {
    setError(null);
    setCurrentView('processing');
    setIsProcessing(false);

    // Determine which step failed and retry from that point
    const failedStepIndex = steps.findIndex(s => s.status === 'error');

    if (failedStepIndex === 0) {
      // Step 1 failed - reset everything and start over
      setSmartAccountAddress(null);
      setPermissionsContext(null);
      setAllPermissionContexts(null);
      setDelegationManager(null);
      setAccountMeta(null);
      setImplementation(null);
      setHasStarted(false);
      processStarted.current = false;
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'pending' } : s));
    } else if (failedStepIndex === 1) {
      // Step 2 failed - retry registering wallet agent
      if (!smartAccountAddress || !permissionsContext || !delegationManager) {
        // Missing required state, start over
        setHasStarted(false);
        processStarted.current = false;
      } else {
        // Retry step 2
        setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'pending' } : s));
        setTimeout(() => {
          handleRegisterWalletAgent(smartAccountAddress, permissionsContext, delegationManager, allPermissionContexts);
        }, 100);
      }
    } else {
      // No failed step found or unknown state, reset everything
      setHasStarted(false);
      processStarted.current = false;
    }
  };

  const handleCloseModal = () => {
    if (!isProcessing) {
      processStarted.current = false;
      setHasStarted(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Inner content that can be used both inline and in modal
  const innerContent = (
    <div className="flex flex-col h-full">
      {currentView === 'processing' && (
        <>
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 pb-4 flex items-center justify-center relative">
              <h2 className="text-xl font-semibold">Grant agent permissions</h2>
              {!inline && (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="absolute top-8 right-8 text-gray-400 hover:text-gray-500 focus:outline-none"
                  disabled={isProcessing}
                >
                  <XIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="px-8 pt-4 pb-8 flex justify-center">
              <div className="w-full max-w-md">
                <ErrorAlert error={error} />
                <StepList
                  steps={steps}
                  signingSubstep={null}
                  zkProofStage={undefined}
                  isTransactionSubmitted={false}
                  signatureExpiry={null}
                  getEtherscanLink={(tx) => `https://basescan.org/tx/${tx}`}
                  keyManagementType="Self custody"
                  kmsCommitment={null}
                  commitmentMatched={null}
                  customStep2Message={currentStage || undefined}
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer - Natural flexbox bottom */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-center">
            <div className="w-[656px] flex gap-3">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-6 h-[48px] rounded-[4px] text-sm font-medium bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                onClick={handleRetry}
                disabled={isProcessing || !error}
                className={`flex-1 h-[48px] px-6 rounded-[4px] text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isProcessing
                    ? 'bg-[#AD29FF] text-white cursor-wait'
                    : error
                    ? 'bg-[#AD29FF] text-white hover:opacity-90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <LoadingAnimation size={16} />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Retry'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {currentView === 'success' && (
        <>
          <div className="">
            <div className="p-8 pb-4 flex items-center justify-center relative">
              <h2 className="text-xl font-semibold text-center">Permissions granted!</h2>
            </div>
          </div>

          <div className="p-8 pt-4">
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-600 mb-8 text-center">
                Your wallet agent permissions have been successfully configured!
              </p>

              <button
                onClick={async () => {
                  console.log('[GrantPermissionsModal] Done clicked, calling onComplete...');
                  if (onComplete) {
                    await onComplete();
                    console.log('[GrantPermissionsModal] onComplete finished');
                  }
                  onClose();
                }}
                className="w-full max-w-xs h-[48px] px-6 rounded-[4px] text-sm font-medium bg-[#AD29FF] text-white hover:opacity-90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // If inline mode, render content directly without modal wrapper
  if (inline) {
    return innerContent;
  }

  // Modal mode - render with portal
  const modalContent = (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleCloseModal} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg max-w-lg w-[calc(100%-2rem)] max-h-[90vh] shadow-xl">
        {innerContent}
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
