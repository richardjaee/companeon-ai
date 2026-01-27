'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTokenData } from '@/hooks/useTokenData';
import { useNFTData, useCompaneonNFTData } from '@/hooks/useNFTData';
import { useStaggeredDataFetch } from '@/hooks/useStaggeredDataFetch';
import { useNFTs } from '@/context/NFTContext';
import { useRouter, useSearchParams } from 'next/navigation';
import CompaneonChatInterface from '@/components/Chat/CompaneonChatInterface';

import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChain } from '@/hooks/useChain';

import GetStartedSection from '../GetStartedSection';
import AgentPermissionsView from './AgentPermissionsView';
import PermissionList from '@/components/PermissionList/PermissionList';
import { AgentAsset } from '@/lib/smartAccount/types';
import DisconnectConfirmModal from '@/components/Auth/DisconnectConfirmModal';
import AuthModal from '@/components/Auth/AuthModal';
import { useQueryClient } from '@tanstack/react-query';
import { walletApi } from '@/lib/api/wallet';

const CryptoBalance = dynamic(() => import('@/app/[chain]/portfolio/components/cryptoBalance'), {
  loading: () => <div className="text-center py-4">Loading balances...</div>,
  ssr: false
});

export default function PortfolioView() {
  const { config } = useChain();
  const [companeonContractAddress, setCompaneonContractAddress] = useState<string | null>(null);
  const [isCoinSectionOpen, setIsCoinSectionOpen] = useState(true);
  const [isNFTSectionOpen, setIsNFTSectionOpen] = useState(true);
  
  const [isTokenSelectionMode, setIsTokenSelectionMode] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [isDepositingMode, setIsDepositingMode] = useState(false);
  const [currentHashedTransactionId, setCurrentHashedTransactionId] = useState<string | null>(null);
  const [isCreateModeOnly, setIsCreateModeOnly] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedHashedTransactionId, setSelectedHashedTransactionId] = useState<string | null>(null);
  
  const [showNFTDetails, setShowNFTDetails] = useState(false);
  const [selectedNFTItem, setSelectedNFTItem] = useState<any>(null);
  const [totalValue, setTotalValue] = useState<string>('0');
  const [isValueLoading, setIsValueLoading] = useState(false);
  
  const [showPortfolioDetailView, setShowPortfolioDetailView] = useState(false);
  const [portfolioContents, setPortfolioContents] = useState<any>(null);
  const [portfolioTokenPrices, setPortfolioTokenPrices] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAssistantChat, setShowAssistantChat] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isChatCollapsing, setIsChatCollapsing] = useState(false);
  const [showAgentPermissions, setShowAgentPermissions] = useState(false);
  const [isAgentPermissionsClosing, setIsAgentPermissionsClosing] = useState(false);
  const [agentSelectedAssets, setAgentSelectedAssets] = useState<AgentAsset[]>([]);
  const [walletLimits, setWalletLimits] = useState<any[]>([]);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);

  const handleCloseAgentPermissions = () => {
    setIsAgentPermissionsClosing(true);
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { address, isConnected, connectWallet, walletType, signMessage, chainType } = useUnifiedWallet();
  
  const { enableTokenData, enableNFTData, enableCompaneonData } = useStaggeredDataFetch(isConnected, address);
  
  const { data: tokenData, isLoading: isTokenLoading } = useTokenData(enableTokenData && isConnected);
  const { data: nftContractData, isLoading: isNFTLoading } = useNFTData(enableNFTData && isConnected);
  const { data: companeonNFTData } = useCompaneonNFTData(enableCompaneonData && isConnected);
  const { setNFTData } = useNFTs();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const needs2FASetup = companeonNFTData && 'totpConfirmed' in companeonNFTData ? !companeonNFTData.totpConfirmed : false;

  const portfolioSummary = useMemo(() => {
    const sanitize = (value: any): number => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    let totalValue = 0;
    let ethBalanceParsed = 0;
    const assets: Array<{ symbol: string; name: string; amount: number; value: number; tokenAddress: string }> = [];

    if (tokenData?.eth) {
      const amount = sanitize(tokenData.eth.balance);
      const usdValue = sanitize(tokenData.eth.totalValueInUSD);
      ethBalanceParsed = amount;
      totalValue += usdValue;
      assets.push({
        symbol: 'ETH',
        name: 'Ethereum',
        amount,
        value: usdValue,
        tokenAddress: 'native'
      });
    }

    (tokenData?.tokens || []).forEach((token: any) => {
      const amount = sanitize(token.balance);
      const usdValue = sanitize(token.totalValueInUSD);
      totalValue += usdValue;
      // Only include tokens with non-zero balance
      if (amount > 0) {
        assets.push({
          symbol: token.symbol || 'TOKEN',
          name: token.name || token.symbol || 'Token',
          amount,
          value: usdValue,
          tokenAddress: token.contract || token.symbol || ''
        });
      }
    });

    return {
      totalValue,
      ethBalance: ethBalanceParsed,
      assets
    };
  }, [tokenData]);

  const totalPortfolioValue = portfolioSummary.totalValue;
  const assistantAssetsForChat = portfolioSummary.assets;
  const ethBalance = portfolioSummary.ethBalance;
  const tokenCount = tokenData?.tokens?.length ?? 0;
  const nftCount = useMemo(() => {
    if (!nftContractData || !('nfts' in nftContractData) || !nftContractData?.nfts) return 0;
    return nftContractData.nfts.length;
  }, [nftContractData]);

  const topHoldings = useMemo(() => {
    if (!assistantAssetsForChat || assistantAssetsForChat.length === 0) return [] as Array<{ symbol: string; valueUSD: number; percentage: number }>;
    const sorted = [...assistantAssetsForChat].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 3);
    return top.map(asset => ({
      symbol: asset.symbol,
      valueUSD: asset.value,
      percentage: totalPortfolioValue > 0 ? (asset.value / totalPortfolioValue) * 100 : 0,
    }));
  }, [assistantAssetsForChat, totalPortfolioValue]);

  const shortenAddress = (address: string | null) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    const checkAuth = () => {
      const hasValidConnection = isConnected;
      
      if (hasValidConnection !== isAuthenticated) {
        setIsAuthenticated(hasValidConnection);
      }
    };
    
    checkAuth();
    const interval = setInterval(checkAuth, 2000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, isConnected]);

  useEffect(() => {
    if (nftContractData) {
      setNFTData(prevData => ({
        ...nftContractData,
        tokenIdAndImages: prevData?.tokenIdAndImages || [],
        needs2FASetup: prevData?.needs2FASetup ?? false
      }));
    }
  }, [nftContractData, setNFTData]);

  useEffect(() => {
    const fetchContractAddresses = async () => {
      try {
        const contractAddress = process.env.NEXT_PUBLIC_COMPANEON_CONTRACT_ADDRESS || '';
        if (!contractAddress) {
          setCompaneonContractAddress(null);
          return;
        }
        
        const addresses = contractAddress.split(',').map(addr => addr.trim());
        setCompaneonContractAddress(addresses[0]);
      } catch (error) {
        setCompaneonContractAddress(null);
      }
    };

    fetchContractAddresses();
  }, []);

  useEffect(() => {
    const handleReturnToItem = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tokenId) {
        const { tokenId, hashedTransactionId, itemNFT, forceRefresh } = customEvent.detail;
        
        if (itemNFT) {
          setSelectedNFTItem(itemNFT);
          setShowNFTDetails(true);
        }
        handleViewItem(tokenId, hashedTransactionId, forceRefresh || false);
        
        }
    };

    window.addEventListener('companeon:return', handleReturnToItem);
    
    return () => {
      window.removeEventListener('companeon:return', handleReturnToItem);
    };
  }, []);

  useEffect(() => {
  }, [showNFTDetails, selectedNFTItem, companeonContractAddress]);

  // Fetch wallet limits function (extracted for reuse)
  const fetchWalletLimits = useCallback(async () => {
    if (!address || !isConnected) {
      
      setWalletLimits([]);
      return;
    }

    
    setIsLoadingLimits(true);
    try {
      const response = await walletApi.getWalletLimits(address);
      
      // Handle nested output structure from backend
      const data = (response as any).output || response;

      if (response.success && data.delegationEnabled && data.limits && data.limits.length > 0) {
        // Fallback global expiry if per-limit not available
        const globalExpiryDate = data.expiresAt ? new Date(data.expiresAt) : null;
        
        // Map all limits to display format with per-token expiration
        const mappedLimits = data.limits.map((limit: any) => {
          // Use pre-formatted dates from API if available, otherwise fall back to computing
          let startDateDisplay = limit.startTimeFormatted || 'Not set';
          let endDateDisplay = limit.expiresAtFormatted || limit.expiresIn || 'Not set';

          // Fallback: if no formatted dates, compute from timestamps
          // API timestamps may be in seconds (Unix) or milliseconds - check and convert
          if (!limit.startTimeFormatted && limit.startTime) {
            const ts = limit.startTime < 4102444800 ? limit.startTime * 1000 : limit.startTime;
            startDateDisplay = new Date(ts).toLocaleDateString();
          }
          if (!limit.expiresAtFormatted && limit.expiresAt) {
            const ts = limit.expiresAt < 4102444800 ? limit.expiresAt * 1000 : limit.expiresAt;
            endDateDisplay = new Date(ts).toLocaleDateString();
          }

          // Use human-readable frequency from API (e.g., "per day", "per hour")
          // Fall back to periodDuration if frequency not available
          const frequencyDisplay = limit.frequency || limit.periodDuration || 'daily';

          return {
            asset: limit.asset,
            tokenAddress: limit.tokenAddress,
            configuredLimit: limit.configuredLimit,
            remainingLimit: `${limit.available}`,
            frequency: frequencyDisplay,
            startDate: startDateDisplay,
            endDate: endDateDisplay,
            // Also store raw values for debugging
            expiresIn: limit.expiresIn,
            rawExpiresAt: limit.expiresAt
          };
        });

        setWalletLimits(mappedLimits);
        
      } else {
        
        setWalletLimits([]);
      }
    } catch (error) {
      
      setWalletLimits([]);
    } finally {
      setIsLoadingLimits(false);
    }
  }, [address, isConnected]);

  // Handler for when permissions are successfully granted - refresh limits then close
  const handleAgentPermissionsComplete = useCallback(async () => {
    
    try {
      // Small delay to allow backend to process the new permissions
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await fetchWalletLimits();
      
    } catch (error) {
      
    }
    setIsAgentPermissionsClosing(true);
  }, [fetchWalletLimits]);

  // Listen for transaction completion and refresh balances
  useEffect(() => {
    const handleTransactionComplete = async (e: Event) => {
      const customEvent = e as CustomEvent;
      
      try {
        // Invalidate queries to trigger refetch of token data
        await queryClient.invalidateQueries({ queryKey: ['tokenData'] });
        await queryClient.invalidateQueries({ queryKey: ['nftData'] });
        await queryClient.invalidateQueries({ queryKey: ['companeonNftData'] });

        // Refresh wallet limits to update remaining amounts
        await fetchWalletLimits();

        
      } catch (error) {
        
      }
    };

    window.addEventListener('companeon-transaction-complete', handleTransactionComplete);

    return () => {
      window.removeEventListener('companeon-transaction-complete', handleTransactionComplete);
    };
  }, [queryClient, fetchWalletLimits]);

  // Fetch wallet limits on mount and when address changes
  useEffect(() => {
    fetchWalletLimits();
  }, [fetchWalletLimits]);

  const handleTokenSelect = (token: { symbol: string; contract?: string; balance: string }) => {
    setSelectedTokens(prev => {
      const newSelection = new Set(prev);
      
      const identifier = token.symbol === 'ETH' ? 'native' : token.contract;
      
      if (!identifier) {
        return prev;
      }
      
      if (newSelection.has(identifier)) {
        newSelection.delete(identifier);
        return newSelection;
      }
      
      newSelection.add(identifier);
      return newSelection;
    });
  };

  const handleNFTSelect = (nft: any) => {

    if (!nft) {
      setSelectedNFTs(new Set());
      return;
    }

    const isFiltered = nft.contract && 
      companeonContractAddress && 
      (typeof nft.contract === 'string' 
        ? nft.contract.toLowerCase() === companeonContractAddress.toLowerCase()
        : (nft.contract.address && nft.contract.address.toLowerCase() === companeonContractAddress.toLowerCase()));
    
    if (isFiltered) {
      return;
    }
    
    const uniqueKey = nft.contract && nft.tokenId 
      ? `${typeof nft.contract === 'string' ? nft.contract.toLowerCase() : nft.contract.address.toLowerCase()}-${nft.tokenId}` 
      : nft.tokenId || '';
    
    if (uniqueKey) {

      setSelectedNFTs(prev => {
        const newSelection = new Set(prev);
        
        if (newSelection.has(uniqueKey)) {
          newSelection.delete(uniqueKey);
          return newSelection;
        }
        
        newSelection.add(uniqueKey);
        return newSelection;
      });
    }
  };

  const handleStartCoinSelection = (hashedTransactionId: string = '', tokenId?: string, currentValue?: number, plan?: string) => {
    setIsTokenSelectionMode(true);
    setIsDepositingMode(!!(hashedTransactionId || tokenId));
    
    if (hashedTransactionId) {
      setCurrentHashedTransactionId(hashedTransactionId);
      setIsCreateModeOnly(false);
    } else {

      setCurrentHashedTransactionId(null);
    }
    
    if (tokenId) {
      setSelectedTokenId(tokenId);
      
      if (companeonNFTData) {
        let nftsArray: any[] = [];
        if (Array.isArray(companeonNFTData)) {
          nftsArray = companeonNFTData;
        } else if (companeonNFTData.nfts && Array.isArray(companeonNFTData.nfts)) {
          nftsArray = companeonNFTData.nfts;
        } else if (typeof companeonNFTData === 'object') {
          nftsArray = Object.values(companeonNFTData).filter(item => !!item);
        }
        
        const correspondingNFT = nftsArray.find((nft: any) => {
          if (hashedTransactionId && nft.hashedTransactionId === hashedTransactionId) {
            return true;
          }
          if (nft.tokenId === tokenId) {
            return true;
          }
          return false;
        });
        
        if (correspondingNFT) {
          setSelectedNFTItem(correspondingNFT);
        }
      }
    }
    
    if (plan) {
      setCurrentPlan(plan);
    } else {
      setCurrentPlan(null);
    }
  };

  const handleDeselectItem = () => {
    setCurrentHashedTransactionId(null);
    setSelectedTokenId(null);
    setCurrentPlan(null);
    setIsDepositingMode(false);
    setSelectedNFTItem(null);
  };

  const handleCancelSelection = () => {
    setIsDepositingMode(false);
    setCurrentHashedTransactionId(null);
    setCurrentPlan(null);
    setIsCreateModeOnly(false);
    setIsTokenSelectionMode(false);
    setSelectedTokens(new Set());
    setSelectedNFTs(new Set()); 
    handleNFTSelect(null);
    
    setSelectedTokenId(null);
    setSelectedHashedTransactionId(null);
    setSelectedNFTItem(null);
  };

  useEffect(() => {
    if (!searchParams) return;
    
    const depositMode = searchParams.get('depositMode');
    const itemId = searchParams.get('itemId');
    const txId = searchParams.get('txId');
    const plan = searchParams.get('plan');
    
    if (depositMode === 'true' && itemId && !isTokenSelectionMode) {
      const initiateDepositMode = () => {
        let itemNFT = null;
        if (companeonNFTData) {
          let nftsArray: any[] = [];
          if (Array.isArray(companeonNFTData)) {
            nftsArray = companeonNFTData;
          } else if (companeonNFTData.nfts && Array.isArray(companeonNFTData.nfts)) {
            nftsArray = companeonNFTData.nfts;
        } else if (typeof companeonNFTData === 'object') {
          nftsArray = Object.values(companeonNFTData).filter(item => !!item);
          }
          
          itemNFT = nftsArray.find((nft: any) => {
            if (txId && nft.hashedTransactionId === txId) {
              return true;
            }
            if (nft.tokenId === itemId) {
              return true;
            }
            return false;
          });
        }
        
        setSelectedTokenId(itemId);
        setSelectedHashedTransactionId(txId || null);
        setSelectedNFTItem(itemNFT);
        
        handleStartCoinSelection(txId || '', itemId, undefined, plan || undefined);
        
        const newParams = new URLSearchParams(searchParams || '');
        newParams.delete('depositMode');
        newParams.delete('itemId');
        newParams.delete('txId');
        newParams.delete('plan');
        newParams.set('section', 'portfolio');
        
        setTimeout(() => {
          router.replace(`/dashboard?${newParams.toString()}`, { scroll: false });
        }, 100);
      };
      
      if (!companeonNFTData && !isNFTLoading) {
        setTimeout(initiateDepositMode, 100);
      } else {
        initiateDepositMode();
      }
    }
  }, [searchParams, companeonNFTData, isNFTLoading, isTokenSelectionMode, handleStartCoinSelection]);

  const handleViewItem = (tokenId: string, hashedTransactionId?: string, forceRefresh = false) => {

    let correspondingItem = null;
    if (companeonNFTData) {

      let nftsArray: any[] = [];
      if (Array.isArray(companeonNFTData)) {
        nftsArray = companeonNFTData;
      } else if (companeonNFTData.nfts && Array.isArray(companeonNFTData.nfts)) {
        nftsArray = companeonNFTData.nfts;
      } else if (typeof companeonNFTData === 'object') {
        nftsArray = Object.values(companeonNFTData).filter(item => !!item);
      }
      
      correspondingItem = nftsArray.find((nft: any) => {
        if (hashedTransactionId && nft.hashedTransactionId === hashedTransactionId) {
          return true;
        }
        if (nft.tokenId === tokenId) {
          return true;
        }
        return false;
        });
      }
    
    const contextData = {
      selectedNFTItem: correspondingItem,
      selectedTokenId: tokenId,
      selectedHashedTransactionId: hashedTransactionId,
      contractAddress: companeonContractAddress,
      totalValue: totalValue || '0'
    };
    
    const event = new CustomEvent('companeon:start', {
      detail: contextData
    });
    window.dispatchEvent(event);
  };

  const handleCloseDetailView = async () => {
    setShowDetailView(false);
    setSelectedTokenId(null);
    setSelectedHashedTransactionId(null);
    
    setShowNFTDetails(false);
    setSelectedNFTItem(null);
    setTotalValue('0');
    
    setShowPortfolioDetailView(false);
    setPortfolioContents(null);
    setPortfolioTokenPrices(null);

    try {
      await queryClient.invalidateQueries({ queryKey: ['tokenData'] });
      await queryClient.invalidateQueries({ queryKey: ['nftData'] });
      await queryClient.invalidateQueries({ queryKey: ['companeonNftData'] });
      } catch (error) {
      }
  };

  const isNFTSelected = (nft: any) => {

    const uniqueKey = nft.contract && nft.tokenId 
      ? `${typeof nft.contract === 'string' ? nft.contract.toLowerCase() : nft.contract.address.toLowerCase()}-${nft.tokenId}` 
      : nft.tokenId || '';
    return selectedNFTs.has(uniqueKey);
  };

  const isSelectionLimitReached = false;

  useEffect(() => {
    if (!isTokenSelectionMode) {
      setIsDepositingMode(false);
    }
  }, [isTokenSelectionMode]);

  useEffect(() => {
    if (showPortfolioDetailView) {
      if (isTokenSelectionMode) {
        handleCancelSelection();
      }
    }
  }, [showPortfolioDetailView, isTokenSelectionMode]);

  const handleDepositMoreAssets = () => {
    if (selectedNFTItem?.hashedTransactionId) {
      handleStartCoinSelection(selectedNFTItem.hashedTransactionId);
    }
  };

  // Withdraw selection removed


  useEffect(() => {
    if (!isConnected) {
      if (showAgentPermissions) {
        setShowAgentPermissions(false);
      }
    }
  }, [isConnected, showAgentPermissions]);

  // Withdraw handlers removed

  const handleShowDepositInterface = () => {
    // Flip left side into Agent permissions view using selected assets
    if (!(selectedNFTs.size > 0 || selectedTokens.size > 0)) return;

    const agentAssets: AgentAsset[] = [];

    // Include native ETH if selected
    if (selectedTokens.has('native')) {
      agentAssets.push({
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x0000000000000000000000000000000000000000',
        logo: '/logos/eth-logo.png',
        isSelected: true,
        amount: tokenData?.eth?.balance || '0'
      });
    }

    // Include ERC-20 tokens
    Array.from(selectedTokens)
      .filter(id => id !== 'native')
      .forEach(identifier => {
        const token = tokenData?.tokens?.find((t: any) => t.contract?.toLowerCase() === String(identifier).toLowerCase());
        if (token) {
          agentAssets.push({
            symbol: token.symbol,
            name: token.name || token.symbol,
            address: token.contract,
            logo: token.logo || `/logos/${token.symbol?.toLowerCase?.() || 'token'}-logo.png`,
            isSelected: true,
            amount: token.balance || '0'
          });
        }
      });

    // NFTs are not part of agent flow yet; ignored here

    setAgentSelectedAssets(agentAssets);
    setShowAgentPermissions(true);
    setShowAssistantChat(false);

    setIsTokenSelectionMode(false);
    setSelectedTokens(new Set());
    setSelectedNFTs(new Set());
  };

  const handleStartTokenSelection = (token: { symbol: string; contract?: string; balance: string }) => {
    setIsTokenSelectionMode(true);
    setIsDepositingMode(false);
    setCurrentHashedTransactionId(null);
    setIsCreateModeOnly(false);
    
    handleTokenSelect(token);
  };

  const handleStartNFTSelection = (nft: any) => {
    setIsTokenSelectionMode(true);
    setIsDepositingMode(false);
    setCurrentHashedTransactionId(null);
    setIsCreateModeOnly(false);
    
    handleNFTSelect(nft);
  };

  // Legacy contents fetching removed

  const WalletButton = () => {
    if (!isConnected || !address) {
      return null;
    }

    const directAuthCheck = isConnected;

    return (
      <div className="relative group" ref={dropdownRef}>
        <button className="flex items-center gap-2 pl-4 pr-0 py-2 rounded-[20px] relative">
          <Image src="/icons/wallet-address-icon.png" alt="Wallet Address" className="w-6 h-6" width={24} height={24} />
          <span className="text-black">{shortenAddress(address)}</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 stroke-black group-hover:rotate-180`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Invisible extension to prevent hover gap */}
        <div className="absolute h-8 w-full"></div>

        <div className="absolute right-0 top-[calc(100%+0.25rem)] w-[155px] bg-white rounded shadow-[0_0_10px_rgba(0,0,0,0.1)] z-50 hidden group-hover:block py-3">
          {directAuthCheck ? (
            <button
              onClick={() => setShowDisconnectModal(true)}
              className="w-full text-left px-5 py-2 text-base text-red-600 hover:bg-gray-100 flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Disconnect
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full text-left px-5 py-2 text-base text-gray-700 hover:bg-gray-100 flex items-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Authenticate
              </button>
              <button
                onClick={() => setShowDisconnectModal(true)}
                className="w-full text-left px-5 py-2 text-base text-red-600 hover:bg-gray-100 flex items-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleDisconnectConfirm = async () => {
    try {

      try {
        sessionStorage.setItem('companeon_prevent_auto_connect', 'true');
        sessionStorage.setItem('companeon_user_disconnected', 'true');
        localStorage.setItem('companeon_prevent_auto_connect', 'true');
        localStorage.setItem('companeon_user_disconnected', 'true');
        localStorage.setItem('last_disconnect_time', Date.now().toString());
      } catch (e) {

      }
      
      setShowDisconnectModal(false);
    } catch (error) {
      }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setIsAuthenticated(true);
  };

  const handleAuthDeclined = () => {
    setShowAuthModal(false);
  };

  useEffect(() => {
    const handleWalletConnected = () => {
      setIsAuthenticated(prev => prev);
    };

    const handleWalletDisconnected = () => {
      setIsAuthenticated(false);
    };

    const handleAddressChanged = () => {
      setIsAuthenticated(prev => prev);
    };

    window.addEventListener('wallet:connected', handleWalletConnected);
    window.addEventListener('wallet:disconnected', handleWalletDisconnected);
    window.addEventListener('wallet:address:changed', handleAddressChanged);

    return () => {
      window.removeEventListener('wallet:connected', handleWalletConnected);
      window.removeEventListener('wallet:disconnected', handleWalletDisconnected);
      window.removeEventListener('wallet:address:changed', handleAddressChanged);
    };
  }, []);

  const handleSelectMoreAssetsForDeposit = () => {
    if (selectedNFTItem?.hashedTransactionId) {
      handleStartCoinSelection(selectedNFTItem.hashedTransactionId, selectedNFTItem.tokenId, parseFloat(totalValue || '0'));
    } else if (selectedTokenId) {
      handleStartCoinSelection('', selectedTokenId, parseFloat(totalValue || '0'));
    }
  };

  const hasNFTs = useMemo(() => {
    if (!companeonNFTData) return false;
    
    let nftsArray: any[] = [];
    if (Array.isArray(companeonNFTData)) {
      nftsArray = companeonNFTData;
    } else if (companeonNFTData.nfts && Array.isArray(companeonNFTData.nfts)) {
      nftsArray = companeonNFTData.nfts;
    } else if (typeof companeonNFTData === 'object') {
      nftsArray = Object.values(companeonNFTData).filter(item => !!item);
    }
    
    return nftsArray.length > 0;
  }, [companeonNFTData]);

  // Withdraw selection mode removed

  return (
    <div className="h-full flex flex-col bg-white lg:overflow-hidden relative">
      {/* Banner Section */}
      <div className="relative flex-shrink-0">
        {/* Banner Background - larger area */}
        <div className="h-[272px] bg-gradient-to-b from-purple-100 to-purple-200"></div>

        {/* Content Overlay */}
        <div className="absolute top-0 left-0 right-0 h-full px-6">
          {/* Wallet button - top right */}
          <div className="flex justify-end pt-6">
            <WalletButton />
          </div>

          {/* Bottom bar with title and stats */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
            <div className="flex items-end justify-between">
              {/* Left side - Portfolio Title */}
              <div className="flex flex-col">
                <h1 className="text-[32px] font-medium text-gray-900 mb-4">Portfolio</h1>

                {/* Stats Row - positioned on the left under title */}
                <div className="inline-flex items-center bg-white rounded-2xl px-6 py-4 divide-x divide-gray-200">
                  {/* Portfolio Stats */}
                  {/* Portfolio Value */}
                  <div className="flex flex-col px-6 first:pl-0">
                    <span className="text-xs text-gray-600 uppercase tracking-wide mb-1">Portfolio Value</span>
                    <span className="text-base font-medium text-gray-900">
                      ${portfolioSummary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* ETH Balance */}
                  <div className="flex flex-col px-6">
                    <span className="text-xs text-gray-600 uppercase tracking-wide mb-1">ETH Balance</span>
                    <span className="text-base font-medium text-gray-900">
                      {portfolioSummary.ethBalance.toFixed(4)} ETH
                    </span>
                  </div>

                  {/* Tokens */}
                  <div className="flex flex-col px-6 last:pr-0">
                    <span className="text-xs text-gray-600 uppercase tracking-wide mb-1">Tokens</span>
                    <span className="text-base font-medium text-gray-900">
                      {portfolioSummary.assets.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Main content area with two columns */}
      <div className="flex-1 flex lg:flex-row flex-col overflow-hidden relative">
        {/* Left Column - Main Content - Now scrollable */}
        <div
          className={`lg:order-1 order-2 flex flex-col min-h-0 overflow-y-auto relative flex-1 lg:mr-[500px] lg:z-0 ${isTokenSelectionMode ? 'pb-24' : 'pb-6'}`}
        >
              {/* Get Started Section - always show (banners are dismissible) */}
              <div className="lg:px-6 px-4">
                <GetStartedSection
                  onStartCoinSelection={() => {
                    setIsTokenSelectionMode(true);
                    setIsDepositingMode(true);
                  }}
                  isSelectionMode={isTokenSelectionMode}
                  isWalletConnected={isConnected}
                />
              </div>

              {/* Your Permissions Section */}
              <PermissionList
                walletLimits={walletLimits}
                fetchWalletLimits={fetchWalletLimits}
                isConnected={isConnected}
              />

              {/* Your Crypto Header */}
              <div className="pt-6 lg:px-6 px-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Your Crypto</h2>
              </div>

              {/* Content Area */}
              <div className={`flex-1 lg:px-6 px-4 relative z-0`}>
                <CryptoBalance
                  tokenData={isConnected ? tokenData || null : null}
                  isTokenLoading={isTokenLoading && isConnected}
                  isSelectionMode={isTokenSelectionMode}
                  onTokenSelect={handleTokenSelect}
                  selectedTokens={selectedTokens}
                  isSelectionLimitReached={isSelectionLimitReached}
                  onStartSelection={handleStartTokenSelection}
                  disabledSelection={false}
                />
              </div>
        </div>

        {/* Right Column - Chat (absolutely positioned on right, expands leftward) */}
        <div
          className={`lg:order-2 order-1 border-t border-gray-200 overflow-y-auto lg:border-t-0 bg-white lg:absolute lg:inset-y-0 lg:right-0 lg:border-l transition-[width] duration-300 ease-in-out ${
            isChatExpanded
              ? 'lg:w-full lg:z-40 lg:border-l-0'
              : 'lg:w-[500px] w-full lg:z-20'
          }`}
        >
          <CompaneonChatInterface
            contextData={{
              totalValue: totalPortfolioValue.toFixed(2),
              assets: assistantAssetsForChat,
              userAddress: address || undefined,
            }}
            onBack={() => {}}
            autoConnect={false}
            isExpanded={isChatExpanded}
            onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
          />
        </div>
      </div>
      
      {/* Selection Mode Floating Box */}
      {isTokenSelectionMode && (selectedNFTs.size + selectedTokens.size > 0) && (
        <div
          className="fixed left-1/2 transform -translate-x-1/2 z-50 px-2 sm:px-0 pointer-events-auto"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 px-6 py-3 w-[600px]">
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-8 lg:gap-12 md:justify-between">
              {/* Selection count */}
              <span className="text-sm text-gray-700 font-medium whitespace-nowrap text-center md:text-left">
                {`${selectedNFTs.size + selectedTokens.size} asset${selectedNFTs.size + selectedTokens.size !== 1 ? 's' : ''} selected`}
              </span>

              {/* Action buttons */}
              <div className="flex items-center gap-3 justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="px-5 py-2 rounded-[4px] text-sm font-medium bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 transition-all whitespace-nowrap cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShowDepositInterface}
                  disabled={selectedNFTs.size === 0 && selectedTokens.size === 0}
                  className={`px-6 py-2 rounded-[4px] text-sm font-medium whitespace-nowrap border-2 ${
                    selectedNFTs.size > 0 || selectedTokens.size > 0
                      ? 'bg-[#AD29FF] text-white hover:opacity-90 border-[#AD29FF]'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200'
                  } transition-all`}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        onCancel={handleAuthDeclined}
        refreshOnSuccess={true}
      />
      
      {/* DisconnectConfirmModal */}
      <DisconnectConfirmModal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
      />

      {/* Agent Permissions Bottom Sheet */}
      {showAgentPermissions && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-end"
          onClick={handleCloseAgentPermissions}
        >
          <div
            className={`bg-white rounded-t-2xl shadow-xl w-full flex flex-col overflow-hidden ${
              isAgentPermissionsClosing ? 'animate-slide-down' : 'animate-slide-up'
            }`}
            style={{ height: '70vh' }}
            onClick={(e) => e.stopPropagation()}
            onAnimationEnd={(e) => {
              // Only handle the slide-down animation end
              if (e.animationName === 'slideDown') {
                setShowAgentPermissions(false);
                setIsAgentPermissionsClosing(false);
              }
            }}
          >
            <AgentPermissionsView
              selectedAssets={agentSelectedAssets}
              onComplete={handleAgentPermissionsComplete}
              onCancel={handleCloseAgentPermissions}
            />
          </div>
        </div>
      )}

    </div>
  );
} 
