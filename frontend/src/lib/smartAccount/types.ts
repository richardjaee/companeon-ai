// Smart Account and Permission Types for ERC-7715
// MetaMask Advanced Permissions Hackathon (@MetaMaskDev)
// Using wallet_grantPermissions for granular permission control on smart accounts

export interface SmartAccountPermission {
  type: 'spending-limit' | 'allowed-operations' | 'time-window' | 'asset-allowlist';
  asset?: string; // Token address or 'native' for ETH
  dailyLimit?: string; // In token units (resets every 24 hours, enforced by smart account)
  totalLimit?: string; // Total lifetime limit (enforced by on-chain agent controller)
  expiryDays?: number; // Permission expires after X days (enforced by smart account)
  frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'; // How often the limit resets
  operations?: ('swap' | 'transfer' | 'stake' | 'lend' | 'borrow')[];
  startTime?: number; // Unix timestamp
  endTime?: number; // Unix timestamp
  allowedAssets?: string[]; // Array of token addresses
}

export interface SmartAccountConfig {
  ownerAddress: string; // User's EOA
  smartAccountAddress?: string; // Set after creation
  permissions: SmartAccountPermission[];
  chainId: number;
}

export interface AgentAsset {
  symbol: string;
  name: string;
  address: string; // '0x0000...' for native ETH
  logo?: string;
  isSelected: boolean;
  amount?: string;
  value?: number; // USD value of the asset
}

export interface AgentConfiguration {
  agentType: 'eth_usdc_trader' | 'fear_greed_trader' | 'custom';
  strategy?: string; // User's trading strategy/prompt (e.g., "Buy when fear < 20, sell when > 80")
  scheduleCron: string;
  selectedAssets: AgentAsset[];
  permissions: SmartAccountPermission[];
  smartAccountAddress?: string;
}

export interface CreateSmartAccountResult {
  smartAccountAddress: string;
  permissionsContext?: string; // Primary ERC-7715 permissions context (first permission)
  allPermissionContexts?: Record<string, string>; // All contexts keyed by token address ('native' for ETH)
  delegationManager?: string; // ERC-7715 delegation manager address for redeeming permissions
  transactionHash?: string;
  permissions: SmartAccountPermission[];
  delegateAddress?: string; // Backend's wallet address that was granted permission
}
