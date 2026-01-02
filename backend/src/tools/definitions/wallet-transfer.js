/**
 * wallet-transfer.js - Tools for transferring tokens from wallet
 *
 * Direct wallet automation via ERC-7715 delegation
 * - Transfers execute directly via ERC20.transfer() through delegation
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';
import { formatGasForOutput, getGasPriceForTier } from './gas.js';

// ERC20 ABI for transfers
const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
];

// Token metadata by chain
const BASE_TOKEN_METADATA = {
  'ETH': { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  'WETH': { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  'USDC': { symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6 },
  'USDT': { symbol: 'USDT', address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', decimals: 6 },
  'DAI': { symbol: 'DAI', address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', decimals: 18 },
};

const SEPOLIA_TOKEN_METADATA = {
  'ETH': { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  'WETH': { symbol: 'WETH', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  'USDC': { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
};

function getTokenMetadataForChain(chainId = null) {
  const config = getChainConfig(chainId);
  if (config.chainId === 11155111) return SEPOLIA_TOKEN_METADATA;
  return BASE_TOKEN_METADATA;
}

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

function isHexAddress(value) {
  return typeof value === 'string' && value.startsWith('0x') && value.length === 42;
}

function isENSName(value) {
  return typeof value === 'string' && value.endsWith('.eth');
}

function checksumAddress(address) {
  if (!address) return address;
  try { return ethers.getAddress(address); } catch { return address; }
}

/**
 * Resolve ENS name to address
 * Note: Sepolia has its own ENS registry - mainnet names don't work there
 * For Sepolia testing, use the mainnet provider to resolve, then use the address on Sepolia
 */
async function resolveENSName(ensName, chainId = null, logger = null) {
  if (!isENSName(ensName)) return null;
  
  try {
    // Always resolve against mainnet ENS (even for testnets)
    // This allows using mainnet names like "vitalik.eth" on any chain
    const mainnetRpc = 'https://eth.llamarpc.com'; // Free public mainnet RPC
    const mainnetProvider = new ethers.JsonRpcProvider(mainnetRpc);
    
    logger?.info?.('resolving_ens', { ensName });
    const address = await mainnetProvider.resolveName(ensName);
    
    if (address) {
      logger?.info?.('ens_resolved', { ensName, address });
      return checksumAddress(address);
    }
    
    logger?.warn?.('ens_not_found', { ensName });
    return null;
  } catch (error) {
    logger?.warn?.('ens_resolution_failed', { ensName, error: error.message });
    return null;
  }
}

function normalizeAmountString(amount, decimals) {
  if (amount == null) throw new Error('Amount is required');
  let text = String(amount).trim().replace(/,/g, '').replace(/_/g, '');
  if (text.startsWith('+')) text = text.slice(1);
  if (text.startsWith('-')) throw new Error('Amount must be positive');
  if (!/^((\d+\.?\d*)|(\.\d+))$/.test(text)) throw new Error('Amount must be a numeric string');
  
  if (!text.includes('.')) return text;
  const [whole, frac = ''] = text.split('.');
  const safeFrac = frac.slice(0, decimals);
  return safeFrac ? `${whole || '0'}.${safeFrac}` : (whole || '0');
}

async function getTokenInfo(symbolOrAddress, chainId = null) {
  if (!symbolOrAddress) throw new Error('Token symbol or address required');
  
  const TOKEN_METADATA = getTokenMetadataForChain(chainId);
  
  if (isHexAddress(symbolOrAddress)) {
    const lower = symbolOrAddress.toLowerCase();
    const known = Object.values(TOKEN_METADATA).find(m => m.address.toLowerCase() === lower);
    if (known) return { ...known, address: checksumAddress(known.address) };
    
    const provider = getProvider(chainId);
    const contract = new ethers.Contract(symbolOrAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18)
    ]);
    return { symbol, address: checksumAddress(symbolOrAddress), decimals: Number(decimals) };
  }
  
  const upper = symbolOrAddress.toUpperCase();
  const meta = TOKEN_METADATA[upper];
  if (meta) return { ...meta, address: checksumAddress(meta.address) };
  
  const config = getChainConfig(chainId);
  throw new Error(`Unknown token: ${symbolOrAddress} on ${config.name}. Use contract address for unlisted tokens.`);
}

