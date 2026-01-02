/**
 * delegation.js - Tools for managing ERC-7715 delegation limits
 *
 * Uses MetaMask Smart Accounts Kit SDK for delegation state management.
 *
 * This module provides tools to:
 * - Check remaining spending allowance (ETH and ERC20)
 * - View delegation expiration
 * - Diagnose why a transaction might fail
 * - Request permission updates via natural language
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { Firestore } from '@google-cloud/firestore';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';

// Lazy-load heavy SDK dependencies to avoid startup issues
let viemModule = null;
let sdkModule = null;
let sdkUtilsModule = null;

async function getViem() {
  if (!viemModule) {
    viemModule = await import('viem');
  }
  return viemModule;
}

async function getViemChains() {
  const chains = await import('viem/chains');
  return chains;
}

async function getSDK() {
  if (!sdkModule) {
    sdkModule = await import('@metamask/smart-accounts-kit');
  }
  return sdkModule;
}

async function getSDKUtils() {
  if (!sdkUtilsModule) {
    sdkUtilsModule = await import('@metamask/smart-accounts-kit/utils');
  }
  return sdkUtilsModule;
}

// Cache for SDK clients (expensive to create, rarely change)
const clientCache = new Map();

let firestoreClient = null;

function getFirestore() {
  if (!firestoreClient) {
    firestoreClient = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID
    });
  }
  return firestoreClient;
}

/**
 * Get the viem chain object for a given chainId
 */
async function getViemChainObject(chainId) {
  const chains = await getViemChains();
  switch (chainId) {
    case 11155111:
      return chains.sepolia;
    case 8453:
      return chains.base;
    default:
      return chains.sepolia; // Default to Sepolia
  }
}

/**
 * Get or create a CaveatEnforcerClient for the given chainId
 * Uses the official MetaMask Smart Accounts Kit
 */
async function getCaveatEnforcerClient(chainId) {
  const cacheKey = `client_${chainId}`;
  
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
}

  const chain = await getViemChainObject(chainId);
  const rpcUrl = getRpcUrl(chainId);
  
  // Load viem and SDK
  const { createPublicClient, http } = await getViem();
  const { createCaveatEnforcerClient, getSmartAccountsEnvironment } = await getSDK();
  
  // Create viem public client
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });
  
  // Get the Smart Accounts environment for this chain
  const environment = getSmartAccountsEnvironment(chain.id);
  
  // Create the CaveatEnforcerClient
  const caveatEnforcerClient = createCaveatEnforcerClient({
    environment,
    client: publicClient
  });
  
  // Cache it
  clientCache.set(cacheKey, { caveatEnforcerClient, environment, publicClient });
  
  return { caveatEnforcerClient, environment, publicClient };
}

/**
 * Format time remaining in human-readable form
 */
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return 'expired';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Get delegation data from UserWallets collection
 * No caching - always fetch fresh from Firestore
 */
async function getDelegationDataForWallet(walletAddress, logger) {
  if (!walletAddress) return null;
  
  const normalizedAddress = walletAddress.toLowerCase();
  const db = getFirestore();
  const walletDoc = await db.collection('UserWallets').doc(normalizedAddress).get();
  
  if (!walletDoc.exists) {
    return null;
  }
  
  const walletData = walletDoc.data();
  const delegation = walletData.delegation;
  
  if (!delegation?.enabled) {
    return null;
  }
  
  return {
    walletAddress: normalizedAddress,
    delegation: {
      enabled: delegation.enabled,
      permissionsContext: delegation.permissionsContext,
      // Token-specific contexts: { "native": "0x...", "0x1c7d...": "0x..." }
      allPermissionContexts: delegation.allPermissionContexts || {},
      delegationManager: delegation.delegationManager,
      chainId: delegation.chainId,
      expiresAt: delegation.expiresAt,
      grantedAt: delegation.grantedAt,
      // Scopes stored when user granted permissions
      scopes: delegation.scopes || [],
      limits: delegation.limits || {}
    },
    chain: walletData.chain
  };
}

/**
 * Query on-chain limits using the official SDK
 * This uses CaveatEnforcerClient for reliable limit checking
 * 
 * The SDK expects a full Delegation object, which we decode from permissionsContext
 * using the SDK's decodeDelegations function.
 * 
 * IMPORTANT: Each token type has its own permissionsContext!
 * - Native token uses delegation.permissionsContext (or allPermissionContexts.native)
 * - ERC-20 tokens use allPermissionContexts[tokenAddress]
 */
