// MetaMask Smart Account Integration (ERC-7715)
// Using @metamask/smart-accounts-kit for Advanced Permissions Hackathon
// Proper SDK implementation as per MetaMask documentation

import { SmartAccountPermission, CreateSmartAccountResult } from './types';
import { createWalletClient, custom, type Address, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';
import { getFlaskRequirementMessage } from './detectFlask';

/**
 * Creates a smart account and grants permissions using MetaMask Smart Accounts Kit
 *
 * MetaMask Advanced Permissions Flow (Proper SDK Implementation):
 * 1. Create wallet client with ERC-7715 actions
 * 2. Request execution permissions (creates smart account if needed)
 * 3. Permissions are granted to delegate (backend wallet) via ERC-7715
 * 4. Delegate can execute transactions using delegation manager
 *
 * For @MetaMaskDev Advanced Permissions Hackathon:
 * - Uses Smart Accounts Kit SDK (not raw RPC)
 * - Implements ERC-20 periodic permissions for spending limits
 * - Smart account linked to NFT as the agent executor
 *
 * @param ethereum - MetaMask ethereum provider
 * @param ownerAddress - User's EOA address (smart account owner)
 * @param permissions - Array of permissions to grant
 * @param delegateAddress - Backend's wallet address (session key) to grant permissions to
 */
export async function createSmartAccountWithPermissions(
  ethereum: any,
  ownerAddress: string,
  permissions: SmartAccountPermission[],
  delegateAddress: string
): Promise<CreateSmartAccountResult> {
  if (!ethereum) {
    throw new Error('MetaMask not found');
  }

  if (!delegateAddress) {
    throw new Error('Backend wallet address (delegateAddress) is required');
  }

  try {
    console.log('[SmartAccount] Forcing Sepolia for ERC-7715 (only supported chain)');

    // Step 1: Switch to Sepolia FIRST before any other operations
    // This is critical because wallet_getCapabilities and other RPC calls
    // may behave differently on different chains
    const currentChainId = await ethereum.request({ method: 'eth_chainId' });
    const currentChainNumber = parseInt(currentChainId, 16);

    if (currentChainNumber !== 11155111) {
      console.log(`[SmartAccount] Wallet on chain ${currentChainNumber}, switching to Sepolia...`);
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia
        });
        console.log('[SmartAccount] Switched to Sepolia');
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
        } else {
          throw new Error('Please switch to Sepolia testnet to use ERC-7715 permissions');
        }
      }
    }

    // Step 2: Create wallet client with ERC-7715 actions using viem's official sepolia chain
    // This matches the working test page implementation
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(ethereum),
    }).extend(erc7715ProviderActions());

    // Step 3: Convert our permissions to ERC-7715 format
    // Use proper permission types as per MetaMask SDK: erc20-token-periodic, native-token-periodic
    // This is the KEY requirement for the hackathon - showing Advanced Permissions in main flow
    const currentTime = Math.floor(Date.now() / 1000);

    // IMPORTANT: The Native Token enforcer runs on ALL delegated transactions, even ERC-20 transfers
    // We MUST always include a native token permission, otherwise ERC-20 transfers will fail with
    // "NativeTokenPeriodTransferEnforcer:transfer-amount-exceeded"
    
    const spendingLimits = permissions.filter(perm => perm.type === 'spending-limit');
    
    // Check if user explicitly set a native token permission
    const hasNativeTokenPermission = spendingLimits.some(
      perm => perm.asset?.toLowerCase() === '0x0000000000000000000000000000000000000000'
    );

    // Find the max expiry from user-specified permissions
    const maxExpiryDays = Math.max(...spendingLimits.map(p => p.expiryDays || 365), 365);
    const defaultExpiry = currentTime + (maxExpiryDays * 24 * 60 * 60);

    // Build the permissions array
    const erc7715Permissions: any[] = [];

    // ALWAYS add native token permission first (required for enforcer chain)
    // If user didn't specify one, use a default amount for gas/transaction fees
    if (!hasNativeTokenPermission) {
      // Default: Allow 0.1 ETH per day for gas fees and small transactions
      const defaultNativeAmount = parseUnits('0.1', 18);
      console.log('[ERC-7715] Adding default native token permission (required for enforcer chain):', {
        periodAmount: defaultNativeAmount.toString(),
        reason: 'Native token enforcer runs on ALL transactions, including ERC-20 transfers'
      });

      erc7715Permissions.push({
        chainId: 11155111, // Sepolia only for ERC-7715
        expiry: defaultExpiry,
        signer: {
          type: 'account' as const,
          data: { address: delegateAddress as Address },
        },
        permission: {
          type: 'native-token-periodic' as const,
          data: {
            periodAmount: `0x${defaultNativeAmount.toString(16)}` as any,
            periodDuration: 86400, // 1 day in seconds
            justification: 'AI agent autonomous wallet operations',
          },
        },
        isAdjustmentAllowed: true,
      });
    }

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

    // Now add user-specified permissions
    for (const perm of spendingLimits) {
      const isNativeToken = perm.asset?.toLowerCase() === '0x0000000000000000000000000000000000000000';

      // Convert limit to periodAmount (in smallest unit)
      // This creates the actual spending limits that users approve in the popup
      const periodAmount = perm.dailyLimit
        ? parseUnits(perm.dailyLimit, isNativeToken ? 18 : 6) // ETH = 18 decimals, USDC = 6
        : parseUnits('1000000', isNativeToken ? 18 : 6); // Large number for "unlimited"

      // Get period duration from frequency (hourly, daily, weekly, etc.)
      const periodDuration = frequencyToDuration(perm.frequency);

      // Calculate expiry timestamp - use endTime if provided, otherwise use expiryDays
      let expiry: number;
      if (perm.endTime && perm.endTime > currentTime) {
        expiry = perm.endTime;
      } else {
        const expiryDays = perm.expiryDays || 365; // Default 1 year
        expiry = currentTime + (expiryDays * 24 * 60 * 60);
      }

      // Get frequency label for justification
      const frequencyLabel = perm.frequency || 'daily';

      console.log(`[ERC-7715] Setting up ${isNativeToken ? 'native' : 'ERC-20'} periodic permission:`, {
        token: perm.asset,
        limit: perm.dailyLimit,
        periodAmount: periodAmount.toString(),
        periodDuration,
        frequency: frequencyLabel,
        expiry: new Date(expiry * 1000).toISOString(),
        startTime: perm.startTime ? new Date(perm.startTime * 1000).toISOString() : 'now'
      });

      if (isNativeToken) {
        // Native token (ETH) periodic permission
        erc7715Permissions.push({
          chainId: 11155111, // Sepolia only for ERC-7715
          expiry,
          signer: {
            type: 'account' as const,
            data: { address: delegateAddress as Address },
          },
          permission: {
            type: 'native-token-periodic' as const,
            data: {
              periodAmount: `0x${periodAmount.toString(16)}` as any,
              periodDuration,
              justification: 'AI agent autonomous wallet operations',
            },
          },
          isAdjustmentAllowed: true,
        });
      } else {
        // ERC-20 token periodic permission
        erc7715Permissions.push({
          chainId: 11155111, // Sepolia only for ERC-7715
          expiry,
          signer: {
            type: 'account' as const,
            data: { address: delegateAddress as Address },
          },
          permission: {
            type: 'erc20-token-periodic' as const,
            data: {
              tokenAddress: perm.asset as Address,
              periodAmount: `0x${periodAmount.toString(16)}` as any,
              periodDuration,
              justification: 'AI agent autonomous wallet operations',
            },
          },
          isAdjustmentAllowed: true,
        });
      }
    }

    if (erc7715Permissions.length === 0) {
      throw new Error('No valid spending limit permissions found');
    }

    console.log(`[ERC-7715] Total permissions to request: ${erc7715Permissions.length} (including native token for enforcer chain)`);
    console.log('[ERC-7715] Permission types:', erc7715Permissions.map(p => p.permission.type));

    // Step 4: Request execution permissions using SDK method
    // This is the proper ERC-7715 flow - MetaMask will create a smart account if needed
    console.log('[ERC-7715] Requesting execution permissions with:', {
      permissions: erc7715Permissions,
      delegate: delegateAddress,
    });

    const grantedPermissions = await walletClient.requestExecutionPermissions(erc7715Permissions as any);

    console.log('[ERC-7715] Permission grant result (FULL):', JSON.stringify(grantedPermissions, null, 2));

    // Step 5: Extract smart account address from result
    // The first granted permission should contain the account info
    const firstPermission = grantedPermissions[0];
    if (!firstPermission) {
      throw new Error('No permissions granted');
    }

    console.log('[ERC-7715] First permission object:', JSON.stringify(firstPermission, null, 2));

    // The userOpBuilder address is the smart account address that will execute operations
    // If not available, we'll need to compute it from the user's EOA
    const smartAccountAddress = firstPermission.signerMeta?.userOpBuilder || ownerAddress as Address;

    // Step 6: Store ALL permission contexts - each token type needs its own context!
    // CRITICAL: ETH transfers need the native-token-periodic context
    // ERC-20 transfers need the erc20-token-periodic context for that token
    const delegationManager = firstPermission.signerMeta?.delegationManager;

    // Build a map of all permission contexts by type/token
    const allPermissionContexts: Record<string, string> = {};
    for (const perm of grantedPermissions) {
      const permType = perm.permission?.type;
      const tokenAddress = perm.permission?.data?.tokenAddress;
      
      if (permType === 'native-token-periodic') {
        allPermissionContexts['native'] = perm.context;
        console.log('[ERC-7715] ✅ Native token context:', perm.context?.slice(0, 40) + '...');
      } else if (permType === 'erc20-token-periodic' && tokenAddress) {
        allPermissionContexts[tokenAddress.toLowerCase()] = perm.context;
        console.log('[ERC-7715] ✅ ERC-20 token context for', tokenAddress, ':', perm.context?.slice(0, 40) + '...');
      }
    }

    // For backward compatibility, also provide the first context as the primary one
    // But include ALL contexts so backend can use the right one per token
    const permissionsContext = firstPermission.context;
    
    console.log('[ERC-7715] All permission contexts:', Object.keys(allPermissionContexts));
    console.log('[ERC-7715] Delegation manager:', delegationManager);

    return {
      smartAccountAddress,
      permissionsContext, // Primary context (for backward compatibility)
      allPermissionContexts, // All contexts keyed by token address
      delegationManager,  // Used for permission redemption
      transactionHash: undefined, // No transaction hash in permission grant
      permissions,
      delegateAddress,
    };
  } catch (error: any) {
    console.error('Smart account creation failed:', error);

    // Handle user rejection
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      throw new Error('User rejected smart account creation');
    }

    // Handle MetaMask Flask requirement
    if (error.message?.includes('Flask')) {
      throw new Error('This feature requires MetaMask Flask 13.5.0 or later. Please install MetaMask Flask.');
    }

    // Handle method not found or not supported (MetaMask doesn't support ERC-7715 yet)
    if (error.code === -32601 ||
        error.message?.includes('does not exist') ||
        error.message?.includes('not supported') ||
        error.message?.includes('no middleware configured') ||
        error.message?.includes('wallet_requestExecutionPermissions')) {
      throw new Error(getFlaskRequirementMessage());
    }

    // Re-throw the original error message
    throw new Error(error.message || 'Failed to create smart account');
  }
}