export const walletTransferTools = [
  {
    name: 'transfer_funds',
    description: `Transfer tokens or ETH from the wallet to another address. Uses ERC-7715 delegation.

Gas tiers available:
- slow: Cheapest, 1-5 min confirmation
- standard: Balanced (default)
- fast: Fastest, higher cost

The output includes gas cost estimates. User can say "use faster gas" or "use slow gas" to change tier.`,
    parameters: z.object({
      recipient: z.string().describe('Recipient address (0x...) or ENS name (e.g., vitalik.eth)'),
      token: z.string().describe('Token to transfer (symbol like "ETH" or "USDC", or address)'),
      amount: z.string().describe('Amount to transfer (e.g., "0.5" for 0.5 ETH)'),
      walletAddress: z.string().optional().describe('Wallet to transfer from (defaults to connected wallet)'),
      simulate: z.boolean().default(true).describe('If true, only simulate without executing'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Gas speed tier: slow (cheapest), standard (balanced), fast (fastest)')
    }),
    tags: ['tx', 'write'],
    handler: async ({ recipient, token, amount, walletAddress, simulate = true, gasTier = 'standard' }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }
      
      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);
      const logger = context?.logger;
      
      // Resolve recipient - could be 0x address or ENS name
      let resolvedRecipient = recipient;
      let ensName = null;
      
      if (isENSName(recipient)) {
        ensName = recipient;
        resolvedRecipient = await resolveENSName(recipient, chainId, logger);
        if (!resolvedRecipient) {
          throw new Error(`Could not resolve ENS name: ${recipient}. Make sure the name exists on mainnet.`);
        }
      } else if (!isHexAddress(recipient)) {
        throw new Error('Valid recipient address (0x...) or ENS name (.eth) is required');
      }
      
      const tokenInfo = await getTokenInfo(token, chainId);
      const normalizedAmount = normalizeAmountString(amount, tokenInfo.decimals);
      const amountWei = ethers.parseUnits(normalizedAmount, tokenInfo.decimals);
      
      const isEth = tokenInfo.address === '0x0000000000000000000000000000000000000000';
      
      // Check balance
      let currentBalance;
      if (isEth) {
        currentBalance = await provider.getBalance(address);
      } else {
        const tokenContract = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider);
        currentBalance = await tokenContract.balanceOf(address);
      }
      
      if (currentBalance < amountWei) {
        const currentFormatted = ethers.formatUnits(currentBalance, tokenInfo.decimals);
        throw new Error(
          `Insufficient ${tokenInfo.symbol} balance. ` +
          `Requested: ${normalizedAmount}, Available: ${currentFormatted}`
        );
      }
      
      // Get gas estimate for the transfer type
      const txType = isEth ? 'ethTransfer' : 'erc20Transfer';
      const gasEstimate = await formatGasForOutput(txType, gasTier, chainId);
      
      if (simulate) {
        return {
          simulation: true,
          walletAddress: address,
          recipient: checksumAddress(resolvedRecipient),
          recipientENS: ensName, // Original ENS name if used
          token: tokenInfo.symbol,
          tokenAddress: tokenInfo.address,
          amount: normalizedAmount,
          amountWei: amountWei.toString(),
          chain: config.name,
          
          // Gas info (real on-chain estimate)
          gas: {
            tier: gasTier,
            tierName: gasEstimate.gasTierName,
            costEth: gasEstimate.gasCostEth,
            costUsd: gasEstimate.gasCostUsd,
            confirmationTime: gasEstimate.confirmationTime,
            allTiers: gasEstimate.allTiers
          },
          
          message: `Transfer simulation successful. Gas: ${gasEstimate.formatted}. Set simulate=false to execute.`,
          tip: 'Say "use faster gas" or "use slow gas" to change speed tier.'
        };
      }
      
      // Execute via delegation
      const { SignerDriver } = await import('../../lib/signer.js');
      const { ensureGas } = await import('../../lib/gasSponsor.js');
      
      const driver = new SignerDriver({ provider, logger: context?.logger });
      const signer = await driver.getSignerForWallet(address);
      
      // Sponsor gas if backend wallet is low
      const signerAddress = await signer.getAddress();
      const gasResult = await ensureGas(signerAddress, provider, context?.logger);
      if (gasResult.sponsored) {
        context?.logger?.info?.('gas_sponsored_for_transfer', gasResult);
      }
      
      // Get gas settings for the selected tier
      const gasSettings = await getGasPriceForTier(gasTier, chainId);
      
      let receipt;
      
      if (isEth) {
        // Native ETH transfer
        context?.logger?.info?.('executing_eth_transfer', { 
          to: resolvedRecipient, 
          ensName,
          amount: normalizedAmount,
          gasTier
        });
        
        receipt = await signer.sendTransactionWithDelegation({
          to: resolvedRecipient,
          data: '0x',
          value: amountWei,
          maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
          maxFeePerGas: gasSettings.maxFeePerGas
        });
      } else {
        // ERC20 transfer
        context?.logger?.info?.('executing_token_transfer', { 
          token: tokenInfo.symbol,
          to: resolvedRecipient, 
          ensName,
          amount: normalizedAmount,
          gasTier
        });
        
        const tokenContract = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider);
        const transferData = tokenContract.interface.encodeFunctionData('transfer', [
          resolvedRecipient,
          amountWei
        ]);
        
        // Pass tokenAddress in options to use the correct permission context
        receipt = await signer.sendTransactionWithDelegation({
          to: tokenInfo.address,
          data: transferData,
          value: 0n,
          maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
          maxFeePerGas: gasSettings.maxFeePerGas
        }, { tokenAddress: tokenInfo.address });
      }
      
      // Get actual gas used for reporting
      const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown';
      const effectiveGasPrice = receipt.effectiveGasPrice 
        ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei'
        : 'unknown';
      
      // Format recipient display (show ENS if available)
      const recipientDisplay = ensName 
        ? `${ensName} (${resolvedRecipient.slice(0, 6)}...${resolvedRecipient.slice(-4)})`
        : `${resolvedRecipient.slice(0, 6)}...${resolvedRecipient.slice(-4)}`;
      
      return {
        success: true,
        txHash: receipt.hash || receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        walletAddress: address,
        recipient: checksumAddress(resolvedRecipient),
        recipientENS: ensName, // Original ENS name if used
        token: tokenInfo.symbol,
        amount: normalizedAmount,
        amountWei: amountWei.toString(),
        chain: config.name,
        explorerUrl: `${config.explorer}/tx/${receipt.hash || receipt.transactionHash}`,
        
        // Gas info
        gas: {
          tier: gasTier,
          gasUsed,
          effectiveGasPrice
        },
        
        message: `Successfully transferred ${normalizedAmount} ${tokenInfo.symbol} to ${recipientDisplay}`
      };
    }
  },
  
  // Preview tool - shows as a distinct tool call for simulations
  {
    name: 'preview_transfer',
    description: `Preview a transfer without executing it. Shows gas costs and validates the transfer will succeed.
Use this for showing users a transfer summary before they confirm.
After user confirms, call transfer_funds with simulate=false to execute.
Supports ENS names (e.g., vitalik.eth) - will resolve to address via mainnet.`,
    parameters: z.object({
      recipient: z.string().describe('Recipient address (0x...) or ENS name (e.g., vitalik.eth)'),
      token: z.string().describe('Token to transfer (symbol like "ETH" or "USDC", or address)'),
      amount: z.string().describe('Amount to transfer (e.g., "0.5" for 0.5 ETH)'),
      walletAddress: z.string().optional().describe('Wallet to transfer from (defaults to connected wallet)'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Gas speed tier: slow (cheapest), standard (balanced), fast (fastest)')
    }),
    tags: ['free', 'read'], // Preview is free, only execution costs
    handler: async ({ recipient, token, amount, walletAddress, gasTier = 'standard' }, context) => {
      // Delegate to transfer_funds with simulate=true
      const transferHandler = walletTransferTools[0].handler;
      return transferHandler(
        { recipient, token, amount, walletAddress, simulate: true, gasTier },
        context
      );
    }
  }
];