async function queryOnChainLimitsWithSDK(delegation, chainId, logger) {
  const results = {
    nativeToken: null,
    erc20: {}
  };
  
  try {
    const { caveatEnforcerClient, environment } = await getCaveatEnforcerClient(chainId);
    const { decodeDelegations } = await getSDKUtils();
    
    const nativePeriodEnforcer = environment.caveatEnforcers?.NativeTokenPeriodTransferEnforcer?.toLowerCase();
    const erc20PeriodEnforcer = environment.caveatEnforcers?.ERC20PeriodTransferEnforcer?.toLowerCase();
    const erc20AmountEnforcer = environment.caveatEnforcers?.ERC20TransferAmountEnforcer?.toLowerCase();
    
    logger?.debug?.('sdk_enforcers', { nativePeriodEnforcer, erc20PeriodEnforcer, erc20AmountEnforcer });
    
    // 1. Query NATIVE token using native context
    const nativeContext = delegation.allPermissionContexts?.native || delegation.permissionsContext;
    if (nativeContext && nativeContext !== '0x') {
      try {
        const nativeDelegations = decodeDelegations(nativeContext);
        if (nativeDelegations.length > 0) {
          const nativeDelegation = nativeDelegations[0];
          const caveats = nativeDelegation.caveats || [];
          
          for (const caveat of caveats) {
            const enforcerAddr = caveat.enforcer?.toLowerCase();
            if (enforcerAddr === nativePeriodEnforcer) {
              try {
                const result = await caveatEnforcerClient.getNativeTokenPeriodTransferEnforcerAvailableAmount({
                  delegation: nativeDelegation
                });
                
                // Also decode expiration from the delegation itself
                const expirationFromDelegation = decodeExpirationFromDelegation(nativeDelegation, environment);
                
                results.nativeToken = {
                  enforcer: 'NativeTokenPeriodTransfer',
                  availableWei: result.availableAmount.toString(),
                  availableEth: ethers.formatEther(result.availableAmount),
                  isNewPeriod: result.isNewPeriod,
                  currentPeriod: result.currentPeriod?.toString(),
                  querySuccess: true,
                  source: 'sdk',
                  // Real expiration decoded from the delegation context
                  expiresAt: expirationFromDelegation,
                  expiresAtSource: expirationFromDelegation ? 'delegation_context' : null
                };
                logger?.debug?.('native_limit_query_success', { 
                  availableEth: results.nativeToken.availableEth,
                  expiresAt: expirationFromDelegation
                });
              } catch (e) {
                logger?.debug?.('native_period_query_failed', { error: e.message });
                results.nativeToken = { querySuccess: false, error: e.message, source: 'sdk' };
              }
              break;
            }
          }
        }
      } catch (e) {
        logger?.warn?.('native_context_decode_failed', { error: e.message });
      }
    }
    
    // 2. Query ERC-20 tokens using their specific contexts
    const allContexts = delegation.allPermissionContexts || {};
    for (const [tokenKey, tokenContext] of Object.entries(allContexts)) {
      // Skip 'native' - we already handled it
      if (tokenKey === 'native' || !tokenContext || tokenContext === '0x') continue;
      
      const tokenAddress = tokenKey.toLowerCase();
      logger?.debug?.('querying_erc20_context', { tokenAddress });
      
      try {
        const tokenDelegations = decodeDelegations(tokenContext);
        if (tokenDelegations.length > 0) {
          const tokenDelegation = tokenDelegations[0];
          const caveats = tokenDelegation.caveats || [];
          
          // Log what enforcers are in this token's delegation
          const caveatAddrs = caveats.map(c => c.enforcer?.toLowerCase());
          logger?.debug?.('erc20_delegation_caveats', { tokenAddress, caveats: caveatAddrs, expectedErc20Period: erc20PeriodEnforcer });
          
          for (const caveat of caveats) {
            const enforcerAddr = caveat.enforcer?.toLowerCase();
            
            // Check for ERC20PeriodTransferEnforcer
            if (enforcerAddr === erc20PeriodEnforcer) {
              try {
                const result = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({
                  delegation: tokenDelegation
                });
                
                // Find token decimals from stored scopes if available
                const scope = (delegation.scopes || []).find(s => 
                  s.tokenAddress?.toLowerCase() === tokenAddress
                );
                const decimals = scope?.decimals || 6; // Default to 6 for USDC-like tokens
                const availableRaw = result.availableAmount.toString();
                const availableFormatted = (Number(availableRaw) / Math.pow(10, decimals)).toString();
                
                // Also decode expiration from this token's delegation
                const tokenExpirationFromDelegation = decodeExpirationFromDelegation(tokenDelegation, environment);
                
                results.erc20[tokenAddress] = {
                  enforcer: 'ERC20PeriodTransfer',
                  tokenAddress,
                  tokenSymbol: scope?.tokenSymbol,
                  decimals,
                  availableUnits: availableRaw,
                  availableFormatted,
                  isNewPeriod: result.isNewPeriod,
                  currentPeriod: result.currentPeriod?.toString(),
                  querySuccess: true,
                  source: 'sdk',
                  // Real expiration decoded from this token's delegation context
                  expiresAt: tokenExpirationFromDelegation,
                  expiresAtSource: tokenExpirationFromDelegation ? 'delegation_context' : null
                };
                logger?.debug?.('erc20_period_query_success', { 
                  tokenAddress, 
                  available: availableFormatted,
                  expiresAt: tokenExpirationFromDelegation
                });
              } catch (e) {
                logger?.debug?.('erc20_period_query_failed', { tokenAddress, error: e.message });
                results.erc20[tokenAddress] = { 
                  tokenAddress,
                  querySuccess: false, 
                  error: e.message, 
                  source: 'sdk' 
                };
              }
              break; // Found the right enforcer, stop checking caveats
            }
            
            // Check for ERC20TransferAmountEnforcer (total limit, not periodic)
            const isErc20AmountEnforcer = enforcerAddr === erc20AmountEnforcer || 
              enforcerAddr === '0x1046bb45c8d673d4ea75321280db34899413c069';
            if (isErc20AmountEnforcer) {
              results.erc20AmountDetected = true;
              logger?.debug?.('erc20_amount_enforcer_detected', { tokenAddress });
            }
          }
        }
      } catch (e) {
        logger?.warn?.('erc20_context_decode_failed', { tokenAddress, error: e.message });
        results.erc20[tokenAddress] = { tokenAddress, querySuccess: false, error: e.message, source: 'sdk_decode_error' };
  }
}

    // Legacy fallback: decode main permissionsContext if allPermissionContexts is empty
    if (Object.keys(allContexts).length === 0 && delegation.permissionsContext && delegation.permissionsContext !== '0x') {
      try {
        const decodedDelegations = decodeDelegations(delegation.permissionsContext);
        if (decodedDelegations.length > 0) {
          const primaryDelegation = decodedDelegations[0];
          const caveats = primaryDelegation.caveats || [];
          
          // Track if we've tried querying ERC-20 period
          let triedErc20PeriodQuery = false;
          
          for (const caveat of caveats) {
            const enforcerAddr = caveat.enforcer?.toLowerCase();
            
            // Query Native Token Period Transfer
            if (enforcerAddr === nativePeriodEnforcer && !results.nativeToken?.querySuccess) {
              try {
                const result = await caveatEnforcerClient.getNativeTokenPeriodTransferEnforcerAvailableAmount({
                  delegation: primaryDelegation
                });
                results.nativeToken = {
                  enforcer: 'NativeTokenPeriodTransfer',
                  availableWei: result.availableAmount.toString(),
                  availableEth: ethers.formatEther(result.availableAmount),
                  isNewPeriod: result.isNewPeriod,
                  querySuccess: true,
                  source: 'sdk'
                };
              } catch (e) {
                results.nativeToken = { querySuccess: false, error: e.message, source: 'sdk' };
              }
            }
            
            // Query ERC-20 Period Transfer (legacy - single context)
            if (enforcerAddr === erc20PeriodEnforcer && !triedErc20PeriodQuery) {
              triedErc20PeriodQuery = true;
    try {
                const result = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({
                  delegation: primaryDelegation
                });
                results.erc20['period'] = {
                  enforcer: 'ERC20PeriodTransfer',
                  availableUnits: result.availableAmount.toString(),
                  isNewPeriod: result.isNewPeriod,
                  querySuccess: true,
                  source: 'sdk'
                };
    } catch (e) {
                results.erc20['period'] = { querySuccess: false, error: e.message, source: 'sdk' };
              }
            }
          }
        }
      } catch (decodeErr) {
        logger?.warn?.('legacy_delegation_decode_failed', { error: decodeErr.message });
      }
    }
    
    // Always merge stored scopes for context (SDK might not decode all enforcers)
    const scopes = delegation.scopes || [];
    
    for (const scope of scopes) {
      // Native token scopes
      if (scope.type === 'nativeTokenPeriodTransfer' && !results.nativeToken?.querySuccess) {
        results.nativeToken = {
          ...results.nativeToken,
          enforcer: 'NativeTokenPeriodTransfer',
          configuredLimit: scope.periodAmountFormatted || scope.periodAmount,
          periodDuration: scope.periodDescription,
          note: results.nativeToken?.querySuccess ? undefined : 'Using stored scope info.',
          source: results.nativeToken?.source || 'stored_scope'
        };
      }
      
      // ERC-20 total amount scopes
      if (scope.type === 'erc20TransferAmount') {
        const key = scope.tokenAddress?.toLowerCase() || scope.tokenSymbol || 'erc20';
        const existingData = results.erc20[key] || results.erc20['amount'] || {};
        results.erc20[key] = {
          ...existingData,
          enforcer: 'ERC20TransferAmount',
          tokenSymbol: scope.tokenSymbol,
          tokenAddress: scope.tokenAddress,
          decimals: scope.decimals,
          configuredLimit: scope.maxAmountFormatted || scope.maxAmount,
          availableFormatted: scope.maxAmountFormatted || scope.maxAmount, // Show configured as available (best guess)
          type: 'total',
          querySuccess: false,
          note: 'Total amount limit (not periodic). SDK cannot query spent amount. Showing configured limit.',
          source: 'stored_scope'
        };
      }
      
      // ERC-20 periodic scopes  
      if (scope.type === 'erc20PeriodTransfer') {
        const key = scope.tokenAddress?.toLowerCase() || scope.tokenSymbol || 'period';
        const existingData = results.erc20[key] || {};
        
        // Only add stored scope info if SDK didn't successfully query
        if (!existingData.querySuccess) {
          // Add token metadata from scope if not already present
          results.erc20[key] = {
            ...existingData,
            enforcer: 'ERC20PeriodTransfer',
            tokenSymbol: scope.tokenSymbol,
            tokenAddress: scope.tokenAddress,
            decimals: scope.decimals,
            configuredLimit: scope.periodAmountFormatted || scope.periodAmount,
            availableFormatted: existingData.availableFormatted || scope.periodAmountFormatted || 'unknown',
            periodDuration: scope.periodDescription,
            type: 'periodic',
            querySuccess: existingData.querySuccess || false,
            note: existingData.error ? 'SDK query failed. Showing configured limit as estimate.' : 'Using stored scope info.',
            source: existingData.source || 'stored_scope'
          };
        } else {
          // SDK query succeeded, just add missing token metadata
          results.erc20[key] = {
            ...existingData,
            tokenSymbol: existingData.tokenSymbol || scope.tokenSymbol,
            decimals: existingData.decimals || scope.decimals,
            configuredLimit: scope.periodAmountFormatted || scope.periodAmount,
            periodDuration: scope.periodDescription,
            type: 'periodic'
          };
        }
      }
    }
    
    } catch (e) {
    logger?.error?.('sdk_client_error', { error: e.message, stack: e.stack });
    results.sdkError = e.message;
    }
    
  return results;
}

