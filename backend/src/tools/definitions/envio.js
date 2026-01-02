/**
 * Envio HyperSync Integration Tools
 * 
 * These tools use Envio's HyperSync API directly to query blockchain data.
 * HyperSync is 2000x faster than RPC calls for fetching historical data.
 * 
 * No indexer deployment needed - queries run directly against HyperSync.
 */

import { z } from 'zod';
import { ethers } from 'ethers';

// HyperSync endpoint for Sepolia
const HYPERSYNC_URL = 'https://sepolia.hypersync.xyz';

// Envio API key from environment
const ENVIO_API_KEY = process.env.ENVIO_API_KEY || '';

// Known tokens on Sepolia
const KNOWN_TOKENS = {
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 },
  '0xfff9976782d46cc05630d1f6ebab18b2324d6b14': { symbol: 'WETH', decimals: 18 },
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
};

// ERC20 Transfer event topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// DelegationManager contract (MetaMask Smart Accounts on Sepolia)
const DELEGATION_MANAGER_ADDRESS = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';

// RedeemedDelegation event topic
// Event structure: topic1 = delegator (permission granter/user wallet), topic2 = delegate (executor/backend)
const REDEEMED_DELEGATION_TOPIC = '0x40dadaa36c6c2e3d7317e24757451ffb2d603d875f0ad5e92c5dd156573b1873';

/**
 * Get headers for HyperSync requests
 */
function getHyperSyncHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (ENVIO_API_KEY) {
    headers['Authorization'] = `Bearer ${ENVIO_API_KEY}`;
  }
  return headers;
}

/**
 * Query HyperSync for logs
 */
