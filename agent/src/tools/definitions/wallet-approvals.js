/**
 * wallet-approvals.js - Token approval management tools
 *
 * Check and revoke ERC-20 token approvals for wallet security.
 * Uses Envio HyperSync to find historical Approval events,
 * then verifies current allowance on-chain.
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import axios from 'axios';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';

// Envio HyperSync endpoints by chain
const HYPERSYNC_URLS = {
  1: 'https://eth.hypersync.xyz',
  8453: 'https://base.hypersync.xyz',
  11155111: 'https://sepolia.hypersync.xyz',
  84532: 'https://base-sepolia.hypersync.xyz'
};

// ERC20 Approval event topic: Approval(address indexed owner, address indexed spender, uint256 value)
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

// ERC20 ABI for allowance and approve
const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }
];

// Known spender labels (common protocols)
const KNOWN_SPENDERS = {
  // Uniswap
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { label: 'Uniswap Universal Router', protocol: 'Uniswap', trusted: true },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { label: 'Uniswap SwapRouter02', protocol: 'Uniswap', trusted: true },
  '0xe592427a0aece92de3edee1f18e0157c05861564': { label: 'Uniswap V3 Router', protocol: 'Uniswap', trusted: true },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': { label: 'Permit2', protocol: 'Uniswap', trusted: true },

  // 1inch
  '0x1111111254eeb25477b68fb85ed929f73a960582': { label: '1inch Router v5', protocol: '1inch', trusted: true },
  '0x111111125421ca6dc452d289314280a0f8842a65': { label: '1inch Router v6', protocol: '1inch', trusted: true },

  // 0x
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { label: '0x Exchange Proxy', protocol: '0x', trusted: true },

  // OpenSea
  '0x1e0049783f008a0085193e00003d00cd54003c71': { label: 'OpenSea Seaport', protocol: 'OpenSea', trusted: true },

  // Aave
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': { label: 'Aave V3 Pool', protocol: 'Aave', trusted: true },

  // Compound
  '0xc3d688b66703497daa19211eedff47f25384cdc3': { label: 'Compound III (USDC)', protocol: 'Compound', trusted: true },
};

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

function getSpenderInfo(spenderAddress) {
  const lower = spenderAddress.toLowerCase();
  return KNOWN_SPENDERS[lower] || null;
}

/**
 * Query Envio HyperSync for Approval events where owner = walletAddress
 */
async function getApprovalEvents(walletAddress, chainId, logger) {
  const hypersyncUrl = HYPERSYNC_URLS[chainId];
  if (!hypersyncUrl) {
    throw new Error(`HyperSync not available for chain ${chainId}`);
  }

  const envioApiKey = process.env.ENVIO_API_KEY;
  const headers = { 'Content-Type': 'application/json' };
  if (envioApiKey) {
    headers['Authorization'] = `Bearer ${envioApiKey}`;
  }

  // Get current block height
  const heightResponse = await axios.get(`${hypersyncUrl}/height`, { headers, timeout: 5000 });
  const currentBlock = heightResponse.data?.height;
  if (!currentBlock) {
    throw new Error('Could not get current block height');
  }

  // Query last ~1 year of blocks (approximate)
  const blocksPerDay = chainId === 8453 || chainId === 84532 ? 43200 : 7200;
  const fromBlock = Math.max(0, currentBlock - (blocksPerDay * 365));

  // Pad wallet address to 32 bytes for topic matching
  const ownerTopic = '0x' + walletAddress.slice(2).toLowerCase().padStart(64, '0');

  const query = {
    from_block: fromBlock,
    logs: [{
      topics: [
        [APPROVAL_TOPIC],
        [ownerTopic]  // owner is topic1 (indexed)
      ]
    }],
    field_selection: {
      log: ['address', 'topic0', 'topic1', 'topic2', 'topic3', 'data', 'block_number', 'transaction_hash']
    }
  };

  const response = await axios.post(`${hypersyncUrl}/query`, query, { headers, timeout: 30000 });

  return response.data?.data?.logs || [];
}

/**
 * Parse approval events and deduplicate by (token, spender)
 */
function parseApprovalEvents(logs) {
  const approvalMap = new Map();

  for (const log of logs) {
    const tokenAddress = log.address;
    // topic2 is the spender (indexed)
    const spenderPadded = log.topic2;
    if (!spenderPadded) continue;

    const spenderAddress = '0x' + spenderPadded.slice(26);
    const key = `${tokenAddress.toLowerCase()}-${spenderAddress.toLowerCase()}`;

    // Keep track of most recent approval for each (token, spender) pair
    const existing = approvalMap.get(key);
    if (!existing || log.block_number > existing.blockNumber) {
      approvalMap.set(key, {
        tokenAddress: ethers.getAddress(tokenAddress),
        spenderAddress: ethers.getAddress(spenderAddress),
        blockNumber: log.block_number,
        txHash: log.transaction_hash
      });
    }
  }

  return Array.from(approvalMap.values());
}

/**
 * Check current allowance for each (token, spender) pair
 */