/**
 * Parse permissionsContext to detect what enforcers are used
 * This is a backup when scope info isn't stored
 */
function parsePermissionsContext(permissionsContext, chainId) {
  if (!permissionsContext || permissionsContext === '0x') {
    return { parsed: false, enforcers: [] };
  }
  
  // Known enforcer signatures (first 4 bytes of function selectors or address patterns)
  const contextLower = permissionsContext.toLowerCase();
  
  const detected = {
    parsed: true,
    enforcers: [],
    hasNativeTokenLimit: false,
    hasErc20Limit: false,
    hasTimestamp: false
  };
  
  // Check for known patterns in the context
  // These are common enforcer contract address prefixes on Sepolia
  if (contextLower.includes('9bc0faf4')) {
    detected.enforcers.push('nativeTokenPeriodTransfer');
    detected.hasNativeTokenLimit = true;
  }
  if (contextLower.includes('99f2e9bf')) {
    detected.enforcers.push('nativeTokenTransferAmount');
    detected.hasNativeTokenLimit = true;
  }
  if (contextLower.includes('1046bb45')) {
    detected.enforcers.push('erc20TransferAmount');
    detected.hasErc20Limit = true;
  }
  if (contextLower.includes('de4f2fac')) {
    detected.enforcers.push('timestampEnforcer');
    detected.hasTimestamp = true;
  }
  
  return detected;
}

