'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChain } from '@/hooks/useChain';
import { creditsApi, CreditBalance } from '@/lib/api/credits';
import { ethers } from 'ethers';

const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
};

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '';
const PURCHASE_AMOUNT_USDC = '4.99';
const PURCHASE_AMOUNT_RAW = '4990000';

export default function AccountView() {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const data = await creditsApi.getBalance(address);
      if (!data.freeCreditsGranted) {
        try {
          const grantResult = await creditsApi.grantFree(address);
          setBalance({
            credits: grantResult.credits,
            used: 0,
            remaining: grantResult.remaining,
            freeCreditsGranted: true
          });
          return;
        } catch (grantErr) {
          // May fail if already granted - use fetched balance
        }
      }
      setBalance(data);
    } catch (err) {
      console.error('Failed to fetch credit balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handlePurchase = async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first.');
      return;
    }

    if (!TREASURY_ADDRESS) {
      setError('Treasury address not configured. Please contact support.');
      return;
    }

    const usdcAddress = USDC_ADDRESSES[config.chainId];
    if (!usdcAddress) {
      setError(`USDC not available on ${config.name}. Please switch to Ethereum or Base.`);
      return;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      setPurchaseStatus('Please confirm in your wallet...');
      const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
      const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, signer);
      const tx = await usdcContract.transfer(TREASURY_ADDRESS, PURCHASE_AMOUNT_RAW);

      setPurchaseStatus('Waiting for confirmation...');
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error('Transaction failed on-chain');
      }

      setPurchaseStatus('Verifying payment...');
      const result = await creditsApi.submitPurchase(address, receipt.hash, config.chainId, 'USDC');

      if (result.success) {
        setPurchaseStatus(null);
        await fetchBalance();
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (err: any) {
      console.error('Purchase failed:', err);
      if (err.code === 4001 || err.code === 'ACTION_REJECTED' || err.message?.includes('user rejected')) {
        setError('Transaction cancelled.');
      } else {
        setError(err.message || 'Purchase failed. Please try again.');
      }
      setPurchaseStatus(null);
    } finally {
      setIsPurchasing(false);
    }
  };

  const remaining = balance ? balance.remaining : 0;
  const total = balance ? balance.credits : 0;
  const used = balance ? balance.used : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-176px)] bg-white">
      <div className="pb-6 mt-10 px-6">
        <h1 className="text-4xl font-medium text-gray-900">Usage</h1>
        {address && (
          <p className="mt-2 text-sm text-gray-500">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {/* Credit usage */}
        <div className="py-6 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900 mb-4">Credit usage</h3>

          <div className="flex items-center gap-4">
            <div className="w-40 shrink-0">
              <p className="text-sm font-medium text-gray-900">Prompts used</p>
              <p className="text-xs text-gray-500">{total} total credits</p>
            </div>
            <div className="flex-1">
              {isLoading ? (
                <div className="h-2 bg-gray-200 rounded-full animate-pulse"></div>
              ) : (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      remaining <= 5 ? 'bg-red-500' : remaining <= 20 ? 'bg-yellow-500' : 'bg-[#AD29FF]'
                    }`}
                    style={{ width: `${total > 0 ? Math.round((used / total) * 100) : 0}%` }}
                  />
                </div>
              )}
            </div>
            <div className="w-20 text-right shrink-0">
              <span className="text-sm text-gray-500">{total > 0 ? Math.round((used / total) * 100) : 0}% used</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            {remaining} credits remaining
          </p>

          {remaining <= 5 && remaining > 0 && (
            <p className="mt-2 text-sm text-yellow-600">Running low on credits.</p>
          )}
          {remaining === 0 && total > 0 && (
            <p className="mt-2 text-sm text-red-500">No credits remaining.</p>
          )}
        </div>

        {/* Purchase credits */}
        <div className="py-6 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900 mb-1">Purchase credits</h3>
          <p className="text-sm text-gray-500 mb-4">
            100 prompts for ${PURCHASE_AMOUNT_USDC} USDC on {config.name}.
          </p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">$0.05 per prompt</p>
              <p className="text-xs text-gray-500">Direct USDC transfer. No intermediaries.</p>
            </div>
            <button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className={`h-[48px] px-6 rounded-[48px] text-base font-bold text-white transition-all ${
                isPurchasing
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-[#AD29FF] hover:bg-[#9523DC]'
              }`}
            >
              {isPurchasing
                ? purchaseStatus || 'Processing...'
                : 'Buy 100 credits'
              }
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* How credits work */}
        <div className="py-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">How credits work</h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li>New wallets receive <strong className="text-gray-700">20 free credits</strong> to try the AI assistant.</li>
            <li>Each prompt to the AI uses <strong className="text-gray-700">1 credit</strong>.</li>
            <li>Purchase <strong className="text-gray-700">100 credits for $4.99</strong> USDC.</li>
            <li>Payment is verified on-chain. Credits are added instantly.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