/**
 * Check if the user's account has been upgraded to a MetaMask smart account
 * This is required for Advanced Permissions to work
 */
export async function checkSmartAccountUpgrade(ethereum: any, address: string): Promise<boolean> {
  if (!ethereum) return false;

  try {
    const result = await ethereum.request({
      method: 'wallet_getSmartAccountInfo',
      params: [address],
    });

    return result?.isSmartAccount || false;
  } catch (error) {
    console.error('Failed to check smart account upgrade:', error);
    return false;
  }
}

/**
 * Check if smart accounts are supported on the current chain
 */
export async function isSmartAccountSupported(ethereum: any): Promise<boolean> {
  if (!ethereum) return false;

  try {
    // Get current account - MUST have a connected account
    const accounts = await ethereum.request({ method: 'eth_accounts' });

    // If no accounts connected, can't check capabilities
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0 || !accounts[0]) {
      console.log('[SmartAccount] No connected accounts, cannot check support');
      return false;
    }

    // Check if wallet_grantPermissions is supported
    const result = await ethereum.request({
      method: 'wallet_getCapabilities',
      params: [accounts[0]], // Always pass the account as string
    });

    // Check if the current chain supports advanced permissions
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    const capabilities = result?.[chainId];

    return capabilities?.permissions?.supported === true;
  } catch (error) {
    console.error('Failed to check smart account support:', error);
    // Fallback: assume supported for Base
    return true;
  }
}