/**
 * Decode expiration timestamp from a delegation's TimestampEnforcer caveat
 * 
 * The TimestampEnforcer has terms that contain a uint256 timestamp (seconds since epoch)
 * This is the REAL expiration from the on-chain delegation, not stored data
 * 
 * @param delegation - Decoded delegation object with caveats
 * @param environment - SDK environment with enforcer addresses
 * @returns Unix timestamp (seconds) or null if not found
 */
function decodeExpirationFromDelegation(delegation, environment) {
  if (!delegation?.caveats) return null;
  
  const timestampEnforcer = environment?.caveatEnforcers?.TimestampEnforcer?.toLowerCase();
  if (!timestampEnforcer) return null;
  
  for (const caveat of delegation.caveats) {
    const enforcerAddr = caveat.enforcer?.toLowerCase();
    if (enforcerAddr === timestampEnforcer && caveat.terms) {
      try {
        // TimestampEnforcer terms is ABI-encoded uint256 (32 bytes)
        // Format: 0x + 64 hex chars (32 bytes) = 66 chars total
        const terms = caveat.terms;
        if (terms && terms.length >= 66) {
          // The timestamp is in the first 32 bytes (after 0x prefix)
          const timestampHex = terms.slice(0, 66);
          const timestamp = parseInt(timestampHex, 16);
          if (timestamp > 0 && timestamp < 4102444800) { // Sanity check: before year 2100
            return timestamp;
          }
        }
      } catch (e) {
        // Ignore decode errors
      }
    }
  }
  
  return null;
}

