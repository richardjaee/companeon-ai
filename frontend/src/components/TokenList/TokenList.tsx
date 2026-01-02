import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface SolanaTokenData {
  mintAddress: string;
  userTokenAccount: string;
  decimals: number;
  rawBalance: string;
  programAddresses: {
    vaultSeeds: {
      prefix: string;
      mintAddress: string;
    };
  };
}

interface SolanaProgramData {
  ownerAddress: string;
  programIds: {
    mainProgram: string;
    sbtProgram: string;
  };
  pdaDerivation: {
    programSeeds: {
      prefix: string;
      owner: string;
    };
    sbtStateSeeds: {
      prefix: string;
    };
  };
  standardPrograms: {
    tokenProgram: string;
    associatedTokenProgram: string;
    systemProgram: string;
    rent: string;
  };
}

interface Token {
  contract: string;
  symbol: string;
  name: string;
  balance: string;
  priceInUSD: number;
  totalValueInUSD: string;
  logo?: string;
  isSelected?: boolean;
  solana?: SolanaTokenData;
}

interface TokenListProps {
  tokens: Token[];
  ethBalance: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    isSelected?: boolean;
    solana?: SolanaProgramData;
  } | null;
  hideScrollText?: boolean;
  showDividers?: boolean;
  sortBy?: 'value' | 'name' | 'symbol';
  sortDirection?: 'asc' | 'desc';
  isSelectionMode?: boolean;
  onTokenSelect?: (token: { 
    symbol: string; 
    contract?: string; 
    balance: string;
    solana?: SolanaTokenData | SolanaProgramData;
  }) => void;
  selectedTokens?: Set<string>;
  isSelectionLimitReached?: boolean;
  onStartSelection?: (token: { 
    symbol: string; 
    contract?: string; 
    balance: string;
    solana?: SolanaTokenData | SolanaProgramData;
  }) => void;
  disabledSelection?: boolean;
}

