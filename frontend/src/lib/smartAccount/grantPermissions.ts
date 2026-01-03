import { apiClient } from '@/lib/api/apiClient';
import { detectSmartAccountImplementation } from '@/lib/smartAccount/router';
import { isMetaMaskFlask } from '@/lib/smartAccount/detectFlask';
import { createWalletClient, custom, parseUnits, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';

export interface PermissionScope {
  type: 'nativeTokenPeriodTransfer' | 'erc20PeriodTransfer';
  periodAmount: string;            // Amount in smallest unit (wei for ETH, token units for ERC-20)
  periodAmountFormatted: string;   // Human readable (e.g., "0.1 ETH", "10 USDC")
  periodDuration: number;          // Period reset time in seconds (86400 = daily)
  tokenAddress?: string;           // Token contract address (for ERC-20 only)
  tokenSymbol?: string;            // Token symbol (for ERC-20 only)
  decimals?: number;               // Token decimals (18 for ETH, 6 for USDC)
  expiresAt?: number;              // Per-token expiration timestamp (seconds since epoch)
  startTime?: number;              // Per-token start timestamp (seconds since epoch)
}

export interface PermissionProposal {
  walletAddress: string;
  chainId: number;
  scopes: PermissionScope[];
  expirationTimestamp: number;
  expirationDays: number;
}

export interface GrantPermissionsResult {
  smartAccountAddress: string;
  permissionsContext: string;
  delegationManager: string | null;
}

/**
 * Switch wallet to Sepolia network (required for ERC-7715)
 */
async function switchToSepolia(ethereum: any): Promise<void> {
  const currentChainId = await ethereum.request({ method: 'eth_chainId' });
  const currentChainNumber = parseInt(currentChainId, 16);

  if (currentChainNumber !== 11155111) {
    
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia
      });
      
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
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
}

/**
 * Convert PermissionScope to ERC-7715 format and grant permissions
 */
export async function grantERC7715Permissions(
  ethereum: any,
  walletAddress: string,
  scopes: PermissionScope[]
): Promise<GrantPermissionsResult> {
  // Step 1: Switch to Sepolia
  await switchToSepolia(ethereum);

  // Step 2: Check Flask
  const hasFlask = await isMetaMaskFlask(ethereum);
  if (!hasFlask) {
    
  } else {
    
  }

  // Step 3: Get backend delegation address
  const backendDelegationAddress = process.env.NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS;
  if (!backendDelegationAddress) {
    throw new Error('Backend delegation address not configured. Set NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS in environment variables.');
  }

  // Step 4: Create wallet client with ERC-7715 actions (using MetaMask Smart Accounts Kit)
  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(ethereum),
  }).extend(erc7715ProviderActions());

  // Step 5: Build ERC-7715 permissions array ()
  const currentTime = Math.floor(Date.now() / 1000);
  const expiry = currentTime + (30 * 24 * 60 * 60); // 30 days

  const erc7715Permissions: any[] = [];

  for (const scope of scopes) {
    if (scope.type === 'nativeTokenPeriodTransfer') {
      // Native ETH: periodAmount is in wei, convert to BigInt
      const periodAmountBigInt = BigInt(scope.periodAmount || '0');

      
      erc7715Permissions.push({
        chainId: 11155111, // Sepolia
        expiry,
        signer: {
          type: 'account' as const,
          data: { address: backendDelegationAddress as Address },
        },
        permission: {
          type: 'native-token-periodic' as const,
          data: {
            periodAmount: `0x${periodAmountBigInt.toString(16)}`, // Hex format
            periodDuration: scope.periodDuration || 86400,
            justification: 'AI agent autonomous wallet operations',
          },
        },
        isAdjustmentAllowed: true,
      });
    } else if (scope.type === 'erc20PeriodTransfer') {
      // ERC20: periodAmount is in smallest unit (e.g., USDC with 6 decimals)
      const periodAmountBigInt = BigInt(scope.periodAmount || '0');

      
      erc7715Permissions.push({
        chainId: 11155111, // Sepolia
        expiry,
        signer: {
          type: 'account' as const,
          data: { address: backendDelegationAddress as Address },
        },
        permission: {
          type: 'erc20-token-periodic' as const,
          data: {
            tokenAddress: scope.tokenAddress as Address,
            periodAmount: `0x${periodAmountBigInt.toString(16)}`, // Hex format
            periodDuration: scope.periodDuration || 86400,
            justification: 'AI agent autonomous wallet operations',
          },
        },
        isAdjustmentAllowed: true,
      });
    } else {
      throw new Error(`Unknown scope type: ${(scope as any).type}`);
    }
  }

  if (erc7715Permissions.length === 0) {
    throw new Error('No permissions to grant');
  }

  
  
  // Step 6: Request execution permissions (supports batching!)
  const grantedPermissions = await walletClient.requestExecutionPermissions(erc7715Permissions as any);

  
  if (!grantedPermissions || grantedPermissions.length === 0) {
    throw new Error('No permissions were granted');
  }

  // Step 7: Extract smart account address from result
  const firstPermission = grantedPermissions[0];
  const smartAccountAddress = (firstPermission.signerMeta?.userOpBuilder || walletAddress) as string;

  // Extract permissions context and delegation manager for redemption
  const permissionsContext = firstPermission.context;
  const delegationManager = firstPermission.signerMeta?.delegationManager || null;

  
  
  return {
    smartAccountAddress,
    permissionsContext,
    delegationManager,
  };
}

/**
 * Register wallet agent with backend after permissions are granted
 *
 * @param walletAddress - User's wallet address
 * @param smartAccountAddress - Smart account address from ERC-7715
 * @param permissionsContext - Permissions context from wallet_grantPermissions response
 * @param delegationManager - DelegationManager contract address
 * @param expiresAt - Unix timestamp when permissions expire
 * @param scopes - Array of permission scopes granted via ERC-7715
 */
export async function registerWalletAgent(
  walletAddress: string,
  smartAccountAddress: string,
  permissionsContext: string,
  delegationManager: string | null,
  expiresAt: number,
  scopes: PermissionScope[]
): Promise<void> {
  const backendDelegationAddress = process.env.NEXT_PUBLIC_BACKEND_DELEGATION_ADDRESS;

  const requestBody = {
    walletAddress,
    backendDelegationAddress,
    permissionsContext,
    delegationManager,
    chainId: 11155111, // Sepolia
    expiresAt,
    smartAccountAddress,
    accountMeta: undefined,
    scopes: scopes
  };

  
  
  
  const response = await apiClient.post('REGISTER_WALLET_AGENT_URL', requestBody) as any;

  
  if (!response.success) {
    throw new Error(response.message || 'Failed to register wallet agent');
  }
}