export const delegationTools = [
  {
    name: 'check_delegation_limits',
    description: `Check the remaining spending limits for a wallet's delegation.
    
Uses the official MetaMask Smart Accounts Kit to query on-chain state.
    
Shows:
- Remaining ETH allowance in current period
- Remaining ERC-20 token allowance
- Time until delegation expires
- Whether limits have been exceeded

Call this BEFORE executing transfers/swaps to verify the action won't exceed limits.
If limits are exceeded, the transaction will fail with enforcer errors.`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe('Wallet address to check'),
      token: z.string().optional()
        .describe('Specific token to check limit for (e.g., "ETH", "USDC")')
    }),
    tags: ['free', 'read', 'delegation', 'wallet'],
    handler: async ({ walletAddress, token }, context) => {
      const effectiveAddress = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!effectiveAddress) {
        throw new Error('walletAddress is required');
      }
      
      const logger = context?.logger;
      const chainId = context?.chainId || 11155111;
      const config = getChainConfig(chainId);
      
      // Get delegation data
      const delegationData = await getDelegationDataForWallet(effectiveAddress, logger);
      
      if (!delegationData) {
        return {
          walletAddress: effectiveAddress.toLowerCase(),
          delegationEnabled: false,
          message: 'No delegation registered. Cannot check limits.',
          suggestion: 'User must grant ERC-7715 permissions first.'
        };
      }
      
      const { delegation } = delegationData;
      const now = Math.floor(Date.now() / 1000);
      const isExpired = delegation.expiresAt && delegation.expiresAt < now;
      
      if (isExpired) {
        return {
          walletAddress: effectiveAddress.toLowerCase(),
          delegationEnabled: true,
          status: 'EXPIRED',
          message: 'Delegation has expired. All limits are 0.',
          expiresAt: new Date(delegation.expiresAt * 1000).toISOString(),
          suggestion: 'User needs to re-grant permissions.'
        };
      }
      
      // Query on-chain limits using the official SDK
      const onChainLimits = await queryOnChainLimitsWithSDK(delegation, chainId, logger);
      
      // Build limits result
      const limits = [];
      
      // Native token (ETH) limits
      if (onChainLimits.nativeToken) {
        const ethData = onChainLimits.nativeToken;
        // Find stored scope for period info
        const ethScope = (delegation.scopes || []).find(s => s.type === 'nativeTokenPeriodTransfer');
        
        // Prefer SDK-decoded expiration (from delegation context) over stored data
        const ethExpiresAt = ethData.expiresAt || ethScope?.expiresAt || delegation.expiresAt;
        const ethExpiresIn = ethExpiresAt ? formatTimeRemaining(ethExpiresAt - now) : null;
        const ethExpiresAtSource = ethData.expiresAtSource || 'stored';
        
        if (ethData.querySuccess) {
          limits.push({
            asset: 'ETH',
            type: 'periodic',
            enforcer: ethData.enforcer,
            // Remaining in current period
            available: ethData.availableEth,
            availableWei: ethData.availableWei,
            // Configured limit per period
            configuredLimit: ethScope?.periodAmountFormatted || ethScope?.periodAmount,
            periodDuration: ethScope?.periodDescription || ethScope?.frequency,
            // Period info from SDK
            isNewPeriod: ethData.isNewPeriod,
            currentPeriod: ethData.currentPeriod,
            source: ethData.source,
            status: parseFloat(ethData.availableEth) > 0 ? 'HAS_ALLOWANCE' : 'EXHAUSTED',
            // Per-token expiration (prefer decoded from delegation context)
            expiresAt: ethExpiresAt ? new Date(ethExpiresAt * 1000).toISOString() : null,
            expiresIn: ethExpiresIn,
            expiresAtSource: ethExpiresAtSource
          });
        } else {
          limits.push({
            asset: 'ETH',
            type: 'periodic',
            configuredLimit: ethScope?.periodAmountFormatted,
            periodDuration: ethScope?.periodDescription || ethScope?.frequency,
            querySuccess: false,
            error: ethData.error,
            note: 'Could not query ETH limit. Check scopes stored in delegation.',
            expiresAt: ethExpiresAt ? new Date(ethExpiresAt * 1000).toISOString() : null,
            expiresIn: ethExpiresIn
          });
        }
      }
      
      // ERC-20 limits
      for (const [tokenAddr, tokenData] of Object.entries(onChainLimits.erc20)) {
        // Find stored scope for this token
        const tokenScope = (delegation.scopes || []).find(s => 
          s.tokenAddress?.toLowerCase() === tokenAddr.toLowerCase()
        );
        
        // Prefer SDK-decoded expiration (from delegation context) over stored data
        const tokenExpiresAt = tokenData.expiresAt || tokenScope?.expiresAt || delegation.expiresAt;
        const tokenExpiresIn = tokenExpiresAt ? formatTimeRemaining(tokenExpiresAt - now) : null;
        const tokenExpiresAtSource = tokenData.expiresAtSource || 'stored';
        
        if (tokenData.querySuccess) {
          // Calculate available from units if not already formatted
          let available = tokenData.availableFormatted;
          if (!available && tokenData.availableUnits) {
            const decimals = tokenData.decimals || 6;
            available = (Number(tokenData.availableUnits) / Math.pow(10, decimals)).toString();
          }
          
          limits.push({
            asset: tokenData.tokenSymbol || tokenScope?.tokenSymbol || 'ERC20',
            tokenAddress: tokenData.tokenAddress || tokenAddr,
            type: tokenData.enforcer?.includes('Period') ? 'periodic' : 'total',
            enforcer: tokenData.enforcer,
            // Remaining in current period
            available,
            availableUnits: tokenData.availableUnits,
            decimals: tokenData.decimals,
            // Configured limit per period
            configuredLimit: tokenScope?.periodAmountFormatted || tokenScope?.periodAmount,
            periodDuration: tokenScope?.periodDescription || tokenScope?.frequency,
            // Period info from SDK
            isNewPeriod: tokenData.isNewPeriod,
            currentPeriod: tokenData.currentPeriod,
            source: tokenData.source,
            status: parseFloat(available || '0') > 0 ? 'HAS_ALLOWANCE' : 'EXHAUSTED',
            // Per-token expiration (prefer decoded from delegation context)
            expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt * 1000).toISOString() : null,
            expiresIn: tokenExpiresIn,
            expiresAtSource: tokenExpiresAtSource
          });
        } else if (tokenData.availableFormatted || tokenData.configuredLimit) {
          // Fallback: show configured limit when live query failed
          limits.push({
            asset: tokenData.tokenSymbol || 'ERC20',
            tokenAddress: tokenData.tokenAddress || tokenAddr,
            type: tokenData.type || 'periodic',
            enforcer: tokenData.enforcer,
            available: tokenData.availableFormatted || tokenData.configuredLimit,
            configuredLimit: tokenData.configuredLimit,
            decimals: tokenData.decimals,
            source: tokenData.source,
            querySuccess: false,
            note: tokenData.note || 'Live query failed. Showing configured limit.',
            status: 'UNKNOWN',
            expiresAt: tokenExpiresAt ? new Date(tokenExpiresAt * 1000).toISOString() : null,
            expiresIn: tokenExpiresIn
          });
        } else {
          limits.push({
            asset: tokenData.tokenSymbol || tokenAddr,
            tokenAddress: tokenData.tokenAddress || tokenAddr,
            querySuccess: false,
            error: tokenData.error,
            note: 'Could not query ERC-20 limit.'
          });
        }
      }
      
      // No limits detected
      if (limits.length === 0) {
        // Check if we have stored scopes but couldn't query
        const scopes = delegation.scopes || [];
        if (scopes.length > 0) {
          return {
            walletAddress: effectiveAddress.toLowerCase(),
        delegationEnabled: true,
        chain: config.name,
            status: 'LIMITS_UNKNOWN',
            message: 'Could not query on-chain limits. Scopes are configured but SDK query failed.',
            storedScopes: scopes.map(s => ({ type: s.type, token: s.tokenSymbol })),
            sdkError: onChainLimits.sdkError,
            suggestion: 'Try a small test transaction to verify limits.'
          };
        }
        
        return {
          walletAddress: effectiveAddress.toLowerCase(),
          delegationEnabled: true,
          chain: config.name,
          status: 'NO_LIMITS_CONFIGURED',
          message: 'No spending limit scopes detected in this delegation.',
          suggestion: 'User may need to re-grant permissions with specific scopes.'
        };
      }
      
      // Build summary message
      const summaryParts = limits
        .filter(l => l.available)
        .map(l => `${l.asset}: ${l.available} available`);
      
      // Build per-token limit details for display
      const limitDetails = limits.map(l => {
        let line = `${l.asset}: ${l.available || l.configuredLimit} ${l.periodDuration || ''}`;
        if (l.expiresIn) {
          line += ` (expires in ${l.expiresIn})`;
        }
        return line;
      });
      
      // Check if tokens have different expiration dates
      const expirations = limits.filter(l => l.expiresIn).map(l => ({ asset: l.asset, expiresIn: l.expiresIn, expiresAt: l.expiresAt }));
      const hasMultipleExpirations = expirations.length > 1 && 
        new Set(expirations.map(e => e.expiresIn)).size > 1;
      
      // Build showToUser with per-token expiration
      let showToUser = `**Delegation Limits**\n\n`;
      for (const limit of limits) {
        showToUser += `**${limit.asset}:** ${limit.available || limit.configuredLimit} available`;
        if (limit.periodDuration) showToUser += ` ${limit.periodDuration}`;
        if (limit.expiresIn) showToUser += `\n  Expires: ${limit.expiresIn}`;
        showToUser += `\n\n`;
      }
      
      if (hasMultipleExpirations) {
        showToUser += `Note: Each token has a different expiration date.`;
      }
      
      return {
        walletAddress: effectiveAddress.toLowerCase(),
        delegationEnabled: true,
        chain: config.name,
        status: 'ACTIVE',
        
        // Limits from SDK (each with its own expiresAt/expiresIn)
        limits,
        
        // Master timing (latest expiration across all tokens)
        expiresAt: delegation.expiresAt 
          ? new Date(delegation.expiresAt * 1000).toISOString() 
          : 'Never',
        expiresIn: delegation.expiresAt
          ? formatTimeRemaining(delegation.expiresAt - now)
          : 'never',
        
        // Per-token expiration summary
        perTokenExpiration: expirations,
        hasMultipleExpirations,
        
        // Summary message
        message: summaryParts.length > 0 
          ? summaryParts.join(', ')
          : 'Limits queried but amounts unclear.',
        
        // Pre-formatted output for LLM to display
        showToUser,
        
        // Source info
        source: 'MetaMask Smart Accounts Kit SDK',
        
        // Tips
        tips: [
          'Available amount is what can still be spent in current period.',
          'If available is 0, wait for period to reset or update limits in the app.'
        ]
      };
    }
  },
  
  {
    name: 'diagnose_delegation_error',
    description: `Diagnose why a delegation transaction failed.
    
Common errors:
- "transfer-amount-exceeded": Spending limit reached
- "delegation-expired": Need to re-grant permissions
- "invalid-delegation": Permission context is invalid

Use this after a failed transaction to understand the cause and explain to user.`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      errorMessage: z.string().describe('The error message from the failed transaction')
    }),
    tags: ['free', 'read', 'delegation', 'wallet'],
    handler: async ({ walletAddress, errorMessage }, context) => {
      const effectiveAddress = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      const logger = context?.logger;
      const chainId = context?.chainId || 11155111;
      
      // Known error patterns and their meanings
      const errorPatterns = [
        {
          pattern: /NativeTokenPeriodTransferEnforcer.*transfer-amount-exceeded/i,
          diagnosis: 'NATIVE_TOKEN_LIMIT_EXCEEDED',
          meaning: 'The native ETH transfer amount exceeded the per-period spending limit.',
          userExplanation: 'Your daily ETH spending limit has been reached.',
          solution: 'Wait for the next period to reset, or ask user to grant higher limits.',
          scope: 'Native ETH transfers'
        },
        {
          pattern: /transfer-amount-exceeded/i,
          diagnosis: 'LIMIT_EXCEEDED',
          meaning: 'The transfer amount exceeded the configured spending limit.',
          userExplanation: 'The amount you\'re trying to send exceeds your current spending limit.',
          solution: 'Try a smaller amount, wait for period reset, or grant new permissions with higher limits.',
          scope: 'Transfers'
        },
        {
          pattern: /ERC20TransferAmount.*transfer-amount-exceeded/i,
          diagnosis: 'ERC20_LIMIT_EXCEEDED',
          meaning: 'The ERC-20 token transfer amount exceeded the total spending limit.',
          userExplanation: 'Your token spending limit has been reached for this token.',
          solution: 'User needs to grant new permissions with higher ERC-20 limits.',
          scope: 'ERC-20 token transfers (USDC, etc.)'
        },
        {
          pattern: /delegation.*expired|expired.*delegation/i,
          diagnosis: 'DELEGATION_EXPIRED',
          meaning: 'The delegation permission has expired.',
          userExplanation: 'Your spending permissions have expired.',
          solution: 'User must re-grant ERC-7715 permissions via the frontend.',
          scope: 'All delegation actions'
        },
        {
          pattern: /invalid.*delegation|delegation.*invalid/i,
          diagnosis: 'INVALID_DELEGATION',
          meaning: 'The stored permission context is invalid or doesn\'t match on-chain state.',
          userExplanation: 'There\'s an issue with your stored permissions.',
          solution: 'User should revoke and re-grant permissions.',
          scope: 'All delegation actions'
        },
        {
          pattern: /unauthorized|not.*authorized/i,
          diagnosis: 'UNAUTHORIZED_DELEGATE',
          meaning: 'The backend key is not authorized as a delegate for this wallet.',
          userExplanation: 'The agent isn\'t authorized to act on your behalf.',
          solution: 'User must grant permissions to the correct backend delegate address.',
          scope: 'All delegation actions'
        },
        {
          pattern: /timestamp.*enforcer/i,
          diagnosis: 'TIMESTAMP_CONSTRAINT',
          meaning: 'The transaction violates a time-based constraint.',
          userExplanation: 'This action is outside the allowed time window.',
          solution: 'Check if the delegation has time windows when actions are allowed.',
          scope: 'Time-constrained actions'
        },
        {
          pattern: /ExactCalldataEnforcer.*invalid-calldata/i,
          diagnosis: 'INVALID_CALLDATA',
          meaning: 'The transaction calldata does not match what was permitted in the delegation. This typically means the delegation was granted for specific function calls (like swaps or specific transfers) but not for the action being attempted.',
          userExplanation: 'Your current permissions don\'t cover this specific action. The delegation may have been set up for different operations (like swaps) but not for direct token transfers, or the token/recipient is not in the allowed list.',
          solution: 'Revoke current permissions and grant new ones that include the specific action you want to perform. Make sure to select the correct permission type (e.g., ERC-20 periodic transfer for USDC transfers).',
          scope: 'Specific function calls and calldata'
        },
        {
          pattern: /AllowedCalldataEnforcer/i,
          diagnosis: 'CALLDATA_NOT_ALLOWED',
          meaning: 'The transaction calldata is not in the allowed list of permitted actions.',
          userExplanation: 'This specific action is not in your list of allowed operations.',
          solution: 'Grant new permissions that include this action type.',
          scope: 'Allowed actions list'
        },
        {
          pattern: /AllowedTargetsEnforcer/i,
          diagnosis: 'TARGET_NOT_ALLOWED',
          meaning: 'The target contract address is not in the allowed list.',
          userExplanation: 'The contract or token you\'re trying to interact with is not in your allowed list.',
          solution: 'Grant new permissions that include this token or contract.',
          scope: 'Allowed contract addresses'
        },
        {
          pattern: /ERC20PeriodTransferEnforcer.*transfer-amount-exceeded/i,
          diagnosis: 'ERC20_PERIOD_LIMIT_EXCEEDED',
          meaning: 'The ERC-20 periodic spending limit has been reached for this period.',
          userExplanation: 'You\'ve reached your periodic spending limit for this token. Your limit will reset at the start of the next period.',
          solution: 'Wait for the period to reset, try a smaller amount, or grant new permissions with higher limits.',
          scope: 'ERC-20 periodic token transfers'
        }
      ];
      
      // Find matching error pattern
      let diagnosis = null;
      for (const pattern of errorPatterns) {
        if (pattern.pattern.test(errorMessage)) {
          diagnosis = pattern;
          break;
        }
      }
      
      // Get delegation status for additional context
      let delegationStatus = null;
      let availableLimits = null;
      
      if (effectiveAddress) {
        try {
          const delegationData = await getDelegationDataForWallet(effectiveAddress, logger);
          if (delegationData) {
            const { delegation } = delegationData;
            const now = Math.floor(Date.now() / 1000);
            delegationStatus = {
              enabled: true,
              isExpired: delegation.expiresAt && delegation.expiresAt < now,
              expiresAt: delegation.expiresAt 
                ? new Date(delegation.expiresAt * 1000).toISOString() 
            : null,
              expiresIn: delegation.expiresAt && delegation.expiresAt > now
                ? formatTimeRemaining(delegation.expiresAt - now)
                : 'expired'
            };
            
            // Also query current limits to show what's left
            try {
              const limits = await queryOnChainLimitsWithSDK(delegation, chainId, logger);
              availableLimits = limits;
            } catch (e) {
              logger?.debug?.('limit_query_in_diagnosis_failed', { error: e.message });
            }
          }
        } catch (e) {
          logger?.warn?.('diagnosis_delegation_fetch_failed', { error: e.message });
        }
      }
      
      if (diagnosis) {
        // Build available limits summary - check BOTH native and ERC-20
        const limitsInfo = [];
        if (availableLimits?.nativeToken?.availableEth) {
          limitsInfo.push(`ETH remaining: ${availableLimits.nativeToken.availableEth}`);
        }
        // Fix: Use erc20 not tokens!
        if (availableLimits?.erc20) {
          for (const [tokenAddr, tokenData] of Object.entries(availableLimits.erc20)) {
            if (tokenData.availableFormatted || tokenData.availableUnits) {
              const symbol = tokenData.tokenSymbol || 'Token';
              const available = tokenData.availableFormatted || tokenData.availableUnits;
              limitsInfo.push(`${symbol} remaining: ${available}`);
            }
          }
        }
        
        // Build limits object with both ETH and ERC-20
        const allLimits = {};
        if (availableLimits?.nativeToken?.availableEth) {
          allLimits.eth = availableLimits.nativeToken.availableEth;
        }
        if (availableLimits?.erc20) {
          for (const [tokenAddr, tokenData] of Object.entries(availableLimits.erc20)) {
            const symbol = tokenData.tokenSymbol || tokenAddr.slice(0, 10);
            allLimits[symbol] = tokenData.availableFormatted || tokenData.availableUnits;
          }
        }
        
        return {
          errorMessage,
          diagnosis: diagnosis.diagnosis,
          meaning: diagnosis.meaning,
          userExplanation: diagnosis.userExplanation,
          solution: diagnosis.solution,
          affectedScope: diagnosis.scope,
          delegationStatus,
          availableLimits: Object.keys(allLimits).length > 0 ? allLimits : null,
          
          // Actionable next steps for the LLM to suggest
          nextSteps: getNextSteps(diagnosis.diagnosis),
          
          // Pre-formatted summary for LLM to display
          showToUser: `**Transfer Failed**

**Reason:** ${diagnosis.userExplanation}

**What happened:** ${diagnosis.meaning}
${limitsInfo.length > 0 ? `\n**Current Limits:**\n${limitsInfo.map(l => `- ${l}`).join('\n')}` : ''}
${delegationStatus?.expiresIn ? `\n**Delegation expires in:** ${delegationStatus.expiresIn}` : ''}

**How to fix:**
${diagnosis.solution}

**Next steps:**
${getNextSteps(diagnosis.diagnosis).map(s => `- ${s}`).join('\n')}`
        };
      }
      
      // Unknown error
      return {
        errorMessage,
        diagnosis: 'UNKNOWN',
        meaning: 'The error doesn\'t match known delegation error patterns.',
        userExplanation: 'Something unexpected went wrong with the transaction.',
        possibleCauses: [
          'Network/RPC issues',
          'Gas estimation failure',
          'Contract-specific revert',
          'Malformed transaction data'
        ],
        delegationStatus,
        suggestion: 'Try again with a smaller amount, or check if the action is supported.'
      };
    }
  }
];