async function queryHyperSync(query) {
  const response = await fetch(`${HYPERSYNC_URL}/query`, {
    method: 'POST',
    headers: getHyperSyncHeaders(),
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HyperSync query failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Get current block number from HyperSync
 */
async function getCurrentBlock() {
  const response = await fetch(`${HYPERSYNC_URL}/height`, {
    headers: getHyperSyncHeaders()
  });
  if (!response.ok) throw new Error('Failed to get current block');
  const data = await response.json();
  return data.height;
}

/**
 * Format timestamp to human-readable
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * Format time ago
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60);
  const hours = Math.floor(diff / 3600);
  const days = Math.floor(diff / 86400);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Parse address from topic (32 bytes padded)
 */
function parseAddressFromTopic(topic) {
  if (!topic) return null;
  return '0x' + topic.slice(-40).toLowerCase();
}

/**
 * Format token amount - raw (for calculations)
 */
function formatAmountRaw(amountHex, decimals) {
  try {
    const amount = BigInt(amountHex);
    return ethers.formatUnits(amount, decimals);
  } catch {
    return '0';
  }
}

/**
 * Format token amount - human readable
 * Shows reasonable decimal places and "< 0.0001" for tiny amounts
 */
function formatAmount(amountHex, decimals) {
  try {
    const amount = BigInt(amountHex);
    const formatted = ethers.formatUnits(amount, decimals);
    const num = parseFloat(formatted);
    
    if (num === 0) return '0';
    
    // For very tiny amounts, show "< 0.0001"
    if (num > 0 && num < 0.0001) return '< 0.0001';
    if (num < 0 && num > -0.0001) return '< 0.0001';
    
    // For amounts >= 1, show 2-4 decimal places
    if (Math.abs(num) >= 1) {
      return num.toFixed(4).replace(/\.?0+$/, '');
    }
    
    // For amounts < 1, show up to 6 significant digits
    if (Math.abs(num) >= 0.01) {
      return num.toFixed(4).replace(/\.?0+$/, '');
    }
    
    // For very small amounts, show 6 decimal places
    return num.toFixed(6).replace(/\.?0+$/, '');
  } catch {
    return '0';
  }
}

/**
 * Format address for display (0x1234...5678)
 */
function formatAddress(address) {
  if (!address) return 'unknown';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const envioTools = [
  {
    name: 'envio_get_token_transfers',
    description: `Get ERC-20 token transfer history for a wallet address using Envio HyperSync.
    
This queries the blockchain directly with 2000x faster speed than RPC.
Shows all ERC-20 token transfers (USDC, WETH, etc.) involving the wallet.

NOTE: This only shows ERC-20 token transfers, NOT native ETH transfers.
For native ETH, use envio_get_eth_transfers instead.

Use this when user asks about:
- "What tokens have I sent/received?"
- "Show my USDC transfers"
- "Show my ERC-20 transfer history"`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to check. Defaults to connected wallet.'),
      tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Filter by specific token contract address'),
      limit: z.number().min(1).max(100).default(20)
        .describe('Number of transfers to return')
    }),
    tags: ['free', 'read', 'history', 'envio'],
    handler: async ({ walletAddress, tokenAddress, limit = 20 }, context) => {
      const logger = context?.logger;
      
      // Use provided wallet or fall back to connected wallet
      const effectiveWallet = walletAddress || context?.walletAddress;
      if (!effectiveWallet) {
        return {
          walletAddress: null,
          transfers: [],
          count: 0,
          error: 'No wallet address provided',
          message: 'Please connect your wallet or specify a wallet address.'
        };
      }
      
      const wallet = effectiveWallet.toLowerCase();
      
      logger?.info?.('hypersync_get_token_transfers', { wallet, tokenAddress, limit });
      
      try {
        // Get current block
        const currentBlock = await getCurrentBlock();
        // Look back ~30 days of blocks (assuming ~12s per block on Sepolia)
        const fromBlock = Math.max(0, currentBlock - 216000);
        
        // Pad wallet address to 32 bytes for topic matching
        const walletPadded = '0x000000000000000000000000' + wallet.slice(2);
        
        // Build query for transfers TO and FROM this wallet
        const query = {
          from_block: fromBlock,
          logs: [
            {
              // Transfers FROM this wallet
              topics: [
                [TRANSFER_TOPIC],
                [walletPadded],
                []
              ],
              address: tokenAddress ? [tokenAddress.toLowerCase()] : undefined
            },
            {
              // Transfers TO this wallet
              topics: [
                [TRANSFER_TOPIC],
                [],
                [walletPadded]
              ],
              address: tokenAddress ? [tokenAddress.toLowerCase()] : undefined
            }
          ],
          field_selection: {
            log: ['block_number', 'transaction_hash', 'address', 'topic0', 'topic1', 'topic2', 'data'],
            block: ['number', 'timestamp']
          }
        };

        const result = await queryHyperSync(query);
        
        if (!result.data || result.data.length === 0) {
          return {
            walletAddress: wallet,
            transfers: [],
            count: 0,
            message: `No token transfers found for ${wallet} in the last 30 days.`,
            source: 'Envio HyperSync',
            note: 'HyperSync queried successfully but found no matching events.'
          };
        }

        // HyperSync returns data in batches - combine ALL of them
        const logs = [];
        const blockTimestamps = {};
        
        for (const batch of result.data) {
          if (batch.logs) logs.push(...batch.logs);
          if (batch.blocks) {
            for (const block of batch.blocks) {
              blockTimestamps[block.number] = block.timestamp;
            }
          }
        }
        
        // Process transfers
        const transfers = [];
        for (const log of logs.slice(-limit * 2)) { // Get extra to filter
          const tokenAddr = log.address?.toLowerCase();
          const from = parseAddressFromTopic(log.topic1);
          const to = parseAddressFromTopic(log.topic2);
          const amount = log.data || '0x0';
          
          if (!from || !to) continue;
          
          // Check if this wallet is involved
          const isOutgoing = from === wallet;
          const isIncoming = to === wallet;
          if (!isOutgoing && !isIncoming) continue;
          
          const tokenInfo = KNOWN_TOKENS[tokenAddr] || { symbol: 'TOKEN', decimals: 18 };
          const timestamp = blockTimestamps[log.block_number];
          
          transfers.push({
            type: isOutgoing ? 'SENT' : 'RECEIVED',
            token: tokenInfo.symbol,
            tokenAddress: tokenAddr,
            amount: formatAmount(amount, tokenInfo.decimals),
            counterparty: isOutgoing ? to : from,
            counterpartyShort: formatAddress(isOutgoing ? to : from),
            txHash: log.transaction_hash,
            txHashFull: log.transaction_hash,
            blockNumber: log.block_number,
            when: formatTimeAgo(timestamp),
            timestamp: formatTimestamp(timestamp)
          });
        }

        // Sort by block number (descending) and limit
        transfers.sort((a, b) => b.blockNumber - a.blockNumber);
        const limitedTransfers = transfers.slice(0, limit);

        // Build summary
        const incoming = limitedTransfers.filter(t => t.type === 'RECEIVED');
        const outgoing = limitedTransfers.filter(t => t.type === 'SENT');

        // Build showToUser with full details
        const showToUserLines = limitedTransfers.map((t, i) => {
          const direction = t.type === 'SENT' ? 'Sent' : 'Received';
          const preposition = t.type === 'SENT' ? 'to' : 'from';
          return `${i + 1}. ${direction} ${t.amount} ${t.token} ${preposition} ${t.counterpartyShort}\n   ${t.when}\n   tx: ${t.txHashFull}`;
        });

        return {
          walletAddress: wallet,
          transfers: limitedTransfers,
          count: limitedTransfers.length,
          summary: {
            totalShown: limitedTransfers.length,
            incoming: incoming.length,
            outgoing: outgoing.length
          },
          showToUser: showToUserLines.join('\n\n'),
          txHashes: limitedTransfers.map(t => t.txHashFull),
          message: `Found ${limitedTransfers.length} token transfer${limitedTransfers.length !== 1 ? 's' : ''}: ${incoming.length} received, ${outgoing.length} sent.`,
          source: 'Envio HyperSync',
          formattingHint: 'Display showToUser content with full tx hashes. Frontend adds View buttons from txHashes.'
        };

      } catch (error) {
        logger?.error?.('hypersync_query_failed', { error: error.message });
        
        return {
          walletAddress: wallet,
          error: error.message,
          message: 'Could not query Envio HyperSync.',
          suggestion: 'HyperSync may be temporarily unavailable. Try again shortly.'
        };
      }
    }
  },

  {
    name: 'envio_get_eth_transfers',
    description: `Get native ETH transfer history for a wallet address using Envio HyperSync.
    
This queries the blockchain for native ETH transfers (not ERC-20 tokens).
Shows ETH sent/received involving the wallet.

Use this when user asks about:
- "Show my ETH transfers"
- "What ETH have I sent?"
- "Show my native ETH history"
- "My recent ETH transactions"`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to check. Defaults to connected wallet.'),
      limit: z.number().min(1).max(100).default(20)
        .describe('Number of transfers to return')
    }),
    tags: ['free', 'read', 'history', 'envio'],
    handler: async ({ walletAddress, limit = 20 }, context) => {
      const logger = context?.logger;
      
      const effectiveWallet = walletAddress || context?.walletAddress;
      if (!effectiveWallet) {
        return {
          walletAddress: null,
          transfers: [],
          count: 0,
          error: 'No wallet address provided',
          message: 'Please connect your wallet or specify a wallet address.'
        };
      }
      
      const wallet = effectiveWallet.toLowerCase();
      
      logger?.info?.('hypersync_get_eth_transfers', { wallet, limit });
      
      try {
        const currentBlock = await getCurrentBlock();
        // Look back ~30 days of blocks
        const fromBlock = Math.max(0, currentBlock - 216000);
        
        // Query transactions where this wallet is sender OR receiver with non-zero value
        const query = {
          from_block: fromBlock,
          transactions: [
            { from: [wallet] },
            { to: [wallet] }
          ],
          field_selection: {
            transaction: ['hash', 'from', 'to', 'value', 'block_number'],
            block: ['number', 'timestamp']
          }
        };

        const result = await queryHyperSync(query);
        
        // Combine all batches
        const txns = [];
        const blockTimestamps = {};
        
        for (const batch of (result.data || [])) {
          if (batch.transactions) txns.push(...batch.transactions);
          if (batch.blocks) {
            for (const block of batch.blocks) {
              blockTimestamps[block.number] = block.timestamp;
            }
          }
        }
        
        // Filter to only non-zero value transfers
        const transfers = [];
        for (const tx of txns) {
          const value = tx.value;
          if (!value || value === '0x0' || value === '0x') continue;
          
          try {
            const ethValueRaw = ethers.formatEther(BigInt(value));
            const ethFloat = parseFloat(ethValueRaw);
            if (ethFloat <= 0) continue;
            
            // Format ETH nicely
            let ethValue;
            if (ethFloat < 0.0001) {
              ethValue = '< 0.0001';
            } else if (ethFloat >= 1) {
              ethValue = ethFloat.toFixed(4).replace(/\.?0+$/, '');
            } else {
              ethValue = ethFloat.toFixed(6).replace(/\.?0+$/, '');
            }
            
            const from = tx.from?.toLowerCase();
            const to = tx.to?.toLowerCase();
            const isOutgoing = from === wallet;
            const isIncoming = to === wallet;
            
            if (!isOutgoing && !isIncoming) continue;
            
            const timestamp = blockTimestamps[tx.block_number];
            const counterparty = isOutgoing ? to : from;
            
            transfers.push({
              type: isOutgoing ? 'SENT' : 'RECEIVED',
              token: 'ETH',
              amount: ethValue,
              counterparty: counterparty,
              counterpartyShort: formatAddress(counterparty),
              txHash: tx.hash,
              txHashFull: tx.hash, // Full hash for explicit display
              blockNumber: tx.block_number,
              when: formatTimeAgo(timestamp),
              timestamp: formatTimestamp(timestamp),
              displayLine: `${isOutgoing ? 'Sent' : 'Received'} ${ethValue} ETH ${isOutgoing ? 'to' : 'from'} ${formatAddress(counterparty)}`
            });
          } catch (e) {
            // Skip parse errors
          }
        }

        // Sort by block number (descending) and limit
        transfers.sort((a, b) => b.blockNumber - a.blockNumber);
        const limitedTransfers = transfers.slice(0, limit);

        const incoming = limitedTransfers.filter(t => t.type === 'RECEIVED');
        const outgoing = limitedTransfers.filter(t => t.type === 'SENT');
        
        // Build showToUser with full details including tx hashes
        const showToUserLines = limitedTransfers.map((t, i) => {
          const direction = t.type === 'SENT' ? 'Sent' : 'Received';
          const preposition = t.type === 'SENT' ? 'to' : 'from';
          return `${i + 1}. ${direction} ${t.amount} ETH ${preposition} ${formatAddress(t.counterparty)}\n   ${t.when}\n   tx: ${t.txHashFull}`;
        });

        return {
          walletAddress: wallet,
          transfers: limitedTransfers,
          count: limitedTransfers.length,
          summary: {
            totalShown: limitedTransfers.length,
            incoming: incoming.length,
            outgoing: outgoing.length
          },
          showToUser: showToUserLines.join('\n\n'),
          txHashes: limitedTransfers.map(t => t.txHashFull),
          message: `Found ${limitedTransfers.length} native ETH transfer${limitedTransfers.length !== 1 ? 's' : ''}: ${incoming.length} received, ${outgoing.length} sent.`,
          source: 'Envio HyperSync',
          note: 'These are native ETH transfers only. For ERC-20 tokens, use envio_get_token_transfers.',
          formattingHint: 'Display showToUser content with full tx hashes. Frontend adds View buttons from txHashes.'
        };

      } catch (error) {
        logger?.error?.('hypersync_eth_query_failed', { error: error.message });
        
        return {
          walletAddress: wallet,
          error: error.message,
          message: 'Could not query ETH transfers.',
          suggestion: 'HyperSync may be temporarily unavailable. Try again shortly.'
        };
      }
    }
  },

  {
    name: 'envio_get_all_transfers',
    description: `Get ALL transfers (both native ETH AND ERC-20 tokens) for a wallet.
    
This is the most comprehensive transfer history - combines native ETH and token transfers.

Use this when user asks about:
- "Show all my transfers"
- "What have I sent/received?"
- "My complete transfer history"
- "Show my last transactions"`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to check. Defaults to connected wallet.'),
      limit: z.number().min(1).max(100).default(20)
        .describe('Number of transfers to return')
    }),
    tags: ['free', 'read', 'history', 'envio'],
    handler: async ({ walletAddress, limit = 20 }, context) => {
      const logger = context?.logger;
      
      const effectiveWallet = walletAddress || context?.walletAddress;
      if (!effectiveWallet) {
        return {
          walletAddress: null,
          transfers: [],
          count: 0,
          error: 'No wallet address provided',
          message: 'Please connect your wallet or specify a wallet address.'
        };
      }
      
      const wallet = effectiveWallet.toLowerCase();
      
      logger?.info?.('hypersync_get_all_transfers', { wallet, limit });
      
      try {
        const currentBlock = await getCurrentBlock();
        const fromBlock = Math.max(0, currentBlock - 216000);
        const walletPadded = '0x000000000000000000000000' + wallet.slice(2);
        
        // Query BOTH: ERC-20 Transfer events AND native ETH transactions
        const query = {
          from_block: fromBlock,
          logs: [
            { topics: [[TRANSFER_TOPIC], [walletPadded], []] },
            { topics: [[TRANSFER_TOPIC], [], [walletPadded]] }
          ],
          transactions: [
            { from: [wallet] },
            { to: [wallet] }
          ],
          field_selection: {
            log: ['block_number', 'transaction_hash', 'address', 'topic0', 'topic1', 'topic2', 'data'],
            transaction: ['hash', 'from', 'to', 'value', 'block_number'],
            block: ['number', 'timestamp']
          }
        };

        const result = await queryHyperSync(query);
        
        const logs = [];
        const txns = [];
        const blockTimestamps = {};
        
        for (const batch of (result.data || [])) {
          if (batch.logs) logs.push(...batch.logs);
          if (batch.transactions) txns.push(...batch.transactions);
          if (batch.blocks) {
            for (const block of batch.blocks) {
              blockTimestamps[block.number] = block.timestamp;
            }
          }
        }
        
        const allTransfers = [];
        
        // Process ERC-20 transfers
        for (const log of logs) {
          const tokenAddr = log.address?.toLowerCase();
          const from = parseAddressFromTopic(log.topic1);
          const to = parseAddressFromTopic(log.topic2);
          const amount = log.data || '0x0';
          
          if (!from || !to) continue;
          
          const isOutgoing = from === wallet;
          const isIncoming = to === wallet;
          if (!isOutgoing && !isIncoming) continue;
          
          const tokenInfo = KNOWN_TOKENS[tokenAddr] || { symbol: 'TOKEN', decimals: 18 };
          const timestamp = blockTimestamps[log.block_number];
          const formattedAmount = formatAmount(amount, tokenInfo.decimals);
          const counterparty = isOutgoing ? to : from;
          
          allTransfers.push({
            type: isOutgoing ? 'SENT' : 'RECEIVED',
            token: tokenInfo.symbol,
            tokenAddress: tokenAddr,
            amount: formattedAmount,
            counterparty: counterparty,
            counterpartyShort: formatAddress(counterparty),
            txHash: log.transaction_hash,
            txHashFull: log.transaction_hash,
            blockNumber: log.block_number,
            when: formatTimeAgo(timestamp),
            timestamp: formatTimestamp(timestamp),
            isNative: false,
            // Pre-formatted display line
            displayLine: `${isOutgoing ? 'Sent' : 'Received'} ${formattedAmount} ${tokenInfo.symbol} ${isOutgoing ? 'to' : 'from'} ${formatAddress(counterparty)}`
          });
        }
        
        // Process native ETH transfers
        for (const tx of txns) {
          const value = tx.value;
          if (!value || value === '0x0' || value === '0x') continue;
          
          try {
            const ethValueRaw = ethers.formatEther(BigInt(value));
            const ethFloat = parseFloat(ethValueRaw);
            if (ethFloat <= 0) continue;
            
            // Format ETH nicely
            let ethValue;
            if (ethFloat < 0.0001) {
              ethValue = '< 0.0001';
            } else if (ethFloat >= 1) {
              ethValue = ethFloat.toFixed(4).replace(/\.?0+$/, '');
            } else {
              ethValue = ethFloat.toFixed(6).replace(/\.?0+$/, '');
            }
            
            const from = tx.from?.toLowerCase();
            const to = tx.to?.toLowerCase();
            const isOutgoing = from === wallet;
            const isIncoming = to === wallet;
            
            if (!isOutgoing && !isIncoming) continue;
            
            const timestamp = blockTimestamps[tx.block_number];
            const counterparty = isOutgoing ? to : from;
            
            allTransfers.push({
              type: isOutgoing ? 'SENT' : 'RECEIVED',
              token: 'ETH',
              amount: ethValue,
              counterparty: counterparty,
              counterpartyShort: formatAddress(counterparty),
              txHash: tx.hash,
              txHashFull: tx.hash,
              blockNumber: tx.block_number,
              when: formatTimeAgo(timestamp),
              timestamp: formatTimestamp(timestamp),
              isNative: true,
              // Pre-formatted display line
              displayLine: `${isOutgoing ? 'Sent' : 'Received'} ${ethValue} ETH ${isOutgoing ? 'to' : 'from'} ${formatAddress(counterparty)}`
            });
          } catch (e) {
            // Skip parse errors
          }
        }

        // Sort by block number (descending) and limit
        allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);
        const limitedTransfers = allTransfers.slice(0, limit);

        const incoming = limitedTransfers.filter(t => t.type === 'RECEIVED');
        const outgoing = limitedTransfers.filter(t => t.type === 'SENT');
        const ethCount = limitedTransfers.filter(t => t.isNative).length;
        const tokenCount = limitedTransfers.filter(t => !t.isNative).length;
        
        // Calculate net flow by token
        const netByToken = {};
        for (const t of limitedTransfers) {
          const amt = parseFloat(t.amount) || 0;
          const key = t.token;
          if (!netByToken[key]) netByToken[key] = { in: 0, out: 0 };
          if (t.type === 'RECEIVED') netByToken[key].in += amt;
          else netByToken[key].out += amt;
        }
        
        // Build showToUser with full details including tx hashes
        const showToUserLines = limitedTransfers.map((t, i) => {
          const direction = t.type === 'SENT' ? 'Sent' : 'Received';
          const preposition = t.type === 'SENT' ? 'to' : 'from';
          return `${i + 1}. ${direction} ${t.amount} ${t.token} ${preposition} ${formatAddress(t.counterparty)}\n   ${t.when}\n   tx: ${t.txHashFull}`;
        });

        return {
          walletAddress: wallet,
          transfers: limitedTransfers,
          count: limitedTransfers.length,
          summary: {
            totalShown: limitedTransfers.length,
            incoming: incoming.length,
            outgoing: outgoing.length,
            nativeEth: ethCount,
            erc20Tokens: tokenCount,
            netByToken: netByToken
          },
          showToUser: showToUserLines.join('\n\n'),
          txHashes: limitedTransfers.map(t => t.txHashFull),
          message: `Found ${limitedTransfers.length} transfer${limitedTransfers.length !== 1 ? 's' : ''}: ${outgoing.length} sent, ${incoming.length} received (${ethCount} ETH, ${tokenCount} tokens).`,
          source: 'Envio HyperSync',
          formattingHint: 'Display showToUser content with full tx hashes. Frontend adds View buttons from txHashes.'
        };

      } catch (error) {
        logger?.error?.('hypersync_all_transfers_failed', { error: error.message });
        
        return {
          walletAddress: wallet,
          error: error.message,
          message: 'Could not query transfers.',
          suggestion: 'HyperSync may be temporarily unavailable. Try again shortly.'
        };
      }
    }
  },

  {
    name: 'envio_get_recent_activity',
    description: `Get recent blockchain activity summary for a wallet.
    
Provides a quick overview of recent token transfers and activity.

Use this when user asks about:
- "What's my recent activity?"
- "Any new transactions?"
- "Show my wallet activity"`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to check. Defaults to connected wallet.'),
      hoursBack: z.number().min(1).max(168).default(24)
        .describe('How many hours back to look (max 168 = 7 days)')
    }),
    tags: ['free', 'read', 'history', 'envio'],
    handler: async ({ walletAddress, hoursBack = 24 }, context) => {
      const logger = context?.logger;
      
      const effectiveWallet = walletAddress || context?.walletAddress;
      if (!effectiveWallet) {
        return {
          walletAddress: null,
          error: 'No wallet address provided',
          message: 'Please connect your wallet or specify a wallet address.'
        };
      }
      
      const wallet = effectiveWallet.toLowerCase();
      
      logger?.info?.('hypersync_get_recent_activity', { wallet, hoursBack });
      
      try {
        // Get current block
        const currentBlock = await getCurrentBlock();
        // Calculate blocks for the time period (12s per block on Sepolia)
        const blocksBack = Math.floor((hoursBack * 3600) / 12);
        const fromBlock = Math.max(0, currentBlock - blocksBack);
        
        // Pad wallet address
        const walletPadded = '0x000000000000000000000000' + wallet.slice(2);
        
        // Query for ERC-20 transfers involving this wallet
        const tokenQuery = {
          from_block: fromBlock,
          logs: [
            {
              topics: [[TRANSFER_TOPIC], [walletPadded], []],
            },
            {
              topics: [[TRANSFER_TOPIC], [], [walletPadded]],
            }
          ],
          field_selection: {
            log: ['block_number', 'address', 'topic1', 'topic2', 'data'],
            block: ['number', 'timestamp']
          }
        };
        
        // Query for native ETH transfers (transactions with value)
        const ethQuery = {
          from_block: fromBlock,
          transactions: [
            { from: [wallet] },
            { to: [wallet] }
          ],
          field_selection: {
            transaction: ['hash', 'from', 'to', 'value', 'block_number'],
            block: ['number', 'timestamp']
          }
        };

        // Run both queries in parallel
        const [tokenResult, ethResult] = await Promise.all([
          queryHyperSync(tokenQuery),
          queryHyperSync(ethQuery)
        ]);
        
        // Process ERC-20 transfers
        const logs = [];
        for (const batch of (tokenResult.data || [])) {
          if (batch.logs) logs.push(...batch.logs);
        }
        
        // Process native ETH transfers
        const ethTxns = [];
        for (const batch of (ethResult.data || [])) {
          if (batch.transactions) ethTxns.push(...batch.transactions);
        }
        
        // Count by token
        const tokenCounts = {};
        let totalIn = 0;
        let totalOut = 0;
        
        // Count ERC-20 transfers
        for (const log of logs) {
          const tokenAddr = log.address?.toLowerCase();
          const from = parseAddressFromTopic(log.topic1);
          const to = parseAddressFromTopic(log.topic2);
          
          if (!from || !to) continue;
          
          const isOutgoing = from === wallet;
          const isIncoming = to === wallet;
          
          if (isOutgoing) totalOut++;
          if (isIncoming) totalIn++;
          
          const tokenInfo = KNOWN_TOKENS[tokenAddr] || { symbol: 'OTHER', decimals: 18 };
          tokenCounts[tokenInfo.symbol] = (tokenCounts[tokenInfo.symbol] || 0) + 1;
        }
        
        // Count native ETH transfers (only those with value > 0)
        let ethIn = 0;
        let ethOut = 0;
        for (const tx of ethTxns) {
          const value = tx.value;
          if (!value || value === '0x0' || value === '0x') continue;
          
          const from = tx.from?.toLowerCase();
          const to = tx.to?.toLowerCase();
          
          if (from === wallet) {
            ethOut++;
            totalOut++;
          }
          if (to === wallet) {
            ethIn++;
            totalIn++;
          }
        }
        
        // Add ETH to token counts if any
        if (ethIn + ethOut > 0) {
          tokenCounts['ETH'] = (tokenCounts['ETH'] || 0) + ethIn + ethOut;
        }

        const totalTransfers = logs.length + ethIn + ethOut;

        // Build token breakdown for display
        const tokenBreakdown = Object.entries(tokenCounts)
          .map(([token, count]) => `${token}: ${count}`)
          .join(', ');
        
        // Build showToUser content
        let showToUser;
        if (totalTransfers > 0) {
          showToUser = `Activity in the last ${hoursBack} hours:\n`;
          showToUser += `- ${totalTransfers} transfer${totalTransfers !== 1 ? 's' : ''} (ETH + tokens)\n`;
          showToUser += `- ${totalOut} outgoing, ${totalIn} incoming\n`;
          if (tokenBreakdown) {
            showToUser += `- Breakdown: ${tokenBreakdown}`;
          }
          showToUser += `\n\nFor full details, use "show my transfers"`;
        } else {
          showToUser = `No transfers in the last ${hoursBack} hours.`;
        }
        
        return {
          walletAddress: wallet,
          period: `Last ${hoursBack} hour${hoursBack !== 1 ? 's' : ''}`,
          activity: {
            totalTransfers,
            incoming: totalIn,
            outgoing: totalOut,
            byToken: tokenCounts
          },
          hasActivity: totalTransfers > 0,
          showToUser: showToUser,
          message: totalTransfers > 0 
            ? `In the last ${hoursBack}h: ${totalTransfers} token transfer${totalTransfers !== 1 ? 's' : ''} (${totalIn} in, ${totalOut} out).`
            : `No token transfers in the last ${hoursBack} hours.`,
          source: 'Envio HyperSync',
          formattingHint: 'Display showToUser. For full transfer details, call envio_get_all_transfers.'
        };

      } catch (error) {
        logger?.error?.('hypersync_query_failed', { error: error.message });
        
        return {
          walletAddress: wallet,
          error: error.message,
          message: 'Could not query recent activity.',
          suggestion: 'Try again shortly.'
        };
      }
    }
  },

  {
    name: 'envio_count_wallet_transactions',
    description: `Count total token transactions for a wallet.
    
Provides aggregate statistics about wallet activity.

Use this when user asks about:
- "How many transactions have I done?"
- "My total transfer count"
- "Wallet transaction stats"`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to check. Defaults to connected wallet.'),
      daysBack: z.number().min(1).max(90).default(30)
        .describe('How many days back to count')
    }),
    tags: ['free', 'read', 'history', 'envio'],
    handler: async ({ walletAddress, daysBack = 30 }, context) => {
      const logger = context?.logger;
      
      const effectiveWallet = walletAddress || context?.walletAddress;
      if (!effectiveWallet) {
        return {
          walletAddress: null,
          error: 'No wallet address provided',
          message: 'Please connect your wallet or specify a wallet address.'
        };
      }
      
      const wallet = effectiveWallet.toLowerCase();
      
      logger?.info?.('hypersync_count_transactions', { wallet, daysBack });
      
      try {
        const currentBlock = await getCurrentBlock();
        const blocksBack = Math.floor((daysBack * 24 * 3600) / 12);
        const fromBlock = Math.max(0, currentBlock - blocksBack);
        
        const walletPadded = '0x000000000000000000000000' + wallet.slice(2);
        
        const query = {
          from_block: fromBlock,
          logs: [
            { topics: [[TRANSFER_TOPIC], [walletPadded], []] },
            { topics: [[TRANSFER_TOPIC], [], [walletPadded]] }
          ],
          field_selection: {
            log: ['address', 'topic1', 'topic2']
          }
        };

        const result = await queryHyperSync(query);
        
        // HyperSync returns data in batches - combine ALL of them
        const logs = [];
        for (const batch of (result.data || [])) {
          if (batch.logs) logs.push(...batch.logs);
        }
        
        // Count unique transactions and directions
        const txHashes = new Set();
        let sentCount = 0;
        let receivedCount = 0;
        const tokenStats = {};
        
        for (const log of logs) {
          const from = parseAddressFromTopic(log.topic1);
          const to = parseAddressFromTopic(log.topic2);
          const tokenAddr = log.address?.toLowerCase();
          
          if (from === wallet) sentCount++;
          if (to === wallet) receivedCount++;
          
          const tokenInfo = KNOWN_TOKENS[tokenAddr] || { symbol: 'OTHER' };
          tokenStats[tokenInfo.symbol] = (tokenStats[tokenInfo.symbol] || 0) + 1;
        }

        return {
          walletAddress: wallet,
          period: `Last ${daysBack} day${daysBack !== 1 ? 's' : ''}`,
          stats: {
            totalTransfers: logs.length,
            sent: sentCount,
            received: receivedCount,
            byToken: tokenStats
          },
          message: `In the last ${daysBack} days: ${logs.length} total token transfers. Sent ${sentCount}, received ${receivedCount}.`,
          source: 'Envio HyperSync'
        };

      } catch (error) {
        logger?.error?.('hypersync_query_failed', { error: error.message });
        
        return {
          walletAddress: wallet,
          error: error.message,
          message: 'Could not count transactions.'
        };
      }
    }
  },

  {
    name: 'envio_get_delegation_executions',
    description: `Get all ERC-7715 delegation executions for a wallet using Envio HyperSync.
    
This queries the DelegationManager contract to show every time delegated permissions were used.
Shows swaps, transfers, x402 payments - anything executed via delegation.

Can query by either the delegate (backend key that executes) or the delegator (user wallet that granted permissions).

Use this when user asks about:
- "What delegations have been executed?"
- "Show my delegation history"
- "What transactions used my delegated permissions?"
- "How many times has my delegation been used?"`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to query. Defaults to connected wallet if not provided.'),
      queryAs: z.enum(['delegate', 'delegator', 'both']).default('both')
        .describe('Query as delegate (backend/executor), delegator (user/permission granter), or both. Default is both.'),
      limit: z.number().min(1).max(100).default(20)
        .describe('Number of executions to return'),
      hoursBack: z.number().min(1).max(720).optional()
        .describe('How many hours back to search (use this for short timeframes like 24 hours)'),
      daysBack: z.number().min(1).max(90).default(30)
        .describe('How many days back to search (ignored if hoursBack is set)')
    }),
    tags: ['free', 'read', 'history', 'envio', 'delegation'],
    handler: async ({ walletAddress, queryAs = 'both', limit = 20, hoursBack, daysBack = 30 }, context) => {
      const logger = context?.logger;
      
      // Use provided wallet address or fall back to connected wallet from context
      const effectiveWallet = walletAddress || context?.walletAddress;
      if (!effectiveWallet) {
        return {
          error: 'No wallet address provided and no wallet connected',
          message: 'Please connect your wallet or specify a wallet address.',
          suggestion: 'Connect your wallet first, then try again.'
        };
      }
      
      const wallet = effectiveWallet.toLowerCase();
      
      // Use hoursBack if provided, otherwise convert daysBack to hours
      const effectiveHours = hoursBack || (daysBack * 24);
      const periodDescription = hoursBack 
        ? `${hoursBack} hour${hoursBack !== 1 ? 's' : ''}`
        : `${daysBack} day${daysBack !== 1 ? 's' : ''}`;
      
      logger?.info?.('hypersync_get_delegation_executions', { wallet, limit, effectiveHours });
      
      try {
        // Get current block
        const currentBlock = await getCurrentBlock();
        // Calculate blocks for the time period (12s per block on Sepolia)
        const blocksBack = Math.floor((effectiveHours * 3600) / 12);
        const fromBlock = Math.max(0, currentBlock - blocksBack);
        
        // Pad wallet address to 32 bytes for topic matching
        // Event structure: topic1 = delegate (executor), topic2 = delegator (permission granter)
        const walletPadded = '0x000000000000000000000000' + wallet.slice(2);
        
        // Build query based on queryAs parameter
        let logQueries = [];
        
        if (queryAs === 'delegator' || queryAs === 'both') {
          // Query where wallet is the delegator (user/permission granter) - topic1
          logQueries.push({
            address: [DELEGATION_MANAGER_ADDRESS.toLowerCase()],
            topics: [
              [REDEEMED_DELEGATION_TOPIC],  // topic0: event signature
              [walletPadded],               // topic1: delegator (user wallet = permission granter)
              []                            // topic2: delegate (any)
            ]
          });
        }
        
        if (queryAs === 'delegate' || queryAs === 'both') {
          // Query where wallet is the delegate (backend/executor) - topic2
          logQueries.push({
            address: [DELEGATION_MANAGER_ADDRESS.toLowerCase()],
            topics: [
              [REDEEMED_DELEGATION_TOPIC],  // topic0: event signature
              [],                            // topic1: delegator (any)
              [walletPadded]                 // topic2: delegate (backend = executor)
            ]
          });
        }
        
        const query = {
          from_block: fromBlock,
          logs: logQueries,
          field_selection: {
            log: ['block_number', 'transaction_hash', 'topic0', 'topic1', 'topic2', 'data'],
            block: ['number', 'timestamp']
          }
        };

        const result = await queryHyperSync(query);
        
        // HyperSync returns data in batches - combine ALL of them
        const logs = [];
        const blockTimestamps = {};
        
        for (const batch of (result.data || [])) {
          if (batch.logs) logs.push(...batch.logs);
          if (batch.blocks) {
            for (const block of batch.blocks) {
              blockTimestamps[block.number] = block.timestamp;
            }
          }
        }
        
        logger?.info?.('delegation_query_logs_found', {
          logsCount: logs.length,
          wallet: wallet,
          queryAs: queryAs,
          period: periodDescription
        });

        if (logs.length === 0) {
          const roleDescription = queryAs === 'delegate' 
            ? 'executed by this wallet' 
            : queryAs === 'delegator' 
              ? 'using permissions granted by this wallet'
              : 'involving this wallet';
          return {
            walletAddress: wallet,
            queryAs: queryAs,
            executions: [],
            count: 0,
            message: `No delegation executions ${roleDescription} found in the last ${periodDescription}.`,
            source: 'Envio HyperSync',
            note: 'This means no transactions were executed via delegation in this period.'
          };
        }

        // Process executions
        // Event structure: topic1 = delegator (user/permission granter), topic2 = delegate (backend/executor)
        const executions = [];
        for (const log of logs.slice(-limit * 2)) {
          const delegator = parseAddressFromTopic(log.topic1);  // User's wallet
          const delegate = parseAddressFromTopic(log.topic2);   // Backend key
          const timestamp = blockTimestamps[log.block_number];
          
          executions.push({
            delegate: delegate,
            delegator: delegator,
            txHash: log.transaction_hash,
            txHashFull: log.transaction_hash, // Explicit full hash for display
            blockNumber: log.block_number,
            when: formatTimeAgo(timestamp),
            timestamp: formatTimestamp(timestamp)
          });
        }

        // Sort by block number (descending) and limit
        executions.sort((a, b) => b.blockNumber - a.blockNumber);
        const limitedExecutions = executions.slice(0, limit);
        
        // Try to get Transfer events to show what was moved
        // This gives context about what each delegation actually did
        const txHashes = [...new Set(limitedExecutions.map(e => e.txHash))];
        if (txHashes.length > 0 && txHashes.length <= 50) {
          try {
            // Query for Transfer events in these transaction blocks
            const blockNumbers = [...new Set(limitedExecutions.map(e => e.blockNumber))];
            const minBlock = Math.min(...blockNumbers);
            const maxBlock = Math.max(...blockNumbers);
            
            logger?.info?.('delegation_transfer_lookup_start', {
              txCount: txHashes.length,
              blockRange: { min: minBlock, max: maxBlock },
              sampleHash: txHashes[0]
            });
            
            // Query Transfer logs in the block range - we'll match by transaction_hash
            const transferQuery = {
              from_block: minBlock,
              to_block: maxBlock + 1,
              logs: [{
                topics: [[TRANSFER_TOPIC]]
              }],
              field_selection: {
                log: ['block_number', 'transaction_hash', 'address', 'topic1', 'topic2', 'data']
              }
            };
            
            // Note: We can't easily query native ETH transactions by hash in HyperSync
            // So we rely on Transfer events for ERC-20s, and fallback gracefully for ETH
            let ethTransactions = [];
            
            const transferResult = await queryHyperSync(transferQuery);
            const transferLogs = [];
            for (const batch of (transferResult.data || [])) {
              if (batch.logs) transferLogs.push(...batch.logs);
            }
            
            logger?.info?.('delegation_transfer_query_result', {
              transferLogsCount: transferLogs.length,
              ethTransactionsCount: ethTransactions.length,
              blockRange: { min: minBlock, max: maxBlock },
              targetTxHashes: txHashes.slice(0, 3) // Log first 3 for debugging
            });
            
            // Build a map of tx hash -> ETH value transferred (lowercase for consistent lookup)
            const txValueMap = {};
            for (const tx of ethTransactions) {
              const value = tx.value;
              if (value && value !== '0x0' && value !== '0x') {
                try {
                  const ethValue = ethers.formatEther(BigInt(value));
                  if (parseFloat(ethValue) > 0) {
                    txValueMap[tx.hash?.toLowerCase()] = {
                      ethValue,
                      to: tx.to
                    };
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
            
            // Group transfers by transaction hash (only for our target transactions)
            // Normalize to lowercase for comparison
            const txHashSetLower = new Set(txHashes.map(h => h.toLowerCase()));
            const transfersByTx = {};
            for (const tlog of transferLogs) {
              const txHash = tlog.transaction_hash?.toLowerCase();
              if (!txHash || !txHashSetLower.has(txHash)) continue; // Skip transfers not in our target txs
              
              if (!transfersByTx[txHash]) transfersByTx[txHash] = [];
              
              const tokenAddr = tlog.address?.toLowerCase();
              const tokenInfo = KNOWN_TOKENS[tokenAddr] || { symbol: 'TOKEN', decimals: 18 };
              const from = parseAddressFromTopic(tlog.topic1);
              const to = parseAddressFromTopic(tlog.topic2);
              const amount = formatAmount(tlog.data || '0x0', tokenInfo.decimals);
              
              transfersByTx[txHash].push({
                token: tokenInfo.symbol,
                tokenAddress: tokenAddr,
                from: from,
                to: to,
                amount: amount
              });
            }
            
            // Debug: Log what we found
            const matchedTxHashes = Object.keys(transfersByTx);
            const unmatchedHashes = txHashes.filter(h => !transfersByTx[h?.toLowerCase()]);
            
            // More detailed debugging
            const sampleTargetHash = txHashes[0]?.toLowerCase();
            const sampleLogHashes = transferLogs.slice(0, 5).map(l => l.transaction_hash?.toLowerCase());
            const exactMatch = sampleLogHashes.includes(sampleTargetHash);
            
            logger?.info?.('delegation_transfers_found', { 
              matchedTxCount: matchedTxHashes.length,
              unmatchedTxCount: unmatchedHashes.length,
              totalTransferLogs: transferLogs.length,
              targetTxHashCount: txHashes.length,
              sampleTargetHash: sampleTargetHash,
              sampleLogHashes: sampleLogHashes,
              exactMatch: exactMatch,
              ethTransactionsFound: ethTransactions.length,
              ethTransfersFound: Object.keys(txValueMap).length,
              // Check if any logs have matching hashes
              hashMatches: transferLogs.filter(l => txHashSetLower.has(l.transaction_hash?.toLowerCase())).length
            });
            
            // Annotate executions with transfer info
            for (const exec of limitedExecutions) {
              // Use lowercase for lookup
              const transfers = transfersByTx[exec.txHash?.toLowerCase()];
              if (transfers && transfers.length > 0) {
                // For ERC-7715 smart accounts, the Transfer 'from' is the smart account address,
                // not the EOA. So we can't match on wallet address directly.
                // Instead, if we have 2+ different tokens, it's likely a swap.
                // If we have 1 transfer, figure out direction from the 'to' address.
                
                const uniqueTokens = [...new Set(transfers.map(t => t.token))];
                
                if (uniqueTokens.length >= 2) {
                  // Likely a swap - multiple tokens involved
                  // First token sent, second token received (typically)
                  const sent = transfers[0];
                  const received = transfers.find(t => t.token !== sent.token) || transfers[1];
                  exec.action = 'swap';
                  exec.actionDescription = `Swapped ${sent.amount} ${sent.token} for ${received.amount} ${received.token}`;
                  exec.sent = `${sent.amount} ${sent.token}`;
                  exec.received = `${received.amount} ${received.token}`;
                  exec.transfers = transfers;
                } else if (transfers.length === 1) {
                  // Single token transfer - determine direction
                  const t = transfers[0];
                  // If 'to' matches delegator or wallet, it's incoming; otherwise outgoing
                  const isIncoming = (t.to === wallet || t.to === exec.delegator?.toLowerCase());
                  
                  if (isIncoming) {
                    exec.action = 'received';
                    exec.actionDescription = `Received ${t.amount} ${t.token} from ${formatAddress(t.from)}`;
                    exec.received = `${t.amount} ${t.token}`;
                    exec.sender = t.from;
                  } else {
                    // Outgoing - the 'to' is the recipient
                    exec.action = 'transfer';
                    exec.actionDescription = `Sent ${t.amount} ${t.token} to ${formatAddress(t.to)}`;
                    exec.sent = `${t.amount} ${t.token}`;
                    exec.recipient = t.to;
                  }
                  exec.transfers = transfers;
                } else {
                  // Multiple transfers of same token - use first as the main action
                  const t = transfers[0];
                  exec.action = 'transfer';
                  exec.actionDescription = `Sent ${t.amount} ${t.token} to ${formatAddress(t.to)}`;
                  exec.sent = `${t.amount} ${t.token}`;
                  exec.recipient = t.to;
                  exec.transfers = transfers;
                }
              } else {
                // No ERC-20 transfers in this transaction
                // Native ETH transfers via delegation don't emit Transfer events
                // The ETH is transferred via internal calls which aren't indexed by HyperSync
                
                // Mark as ETH transfer (most likely case for no ERC-20 events)
                exec.action = 'eth_transfer';
                exec.actionDescription = 'ETH transfer via delegation';
                exec.lookupNote = 'Native ETH transfers are not indexed - check Etherscan for details';
                
                logger?.info?.('delegation_likely_eth_transfer', {
                  txHash: exec.txHash,
                  note: 'No ERC-20 Transfer events found, likely native ETH'
                });
              }
            }
          } catch (transferErr) {
            // Log the full error for debugging
            logger?.warn?.('delegation_transfer_lookup_failed', { 
              error: transferErr.message,
              stack: transferErr.stack,
              txCount: txHashes.length,
              blockRange: { min: Math.min(...limitedExecutions.map(e => e.blockNumber)), max: Math.max(...limitedExecutions.map(e => e.blockNumber)) }
            });
            
            // Mark all as unknown if lookup failed
            for (const exec of limitedExecutions) {
              exec.action = 'unknown';
              exec.actionDescription = 'Delegation execution';
              exec.lookupNote = 'Transfer details unavailable - check block explorer';
            }
          }
        }

        const roleDescription = queryAs === 'delegate' 
          ? 'executed by this wallet (as delegate)' 
          : queryAs === 'delegator' 
            ? 'using permissions granted by this wallet (as delegator)'
            : 'involving this wallet (as delegate or delegator)';
        
        // Build a formatted summary for each execution
        const formattedExecutions = limitedExecutions.map((exec, idx) => {
          return {
            index: idx + 1,
            when: exec.when,
            timestamp: exec.timestamp,
            action: exec.action || 'unknown',
            description: exec.actionDescription || 'Delegation executed',
            sent: exec.sent,
            received: exec.received,
            recipient: exec.recipient,
            recipientShort: exec.recipient ? formatAddress(exec.recipient) : null,
            sender: exec.sender,
            senderShort: exec.sender ? formatAddress(exec.sender) : null,
            txHash: exec.txHash,
            txHashFull: exec.txHashFull || exec.txHash,
            blockNumber: exec.blockNumber,
            transfers: exec.transfers,
            lookupNote: exec.lookupNote
          };
        });
        
        // Build pre-formatted display list
        const formattedList = formattedExecutions.map((e, i) => {
          // Build a clean description
          let description;
          if (e.action === 'swap' && e.sent && e.received) {
            description = `Swapped ${e.sent} for ${e.received}`;
          } else if (e.action === 'transfer' && e.sent) {
            description = `Sent ${e.sent} to ${e.recipientShort || 'recipient'}`;
          } else if (e.action === 'eth_transfer') {
            // For ETH transfers, we may not have the exact amount
            if (e.sent) {
              description = `Sent ${e.sent} to ${e.recipientShort || 'recipient'}`;
            } else {
              description = 'ETH transfer (check Etherscan for details)';
            }
          } else if (e.action === 'received' && e.received) {
            description = `Received ${e.received} from ${e.senderShort || 'sender'}`;
          } else {
            // Fallback for other actions
            description = e.description || 'Delegation execution';
          }
          
          return `${i + 1}. ${description}\n   ${e.when}`;
        });
        
        // Build a human-readable summary
        const actionSummaries = formattedExecutions.map(e => {
          const timeStr = e.when;
          if (e.action === 'swap') {
            return `${timeStr}: Swapped ${e.sent} for ${e.received}`;
          } else if (e.action === 'transfer' || e.action === 'eth_transfer') {
            return `${timeStr}: Sent ${e.sent}`;
          } else if (e.action === 'received') {
            return `${timeStr}: Received ${e.received}`;
          } else {
            return `${timeStr}: Delegation executed`;
          }
        });
        
        // Count by action type
        const actionCounts = {
          swaps: formattedExecutions.filter(e => e.action === 'swap').length,
          transfers: formattedExecutions.filter(e => e.action === 'transfer' || e.action === 'eth_transfer').length,
          received: formattedExecutions.filter(e => e.action === 'received').length,
          other: formattedExecutions.filter(e => !['swap', 'transfer', 'eth_transfer', 'received'].includes(e.action)).length
        };
        
        // Build summary description
        const summaryParts = [];
        if (actionCounts.swaps > 0) summaryParts.push(`${actionCounts.swaps} swap${actionCounts.swaps > 1 ? 's' : ''}`);
        if (actionCounts.transfers > 0) summaryParts.push(`${actionCounts.transfers} transfer${actionCounts.transfers > 1 ? 's' : ''}`);
        if (actionCounts.received > 0) summaryParts.push(`${actionCounts.received} received`);
        if (actionCounts.other > 0) summaryParts.push(`${actionCounts.other} other`);
        const summaryText = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';
        
        // Build showToUser with full details
        const showToUserLines = formattedExecutions.map((e, i) => {
          let line = `${i + 1}. `;
          if (e.action === 'swap' && e.sent && e.received) {
            line += `Swapped ${e.sent} for ${e.received}`;
          } else if (e.action === 'transfer' && e.sent) {
            line += `Sent ${e.sent} to ${e.recipientShort || 'recipient'}`;
          } else if (e.action === 'eth_transfer') {
            line += e.sent ? `Sent ${e.sent}` : 'ETH transfer';
            if (e.recipientShort) line += ` to ${e.recipientShort}`;
          } else if (e.action === 'received' && e.received) {
            line += `Received ${e.received} from ${e.senderShort || 'sender'}`;
          } else {
            line += e.description || 'Delegation execution';
          }
          line += `\n   ${e.when}`;
          line += `\n   tx: ${e.txHashFull}`;
          return line;
        });
        
        return {
          walletAddress: wallet,
          queryAs: queryAs,
          executions: formattedExecutions,
          count: formattedExecutions.length,
          totalFound: logs.length,
          period: `Last ${periodDescription}`,
          actionCounts: actionCounts,
          // This is the main display content - show this to the user
          showToUser: showToUserLines.join('\n\n'),
          message: `Found ${formattedExecutions.length} delegation execution${formattedExecutions.length !== 1 ? 's' : ''}${summaryText} ${roleDescription}.`,
          // txHashes for frontend View buttons
          txHashes: formattedExecutions.map(e => e.txHashFull),
          source: 'Envio HyperSync',
          formattingHint: 'Display the showToUser content directly. Include the full tx hashes. Frontend adds View buttons from txHashes.'
        };

      } catch (error) {
        logger?.error?.('hypersync_delegation_query_failed', { error: error.message });
        
        return {
          walletAddress: wallet,
          error: error.message,
          message: 'Could not query delegation executions.',
          suggestion: 'HyperSync may be temporarily unavailable. Try again shortly.'
        };
      }
    }
  }
];

export default envioTools;
