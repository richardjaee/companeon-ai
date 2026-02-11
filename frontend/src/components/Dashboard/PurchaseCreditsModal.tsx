'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
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

interface PurchaseCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PurchaseCreditsModal({ isOpen, onClose }: PurchaseCreditsModalProps) {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
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
          // May fail if already granted
        }
      }
      setBalance(data);
    } catch (err) {
      console.error('Failed to fetch credit balance:', err);
    }
  }, [address]);

  useEffect(() => {
    if (isOpen) {
      fetchBalance();
      setError(null);
      setSuccess(false);
      setPurchaseStatus(null);
    }
  }, [isOpen, fetchBalance]);

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
    setSuccess(false);

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
        setSuccess(true);
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

  const handleClose = () => {
    if (!isPurchasing) onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="p-6 pb-0 flex items-start justify-between">
              <div>
                <Dialog.Title className="text-xl font-bold text-gray-900">Buy credits</Dialog.Title>
                <p className="text-sm text-gray-500 mt-1">Get more prompts for the AI assistant.</p>
              </div>
              <button
                onClick={handleClose}
                disabled={isPurchasing}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 mt-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Line items */}
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-gray-600">100 prompts</span>
                  <span className="text-sm font-medium text-gray-900">${PURCHASE_AMOUNT_USDC}</span>
                </div>
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm font-medium text-gray-900">Total due</span>
                  <span className="text-sm font-bold text-gray-900">{PURCHASE_AMOUNT_USDC} USDC</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="mt-5 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">Payment method</span>
                <span className="text-sm font-medium text-gray-900">USDC on {config.name}</span>
              </div>

              {/* Success message */}
              {success && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">100 credits added successfully.</p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Purchase button */}
              <button
                onClick={handlePurchase}
                disabled={isPurchasing || success}
                className={`w-full mt-5 h-[48px] rounded-[48px] text-base font-bold text-white transition-all ${
                  isPurchasing || success
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-[#AD29FF] hover:bg-[#9523DC]'
                }`}
              >
                {isPurchasing
                  ? purchaseStatus || 'Processing...'
                  : success
                    ? 'Done'
                    : 'Purchase'
                }
              </button>

              <p className="text-xs text-gray-400 mt-3 text-center">
                By clicking Purchase, you authorize a {PURCHASE_AMOUNT_USDC} USDC transfer to the treasury wallet.
              </p>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}