/**
 * Get actionable next steps based on diagnosis
 */
function getNextSteps(diagnosis) {
  const steps = {
    NATIVE_TOKEN_LIMIT_EXCEEDED: [
      'Try a smaller amount that fits within remaining allowance',
      'Wait for the period to reset (check when limit refreshes)',
      'Grant new permissions with a higher ETH limit'
    ],
    LIMIT_EXCEEDED: [
      'Check your remaining allowance with check_delegation_limits',
      'Try a smaller amount',
      'Wait for the period to reset or grant new permissions'
    ],
    INVALID_CALLDATA: [
      'Revoke current permissions in the app settings',
      'Grant new permissions that explicitly include the action you want',
      'For USDC transfers, make sure to select "ERC-20 periodic transfer" permission type'
    ],
    CALLDATA_NOT_ALLOWED: [
      'Check what actions are currently permitted',
      'Grant new permissions that include this specific action'
    ],
    TARGET_NOT_ALLOWED: [
      'Grant new permissions that include this token/contract',
      'Check if the token address is correct'
    ],
    ERC20_PERIOD_LIMIT_EXCEEDED: [
      'Wait for the period to reset (check your limit refresh time)',
      'Try a smaller amount that fits within remaining allowance',
      'Grant new permissions with a higher periodic limit'
    ],
    ERC20_LIMIT_EXCEEDED: [
      'Grant new permissions with higher token limits',
      'Try a smaller token amount',
      'Check if the token is included in your permissions'
    ],
    DELEGATION_EXPIRED: [
      'Grant new permissions via "update my delegation"',
      'Choose a longer expiration period this time'
    ],
    INVALID_DELEGATION: [
      'Revoke current permissions',
      'Grant fresh permissions'
    ],
    UNAUTHORIZED_DELEGATE: [
      'Ensure you granted permissions to the correct delegate',
      'Re-grant permissions if needed'
    ],
    TIMESTAMP_CONSTRAINT: [
      'Try again during allowed hours',
      'Grant new permissions without time restrictions'
    ]
  };
  
  return steps[diagnosis] || ['Try again or grant new permissions'];
}