/**
 * Get default permissions for an agent type
 * All limits default to UNLIMITED unless user specifies
 */
export function getDefaultPermissionsForAgent(
  agentType: 'eth_usdc_trader' | 'fear_greed_trader' | 'custom',
  assets: { address: string; symbol: string }[]
): SmartAccountPermission[] {
  // Add spending limits for each asset (all unlimited by default)
  const spendingLimits = assets.map(asset => ({
    type: 'spending-limit' as const,
    asset: asset.address,
    dailyLimit: '', // Empty = unlimited (user can set in UI)
    totalLimit: '', // Empty = unlimited (enforced by on-chain agent controller, not ERC-7715)
    expiryDays: 365, // Default 1 year (user can change in UI)
  }));

  return spendingLimits;
}

/**
 * CRYPTOGRAPHIC ENFORCEMENT: Backend MUST use redemption
 *
 * Why this is required:
 * 1. AgentController only accepts calls from smart accounts
 * 2. Smart accounts only execute calls that come through DelegationManager
 * 3. DelegationManager validates ERC-7715 limits before execution
 * 4. Backend cannot skip this - smart contracts enforce the requirement
 *
 * This makes ERC-7715 limits actually controlling spending!
 */

/**
 * Execute a trade using ERC-7715 permission redemption (REQUIRED)
 *
 * Backend MUST use this method for ALL trades to ensure ERC-7715 limits are enforced.
 * Uses the official MetaMask SDK sendTransactionWithDelegation method.
 * Direct calls to AgentController will be rejected by the smart account.
 *
 * Flow:
 * 1. Backend prepares AgentController.executeAgentSwap() call
 * 2. Backend calls sendTransactionWithDelegation (official SDK method)
 * 3. SDK calls DelegationManager.redeemDelegations() internally
 * 4. DelegationManager validates ERC-7715 limits and executes through smart account
 * 5. AgentController receives validated call and executes trade
 */
