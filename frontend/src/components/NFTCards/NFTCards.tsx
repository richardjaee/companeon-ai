import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useChain } from '@/hooks/useChain';
import { nftApi } from '@/lib/api/nft';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
interface NFTCardsProps {
  asset: any;
  onClick?: () => void;
  itemData?: any;
  enableHover?: boolean;
  isUnredeemed?: boolean;
  selectedNFT?: any;
  isLoading?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelect?: (asset: any) => void;
  isSpecialSection?: boolean;
  filterContractAddress?: string | null;
  isSelectionLimitReached?: boolean;
  onStartSelection?: (asset: any) => void;
  disabledSelection?: boolean;
}

const planIcons = {
  'Basic': '🥉',
  'Standard': '🥈',
  'Advanced': '🥇'
};

const formatValue = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatEstValue = (value: number) => {
  if (typeof value !== 'number' || isNaN(value)) return '~$0.00';
  return `~$${value.toLocaleString(undefined, { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  })}`;
};

export default function NFTCards({ 
  asset, 
  onClick, 
  itemData, 
  enableHover = false, 
  isUnredeemed = false, 
  selectedNFT,
  isLoading = false,
  isSelected = false,
  isSelectionMode = false,
  onSelect,
  isSpecialSection = false,
  filterContractAddress = null,
  isSelectionLimitReached = false,
  onStartSelection,
  disabledSelection = false
}: NFTCardsProps) {
  const [imageError, setImageError] = useState(false);
  const [floorPrice, setFloorPrice] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { address } = useWallet();
  const { config } = useChain();
  const router = useRouter();
  
  const isFilteredContract = filterContractAddress && asset?.contract?.toLowerCase() === filterContractAddress.toLowerCase();

  const isUnredeemedSpecial = isUnredeemed || (
    isFilteredContract && 
    asset?.tokenId && 
    typeof asset.tokenId === 'string' && 
    asset.tokenId.startsWith('unredeemed-')
  );

  const getImageUrl = () => {
    if (imageError && isUnredeemed) return '/placeholder-nft.png';
    if (!asset?.metadata) return '/placeholder-nft.png';
    
    const rawUrl = asset.metadata.image || asset.metadata.image_url;
    if (!rawUrl) return '/placeholder-nft.png';

    if (rawUrl.startsWith('ipfs://')) {
      return rawUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    return rawUrl;
  };

  const imageUrl = getImageUrl();
  
  const getTokenId = () => {
    if (!asset) return '';
    return asset.tokenId || asset.numericTokenId || '';
  };

  useEffect(() => {
    const fetchFloorPrice = async () => {

      if (!asset?.contract || !address) return;
      try {
        const metadata = await nftApi.getNFTMetadata(
          asset.contract,
          asset.tokenId,
          address,
          config.chainId
        );
        if (metadata.success && metadata.floorPriceUSD) {
          setFloorPrice(metadata.floorPriceUSD);
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    fetchFloorPrice();
  }, [asset?.contract, asset?.tokenId, address, isFilteredContract]);

  const handleClick = (e: React.MouseEvent) => {
    if (disabledSelection) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isSelectionMode) {

      e.preventDefault();
      e.stopPropagation();
      
      if (onSelect) {
        onSelect(asset);
      }
      return;
    }

    if (!isSelectionMode && onStartSelection && !isFilteredContract) {
      e.preventDefault();
      e.stopPropagation();
      onStartSelection(asset);
      return;
    }

    if (onClick) {
      onClick();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (disabledSelection) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    if (isSelectionMode) {

      if (onSelect && (!isSelectionLimitReached || isSelected)) {
      onSelect(asset);
      }
    } else if (onStartSelection && !isFilteredContract) {

      onStartSelection(asset);
    }
  };

  const handleMouseEnter = () => {
    if (!isSelectionMode && !isFilteredContract && !disabledSelection) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isSelectionMode && !isFilteredContract && !disabledSelection) {
      setIsHovered(false);
    }
  };

  if (isFilteredContract && !isSpecialSection) {
    return null;
  }

  return (
    <div 
      className={`relative w-full transition-all duration-200 ${
        isSelected 
          ? 'border-2 border-[#AD29FF] rounded-[8px] z-30 overflow-hidden' 
          : !isSelectionMode && isHovered && !isFilteredContract 
            ? 'border-2 border-[#AD29FF] rounded-[8px] overflow-hidden'
            : 'border-2 border-gray-200 rounded-[8px] overflow-hidden'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Selection overlay - positioned to match the exact card boundaries */}
      {(isSelectionMode || (!isSelectionMode && isHovered && !isFilteredContract)) && !disabledSelection && (
        <div 
          className={`absolute inset-0 z-10 rounded-[8px] transition-colors duration-200 ${
            disabledSelection 
              ? 'cursor-not-allowed' 
              : isSelected ? 'cursor-pointer' : isSelectionLimitReached ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={handleOverlayClick}
        >
          {!isSelected && !isSelectionLimitReached && (
            <div className="absolute top-2 left-2">
              <div className="w-6 h-6 border-2 border-[#AD29FF] rounded-full flex items-center justify-center bg-white">
                <svg className="w-4 h-4 text-[#AD29FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          )}
          {!isSelected && isSelectionLimitReached && (
            <div className="absolute top-2 left-2">
              <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center bg-white">
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
          )}
          {isSelected && (
            <div className="absolute top-2 left-2">
              <div className="w-6 h-6 bg-[#AD29FF] rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hover overlay - only show when not in selection mode */}
      {enableHover && !isSelectionMode && (
        <div className={`absolute inset-0 opacity-0 hover:opacity-50 transition-opacity duration-200 rounded-[8px]`} />
      )}

      <div 
        onClick={handleClick}
        className={`relative ${
          disabledSelection 
            ? 'cursor-not-allowed opacity-60' 
            : (isFilteredContract || isUnredeemedSpecial || isSelectionMode || (!isSelectionMode && !isFilteredContract)) ? 'cursor-pointer' : 'cursor-default'
        } ${selectedNFT?.tokenId === asset?.tokenId ? 'ring-2 ring-[#C9A7FB]' : ''} group`}
      >
        <div className="transition-shadow duration-200 hover:shadow-lg">
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-[8px]">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          )}
          
          <div className={`relative ${isLoading ? 'opacity-50' : ''}`}>
            {/* Hover overlay - only show if not in selection mode */}
            {(isFilteredContract || isUnredeemedSpecial) && !isSelectionMode && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center rounded-[8px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(e);
                  }}
                  className="px-6 py-2.5 bg-[#C9A7FB] text-black font-bold text-sm rounded-[20px] hover:bg-[#B48EF7] transition-colors"
                >
                  View Item
                </button>
              </div>
            )}
            <div className="relative aspect-square overflow-hidden" style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
              {isUnredeemedSpecial && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-[8px]">
                    New
                  </span>
                </div>
              )}
              
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={asset?.metadata?.name || 'NFT'}
                  fill
                  className="object-cover"
                  style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}
                  onError={() => setImageError(true)}
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center" style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                  <Image
                    src="/placeholder-nft.png"
                    alt={asset?.metadata?.name || 'NFT'}
                    fill
                    className="object-contain p-4"
                    style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}
                    unoptimized
                  />
                </div>
              )}
            </div>

            <div className={`h-[80px] p-3 bg-white rounded-b-[8px]`}>
              <div className="flex flex-col space-y-1">
                {(isFilteredContract || isUnredeemedSpecial) ? (

                  <>
                    <h3 className="text-base font-semibold truncate leading-tight">
                      {isUnredeemedSpecial ? "Item (New)" : `Item #${getTokenId()}`}
                    </h3>
                    
                    {(itemData?.plan || asset?.metadata?.name?.includes('Vault')) && (
                      <p className="text-base text-gray-600 leading-tight">
                        {isUnredeemedSpecial ? 
                          `${itemData?.plan || asset?.metadata?.name?.split(' ')[2] || 'Standard'} Plan ${planIcons[(itemData?.plan || asset?.metadata?.name?.split(' ')[2] || 'Standard') as keyof typeof planIcons] || ''}` :
                          `${itemData?.plan || asset?.metadata?.name?.split(' ')[2] || ''} Plan ${planIcons[(itemData?.plan || asset?.metadata?.name?.split(' ')[2] || '') as keyof typeof planIcons] || ''}`
                        }
                      </p>
                    )}

                    <p className="text-base text-gray-600 leading-tight">
                      {isUnredeemedSpecial ? (
                        `$0.00 / ${itemData?.plan === 'Basic' ? '$1,000' : itemData?.plan === 'Advanced' ? 'Unlimited' : '$10,000'}`
                      ) : (
                        `$0.00 / ${itemData?.plan === 'Basic' ? '$1,000' : itemData?.plan === 'Advanced' ? 'Unlimited' : '$10,000'}`
                      )}
                    </p>
                  </>
                ) : (

                  <>
                    <h3 className="text-base font-semibold truncate leading-none mb-0">
                      {!isFilteredContract && asset?.contract ? (
                        <a 
                          href={`https://basescan.org/address/${asset.contract}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {asset?.metadata?.name || 'NFT'}
                        </a>
                      ) : (
                        asset?.metadata?.name || 'NFT'
                      )}
                    </h3>
                    
                    <p className="text-base text-gray-600 leading-tight mt-0">
                      Token ID: {getTokenId()}
                    </p>

                    {isFilteredContract && (
                      <p className="text-base text-gray-600 leading-tight">
                        {floorPrice !== null ? formatEstValue(floorPrice) : '$0.00'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