/**
 * Pre-check limits before executing a transaction
 * Uses the SDK to query on-chain state and compare against requested amount
 */
export async function checkLimitsBeforeTransaction(walletAddress, token, amountWei, chainId, logger) {
  // Get delegation data
  const delegationData = await getDelegationDataForWallet(walletAddress, logger);
  
  if (!delegationData) {
    return { 
      canProceed: false, 
      reason: 'No delegation registered' 
    };
  }
  
  const { delegation } = delegationData;
      const now = Math.floor(Date.now() / 1000);
      
  // Check expiration
  if (delegation.expiresAt && delegation.expiresAt < now) {
      return {
      canProceed: false, 
      reason: 'Delegation expired',
      expiresAt: new Date(delegation.expiresAt * 1000).toISOString()
    };
  }
  
  // Query actual limits from SDK
  try {
    const limits = await queryOnChainLimitsWithSDK(delegation, chainId, logger);
    
    const isEth = !token || token.toUpperCase() === 'ETH';
    
    if (isEth && limits.nativeToken?.querySuccess) {
      const availableWei = BigInt(limits.nativeToken.availableWei);
      const requestedWei = BigInt(amountWei);
      
      if (requestedWei > availableWei) {
        return {
          canProceed: false,
          reason: 'Amount exceeds available ETH allowance',
          requested: ethers.formatEther(amountWei),
          available: limits.nativeToken.availableEth,
          isNewPeriod: limits.nativeToken.isNewPeriod,
          currentPeriod: limits.nativeToken.currentPeriod
        };
      }
      
      return {
        canProceed: true,
        available: limits.nativeToken.availableEth,
        requested: ethers.formatEther(amountWei),
        remainingAfter: ethers.formatEther(availableWei - requestedWei)
      };
    }
    
    // For ERC-20, check if we have limit info
    if (!isEth) {
      // Check if we have ERC-20 limit data
      const erc20Limits = Object.values(limits.erc20);
      if (erc20Limits.length > 0 && erc20Limits[0]?.querySuccess) {
        const available = BigInt(erc20Limits[0].availableUnits);
        const requested = BigInt(amountWei);
        
        if (requested > available) {
          return {
            canProceed: false,
            reason: `Amount exceeds available ${token || 'token'} allowance`,
            available: erc20Limits[0].availableUnits
          };
        }
        
        return {
          canProceed: true,
          available: erc20Limits[0].availableUnits
        };
      }
      
      return {
        canProceed: true,
        warning: 'ERC-20 limit check not available. Transaction may fail if limit exceeded.'
      };
    }
    
  } catch (e) {
    logger?.warn?.('pre_check_failed', { error: e.message });
  }
  
  return {
    canProceed: true,
    warning: 'Could not verify exact limits via SDK. Transaction may fail if limit exceeded.'
  };
}