async function checkCurrentAllowances(approvals, walletAddress, provider, logger) {
  const results = [];

  // Process in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < approvals.length; i += batchSize) {
    const batch = approvals.slice(i, i + batchSize);

    const batchResults = await Promise.all(batch.map(async (approval) => {
      try {
        const contract = new ethers.Contract(approval.tokenAddress, ERC20_ABI, provider);

        const [allowance, symbol, decimals, name] = await Promise.all([
          contract.allowance(walletAddress, approval.spenderAddress).catch(() => 0n),
          contract.symbol().catch(() => 'UNKNOWN'),
          contract.decimals().catch(() => 18),
          contract.name().catch(() => null)
        ]);

        // Skip if allowance is 0
        if (allowance === 0n) return null;

        const spenderInfo = getSpenderInfo(approval.spenderAddress);
        const isUnlimited = allowance >= ethers.MaxUint256 / 2n;

        return {
          tokenAddress: approval.tokenAddress,
          tokenSymbol: symbol,
          tokenName: name,
          tokenDecimals: Number(decimals),
          spenderAddress: approval.spenderAddress,
          spenderLabel: spenderInfo?.label || null,
          spenderProtocol: spenderInfo?.protocol || null,
          isTrusted: spenderInfo?.trusted || false,
          allowance: allowance.toString(),
          allowanceFormatted: isUnlimited ? 'Unlimited' : ethers.formatUnits(allowance, decimals),
          isUnlimited,
          blockNumber: approval.blockNumber
        };
      } catch (err) {
        logger?.debug?.('allowance_check_failed', {
          token: approval.tokenAddress,
          spender: approval.spenderAddress,
          error: err.message
        });
        return null;
      }
    }));

    results.push(...batchResults.filter(r => r !== null));
  }

  return results;
}

export const walletApprovalTools = [
  {
    name: 'get_token_approvals',
    description: `Check all active token approvals for a wallet. Shows which contracts have permission to spend your tokens.

Returns for each approval:
- Token name and symbol
- Spender address and label (if known protocol)
- Allowance amount (or "Unlimited")
- Whether spender is a trusted protocol

Use this to audit wallet security and find risky approvals to revoke.`,
    parameters: z.object({
      walletAddress: z.string().optional().describe('Wallet to check approvals for (defaults to connected wallet)')
    }),
    tags: ['free', 'read-only', 'security'],
    handler: async ({ walletAddress }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }

      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);

      context?.logger?.info?.('checking_approvals', { wallet: address, chain: config.name });

      // Get historical approval events from Envio
      const logs = await getApprovalEvents(address, chainId, context?.logger);
      context?.logger?.debug?.('approval_events_found', { count: logs.length });

      // Parse and deduplicate
      const approvals = parseApprovalEvents(logs);
      context?.logger?.debug?.('unique_approvals', { count: approvals.length });

      // Check current allowances on-chain
      const activeApprovals = await checkCurrentAllowances(approvals, address, provider, context?.logger);

      // Sort: untrusted first, then by allowance (unlimited first)
      activeApprovals.sort((a, b) => {
        if (a.isTrusted !== b.isTrusted) return a.isTrusted ? 1 : -1;
        if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
        return 0;
      });

      // Build summary
      const untrustedCount = activeApprovals.filter(a => !a.isTrusted).length;
      const unlimitedCount = activeApprovals.filter(a => a.isUnlimited).length;

      // Format for display
      const formattedApprovals = activeApprovals.map((a, idx) => ({
        index: idx + 1,
        token: a.tokenSymbol,
        tokenAddress: a.tokenAddress,
        spender: a.spenderLabel || `Unknown (${a.spenderAddress.slice(0, 10)}...)`,
        spenderAddress: a.spenderAddress,
        protocol: a.spenderProtocol || 'Unknown',
        allowance: a.allowanceFormatted,
        trusted: a.isTrusted ? 'Yes' : 'No',
        risk: !a.isTrusted ? 'Review' : (a.isUnlimited ? 'Low' : 'Low')
      }));

      // Build showToUser summary
      let showToUser = `**Token Approvals for ${address.slice(0, 8)}...${address.slice(-6)}**\n\n`;

      if (activeApprovals.length === 0) {
        showToUser += 'No active token approvals found. Your wallet is clean!';
      } else {
        showToUser += `Found **${activeApprovals.length}** active approvals`;
        if (untrustedCount > 0) {
          showToUser += ` (${untrustedCount} to unknown contracts)`;
        }
        showToUser += '\n\n';

        for (const a of formattedApprovals.slice(0, 10)) {
          const trustIcon = a.trusted === 'Yes' ? '' : '';
          showToUser += `${a.index}. **${a.token}** → ${a.spender}\n`;
          showToUser += `   Allowance: ${a.allowance} | ${trustIcon} ${a.protocol}\n\n`;
        }

        if (formattedApprovals.length > 10) {
          showToUser += `... and ${formattedApprovals.length - 10} more\n\n`;
        }

        if (untrustedCount > 0) {
          showToUser += `\n**Recommendation:** Review the ${untrustedCount} approval(s) to unknown contracts. Say "revoke approval 1" to remove.`;
        }
      }

      // Remember in context
      if (context?.remember) {
        context.remember('lastApprovalCheck', {
          wallet: address,
          chain: config.name,
          count: activeApprovals.length,
          untrustedCount,
          timestamp: new Date().toISOString()
        });
        context.remember('activeApprovals', formattedApprovals);
      }

      return {
        walletAddress: address,
        chain: config.name,
        chainId: config.chainId,
        totalApprovals: activeApprovals.length,
        untrustedApprovals: untrustedCount,
        unlimitedApprovals: unlimitedCount,
        approvals: formattedApprovals,
        showToUser
      };
    }
  },

];