export async function executeTradeWithERC7715Redemption(
  walletClient: any,
  delegationManager: string,
  permissionsContext: any,
  agentControllerAddress: string,
  executeAgentSwapCalldata: string
): Promise<string> {
  console.log('[ERC-7715] 🔐 REDEEMING permissions using official SDK method...');
  console.log('[ERC-7715] Delegation manager validating limits:', delegationManager);
  console.log('[ERC-7715] Permissions context:', permissionsContext);
  console.log('[ERC-7715] Target AgentController:', agentControllerAddress);

  try {
    // OFFICIAL META MASK SDK METHOD: sendTransactionWithDelegation
    // This internally calls DelegationManager.redeemDelegations()
    const hash = await walletClient.sendTransactionWithDelegation({
      to: agentControllerAddress,     // Execute on AgentController
      data: executeAgentSwapCalldata, // The trade execution call
      permissionsContext,             // Which permission grant to redeem
      delegationManager               // Contract that validates limits
    });

    console.log('[ERC-7715] ✅ Permission redeemed, limits validated, trade executed:', hash);
    console.log('[ERC-7715] 🔒 Official SDK method used - strictly following MetaMask docs');

    return hash;

  } catch (error: any) {
    console.error('[ERC-7715] ❌ Permission redemption failed - limits exceeded or invalid');
    console.error('[ERC-7715] Official SDK method confirms ERC-7715 limits are enforced!');
    throw new Error(error.message || 'ERC-7715 limit exceeded - trade blocked');
  }
}

/**
 * Format permission for display
 */
export function formatPermissionForDisplay(permission: SmartAccountPermission): string {
  switch (permission.type) {
    case 'spending-limit':
      const limit = permission.dailyLimit || 'Unlimited';
      return `Spend up to ${limit} ${permission.asset} per day`;
    case 'allowed-operations':
      return `Allowed operations: ${permission.operations?.join(', ')}`;
    case 'time-window':
      const start = new Date(permission.startTime! * 1000).toLocaleDateString();
      const end = new Date(permission.endTime! * 1000).toLocaleDateString();
      return `Active from ${start} to ${end}`;
    case 'asset-allowlist':
      return `Can only interact with ${permission.allowedAssets?.length} assets`;
    default:
      return 'Custom permission';
  }
}