export default function TokenList({ 
  tokens, 
  ethBalance, 
  hideScrollText = false, 
  showDividers = false,
  sortBy = 'value',
  sortDirection = 'desc',
  isSelectionMode = false,
  onTokenSelect,
  selectedTokens = new Set(),
  isSelectionLimitReached = false,
  onStartSelection,
  disabledSelection = false
}: TokenListProps) {
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [flashingTokens, setFlashingTokens] = useState<Record<string, 'increase' | 'decrease'>>({});
  const previousBalancesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setHoveredToken(null);
  }, [isSelectionMode]);

  const allTokens = [

    ethBalance ? {
      symbol: ethBalance.solana ? 'SOL' : 'ETH',
      name: ethBalance.solana ? 'Solana' : 'Ethereum',
      balance: ethBalance.balance,
      totalValueInUSD: ethBalance.totalValueInUSD,
      logo: ethBalance.solana ? '/logos/sol-logo.png' : '/logos/eth-logo.png',
      contract: 'native',
      isSelected: ethBalance.isSelected,
      solana: ethBalance.solana
    } as Token : null,
    ...tokens.filter(token => {
      const symbol = token.symbol.toUpperCase();
      return symbol !== 'ETH' && symbol !== 'SOL';
    })
  ].filter((token): token is Token => token !== null);

  const sortedTokens = [...allTokens].sort((a, b) => {
    if (!a || !b) return 0;

    const direction = sortDirection === 'asc' ? -1 : 1;

    switch (sortBy) {
      case 'value':
        const aValue = parseFloat(a.totalValueInUSD);
        const bValue = parseFloat(b.totalValueInUSD);
        return direction * (bValue - aValue);
      case 'symbol':
        return direction * a.symbol.localeCompare(b.symbol);
      case 'name':
      default:
        return direction * a.name.localeCompare(b.name);
    }
  });

  // Detect balance changes and trigger flash effects
  useEffect(() => {
    sortedTokens.forEach(token => {
      const tokenKey = token.contract;
      const currentBalance = token.balance;
      const previousBalance = previousBalancesRef.current[tokenKey];

      if (previousBalance && previousBalance !== currentBalance) {
        const current = parseFloat(currentBalance);
        const previous = parseFloat(previousBalance);

        if (!isNaN(current) && !isNaN(previous) && current !== previous) {
          const changeType = current > previous ? 'increase' : 'decrease';

          // Set flash effect
          setFlashingTokens(prev => ({
            ...prev,
            [tokenKey]: changeType
          }));

          // Remove flash effect after 1 second
          setTimeout(() => {
            setFlashingTokens(prev => {
              const newState = { ...prev };
              delete newState[tokenKey];
              return newState;
            });
          }, 1000);
        }
      }

      // Update previous balance
      previousBalancesRef.current[tokenKey] = currentBalance;
    });
  }, [sortedTokens]);

  const handleTokenClick = (token: Token) => {
    if (disabledSelection) {
      return;
    }

    if (isSelectionMode && onTokenSelect) {

      if (!isSelectionLimitReached || token.isSelected) {
        onTokenSelect({
          symbol: token.symbol,
          contract: token.contract,
          balance: token.balance,
          solana: token.solana
        });
      }
    } else if (!isSelectionMode && onStartSelection) {

      onStartSelection({
        symbol: token.symbol,
        contract: token.contract,
        balance: token.balance,
        solana: token.solana
      });
    }
  };

  const handleMouseEnter = (tokenContract: string) => {
    if (!disabledSelection) {
      setHoveredToken(tokenContract);
    }
  };

  const handleMouseLeave = () => {
    setHoveredToken(null);
  };

  return (
    <div className="w-full">
      {/* Grid layout for tokens - responsive: 1 item on mobile, 2 on medium screens, 3 on xl screens (1280px+) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 pl-0 pr-4 py-4">
        {sortedTokens.map((token, index) => (
          <div key={token.symbol || index} className="relative p-[2px]">
            <div
              className={`bg-gray-50 rounded-[16px] shadow-sm pt-4 px-4 pb-3 transition-all duration-300 ease-in-out ${
                disabledSelection
                  ? 'cursor-not-allowed opacity-60 bg-gray-200'
                  : 'cursor-pointer hover:bg-gray-100'
              } ${
                isSelectionMode && token.isSelected ? 'outline outline-2 outline-[#AD29FF] outline-offset-0' : ''
              } ${
                !isSelectionMode && hoveredToken === token.contract && !disabledSelection ? 'outline outline-2 outline-[#AD29FF] outline-offset-0' : ''
              } ${
                isSelectionMode && isSelectionLimitReached && !token.isSelected ? 'cursor-not-allowed opacity-75' : ''
              }`}
              onClick={() => handleTokenClick(token)}
              onMouseEnter={() => handleMouseEnter(token.contract)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="flex">
                {/* Main content area */}
                <div className="flex-1 flex flex-col">
                  {/* Top row with logo, ticker/name, and selection indicator */}
                  <div className="flex items-start justify-between">
                    {/* Left: Logo and token name/ticker */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Token logo */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden">
                          <Image
                            src={token.logo || `/logos/${token.symbol.toLowerCase()}-logo.png`}
                            alt={token.symbol}
                            width={32}
                            height={32}
                            className={`w-full h-full object-cover ${token.symbol === 'SHIB' ? 'scale-125' : ''}`}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('/logos/')) {
                                target.src = `/logos/${token.symbol.toLowerCase()}-logo.png`;
                              }
                            }}
                          />
                        </div>
                      </div>
                      {/* Token name and ticker */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col">
                          <span
                            className="text-base font-semibold leading-tight truncate"
                            title={token.symbol}
                          >
                            {token.symbol}
                          </span>
                          <span
                            className="text-sm text-gray-600 leading-tight truncate mt-1"
                            title={token.name}
                          >
                            {token.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Selection indicator when hovering or when selected */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0 ${
                        hoveredToken === token.contract || token.isSelected
                          ? 'w-6 opacity-100 ml-2'
                          : 'w-0 opacity-0 ml-0'
                      }`}
                    >
                      <div className="w-6 h-6 transition-all duration-300 ease-in-out">
                        {token.isSelected ? (
                          <div className="w-6 h-6 bg-[#AD29FF] rounded-full flex items-center justify-center transform transition-transform duration-300 ease-in-out scale-100">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : !isSelectionLimitReached ? (
                          <div className="w-6 h-6 border-2 border-[#AD29FF] rounded-full flex items-center justify-center transform transition-transform duration-300 ease-in-out scale-100">
                            <svg className="w-4 h-4 text-[#AD29FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-gray-300 rounded-full flex items-center justify-center transform transition-transform duration-300 ease-in-out scale-100">
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Bottom row with balance and USD value - aligned with token text */}
                  <div className="flex items-baseline mt-4 ml-11">
                    <span
                      className={`text-xl font-semibold mr-1.5 transition-colors duration-1000 ${
                        flashingTokens[token.contract] === 'decrease'
                          ? 'text-red-600'
                          : flashingTokens[token.contract] === 'increase'
                          ? 'text-green-600'
                          : 'text-black'
                      }`}
                      title={token.balance}
                    >
                      {token.balance}
                    </span>
                    <span className="text-sm text-black">(${Number(token.totalValueInUSD).toFixed(2)})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!hideScrollText && sortedTokens.length > 6 && (
        <div className="text-base text-gray-500 text-center mt-4">
          Scroll to see more tokens
        </div>
      )}
    </div>
  );
}
