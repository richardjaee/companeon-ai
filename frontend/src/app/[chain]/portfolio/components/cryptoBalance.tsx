'use client';

import { useRouter } from 'next/navigation';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { useChain } from '@/hooks/useChain';
import TokenList from '@/components/TokenList/TokenList';
import { TokenInfo, getSupportedTokens, isTokenSupported, getTokensForChain } from '@/lib/constants/tokens';

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

interface TokenData {
  eth?: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
  };
  sol?: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    logo?: string;
    solana?: SolanaProgramData;
  };
  tokens: Array<{
    contract: string;
    symbol: string;
    name: string;
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    logo?: string;
    decimals?: number;
    userTokenAccount?: string;
    solana?: SolanaTokenData;
  }>;
  addressType?: 'ethereum' | 'solana';
}

interface CryptoBalanceProps {
  tokenData: TokenData | null;
  isTokenLoading: boolean;
  isSelectionMode?: boolean;
  onTokenSelect?: (token: { symbol: string; contract?: string; balance: string }) => void;
  selectedTokens?: Set<string>;
  sortBy?: 'value' | 'name' | 'symbol';
  sortDirection?: 'asc' | 'desc';
  isSelectionLimitReached?: boolean;
  onStartSelection?: (token: { symbol: string; contract?: string; balance: string }) => void;
  disabledSelection?: boolean;
}

export default function CryptoBalance({
  tokenData,
  isTokenLoading,
  isSelectionMode = false,
  onTokenSelect,
  selectedTokens = new Set(),
  sortBy = 'value',
  sortDirection = 'desc',
  isSelectionLimitReached = false,
  onStartSelection,
  disabledSelection = false
}: CryptoBalanceProps) {
  const router = useRouter();
  const { chainType: walletChainType } = useUnifiedWallet();
  const { chain } = useChain(); // Get current chain from URL

  const chainType = tokenData?.addressType || walletChainType;

  // Get supported tokens for the current chain
  const SUPPORTED_TOKENS = chainType === 'ethereum'
    ? Object.entries(getTokensForChain(chain)).map(([address, data]) => ({
        contractAddress: address,
        symbol: data.symbol,
        name: data.name,
        decimals: data.decimals,
        logoPath: `/logos/${data.symbol.toLowerCase()}-logo.png`
      }))
    : getSupportedTokens();

  if (tokenData?.sol) {
    }

  if (tokenData?.tokens) {
    }

  const firstToken = tokenData?.tokens?.[0];
  if (firstToken) {
    if (chainType === 'solana' && firstToken.solana) {
      }
  }

  const processedTokens = tokenData?.tokens
    ? tokenData.tokens
      .filter(token => {

        if (chainType === 'ethereum') {
          const isSupported = isTokenSupported(token.contract, chain);

          return token.contract &&
                 isSupported &&  // Pass chain parameter
                 token.contract.toLowerCase() !== 'native' &&
                 Number(token.balance) > 0;
        }

        const isValidSolana = token.contract &&
                              token.symbol &&
                              token.symbol !== 'UNKNOWN';

        return isValidSolana;
      })
      .map(token => {

        if (chainType === 'ethereum') {
          if (!token.contract) {
            return null;
          }
          
          const tokenInfo = SUPPORTED_TOKENS.find(t => t.contractAddress.toLowerCase() === token.contract!.toLowerCase());
          if (!tokenInfo) {
            return null;
          }
          
          const truncatedBalance = Number(token.balance).toFixed(8).replace(/\.?0+$/, '');
          
          return {
            contract: token.contract,
            symbol: tokenInfo.symbol,
            name: token.name || tokenInfo.name,
            balance: truncatedBalance,
            priceInUSD: token.priceInUSD || 0,
            totalValueInUSD: token.totalValueInUSD?.toString() || '0',
            logo: token.logo || tokenInfo.logoPath,
            isSelected: selectedTokens.has(token.contract)
          } as Token;
        } else {

          const truncatedBalance = Number(token.balance).toFixed(8).replace(/\.?0+$/, '');
          
          const processedToken = {
            contract: token.contract,
            symbol: token.symbol,
            name: token.name,
            balance: truncatedBalance,
            priceInUSD: token.priceInUSD || 0,
            totalValueInUSD: token.totalValueInUSD?.toString() || '0',
            logo: token.logo,
            isSelected: selectedTokens.has(token.contract),
            solana: token.solana ? {
              mintAddress: token.solana.mintAddress,
              userTokenAccount: token.solana.userTokenAccount,
              decimals: token.solana.decimals,
              rawBalance: token.solana.rawBalance,
              programAddresses: token.solana.programAddresses
            } : {
              mintAddress: token.contract,
              userTokenAccount: token.userTokenAccount || '',
              decimals: token.decimals || 9,
              rawBalance: token.balance,
              programAddresses: undefined
            }
          } as Token;

          return processedToken;
        }
      })
      .filter((token): token is Token => token !== null)
      .sort((a, b) => {
        const direction = sortDirection === 'asc' ? -1 : 1;
        
        if (sortBy === 'value') {
          const aValue = parseFloat(a.totalValueInUSD);
          const bValue = parseFloat(b.totalValueInUSD);
          return direction * (bValue - aValue);
        } else if (sortBy === 'symbol') {
          return direction * a.symbol.localeCompare(b.symbol);
        } else {
          return direction * a.name.localeCompare(b.name);
        }
      }) : [];

  const nativeTokenData = chainType === 'ethereum' ? tokenData?.eth : tokenData?.sol;
  const nativeBalanceToPass = nativeTokenData && Number(nativeTokenData.balance) > 0 ? {
    balance: Number(nativeTokenData.balance).toFixed(8).replace(/\.?0+$/, ''),
    priceInUSD: nativeTokenData.priceInUSD || 0,
    totalValueInUSD: nativeTokenData.totalValueInUSD?.toString() || '0',
    isSelected: selectedTokens.has('native'),
    solana: chainType === 'solana' ? tokenData?.sol?.solana : undefined
  } : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto -mt-2">
        {isTokenLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 p-4 -ml-4">
            {[...Array(6)].map((_, index) => (
              <div 
                key={index} 
                className="bg-white rounded-lg shadow-sm p-4"
              >
                <div className="flex flex-col">
                  {/* Token name and ticker */}
                  <div className="flex items-start">
                    {/* Token name and ticker */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mt-1"></div>
                      </div>
                    </div>
                    
                    {/* Token logo - top right aligned */}
                    <div className="ml-4 flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Bottom row with balance and USD value */}
                  <div className="flex justify-between items-center mt-4">
                    <div className="h-5 bg-gray-200 rounded w-20 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !tokenData || (processedTokens.length === 0 && !nativeBalanceToPass) ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No compatible assets found</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                We couldn't find any supported crypto assets in your wallet. Try connecting a different wallet or deposit supported tokens.
              </p>
            </div>
          </div>
        ) : (
          <div className="pt-0">
            <TokenList
              tokens={processedTokens}
              ethBalance={nativeBalanceToPass}
              hideScrollText={true}
              showDividers={true}
              sortBy={sortBy}
              sortDirection={sortDirection}
              isSelectionMode={isSelectionMode}
              onTokenSelect={onTokenSelect}
              selectedTokens={selectedTokens}
              isSelectionLimitReached={isSelectionLimitReached}
              onStartSelection={onStartSelection}
              disabledSelection={disabledSelection}
            />
          </div>
        )}
      </div>
    </div>
  );
}
