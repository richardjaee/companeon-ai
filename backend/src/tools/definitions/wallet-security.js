/**
 * wallet-security.js - Security assessment tools for wallet transfers
 * 
 * Provides pre-transfer security checks including:
 * - GoPlus Security API integration (free tier - scam/phishing detection)
 * - Recipient address risk assessment
 * - Previous interaction history
 * - Contract vs EOA detection
 * - Known address labels (exchanges, protocols)
 * - Risk level calculation with recommendations
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import axios from 'axios';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';

// GoPlus Security API - FREE tier
// Docs: https://docs.gopluslabs.io/reference/api-overview
const GOPLUS_API_BASE = 'https://api.gopluslabs.io/api/v1';

// Map our chain IDs to GoPlus chain IDs
const GOPLUS_CHAIN_IDS = {
  1: '1',        // Ethereum Mainnet
  8453: '8453',  // Base
  11155111: '11155111', // Sepolia (may not be supported)
  84532: '84532' // Base Sepolia (may not be supported)
};

// Envio HyperSync endpoints by chain
const HYPERSYNC_URLS = {
  1: 'https://eth.hypersync.xyz',
  8453: 'https://base.hypersync.xyz',
  11155111: 'https://sepolia.hypersync.xyz',
  84532: 'https://base-sepolia.hypersync.xyz'
};

// ERC20 Transfer event topic
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Known protocol/exchange addresses (lowercase)
const KNOWN_ADDRESSES = {
  // Exchanges
  '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance Hot Wallet', type: 'exchange', trusted: true },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance', type: 'exchange', trusted: true },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { label: 'Coinbase', type: 'exchange', trusted: true },
  '0x503828976d22510aad0201ac7ec88293211d23da': { label: 'Coinbase', type: 'exchange', trusted: true },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { label: 'Coinbase', type: 'exchange', trusted: true },
  '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640': { label: 'Uniswap V3 USDC/ETH Pool', type: 'protocol', trusted: true },
  
  // Base-specific
  '0x4200000000000000000000000000000000000006': { label: 'WETH (Canonical)', type: 'token', trusted: true },
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { label: 'USDC (Circle)', type: 'token', trusted: true },
};

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

/**
 * Check for native ETH transfers using Envio HyperSync
 * This queries actual transactions (not logs) to find ETH sent from wallet to recipient
 */
async function checkEnvioNativeTransfers(walletAddress, recipientAddress, chainId, logger) {
  const hypersyncUrl = HYPERSYNC_URLS[chainId];
  if (!hypersyncUrl) {
    return null;
  }
  
  const envioApiKey = process.env.ENVIO_API_KEY;
  const headers = { 'Content-Type': 'application/json' };
  if (envioApiKey) {
    headers['Authorization'] = `Bearer ${envioApiKey}`;
  }
  
  try {
    // Get current block
    const heightResponse = await axios.get(`${hypersyncUrl}/height`, { headers, timeout: 5000 });
    const currentBlock = heightResponse.data?.height;
    if (!currentBlock) return null;
    
    const blocksPerDay = chainId === 8453 || chainId === 84532 ? 43200 : 7200;
    const fromBlock = Math.max(0, currentBlock - (blocksPerDay * 90));
    
    // Query for transactions FROM wallet TO recipient with value
    const query = {
      from_block: fromBlock,
      transactions: [{
        from: [walletAddress.toLowerCase()],
        to: [recipientAddress.toLowerCase()]
      }],
      field_selection: {
        transaction: ['hash', 'block_number', 'value', 'from', 'to'],
        block: ['number', 'timestamp']
      }
    };
    
    const response = await axios.post(`${hypersyncUrl}/query`, query, { headers, timeout: 10000 });
    
    const allTxs = [];
    const blockTimestamps = {};
    
    for (const batch of (response.data?.data || [])) {
      if (batch.transactions) allTxs.push(...batch.transactions);
      if (batch.blocks) {
        for (const block of batch.blocks) {
          const blockNum = typeof block.number === 'string' && block.number.startsWith('0x')
            ? parseInt(block.number, 16) : block.number;
          const ts = typeof block.timestamp === 'string' && block.timestamp.startsWith('0x')
            ? parseInt(block.timestamp, 16) : block.timestamp;
          if (blockNum && ts) blockTimestamps[blockNum] = ts;
        }
      }
    }
    
    if (allTxs.length === 0) {
      return { hasInteracted: false, interactionCount: 0, source: 'envio-native' };
    }
    
    // Find last transaction timestamp
    let lastTs = null;
    for (const tx of allTxs) {
      const blockNum = typeof tx.block_number === 'string' && tx.block_number.startsWith('0x')
        ? parseInt(tx.block_number, 16) : tx.block_number;
      const ts = blockTimestamps[blockNum];
      if (ts && (!lastTs || ts > lastTs)) lastTs = ts;
    }
    
    logger?.info?.('envio_native_transfers_found', {
      from: walletAddress.slice(0, 10),
      to: recipientAddress.slice(0, 10),
      count: allTxs.length
    });
    
    return {
      hasInteracted: true,
      interactionCount: allTxs.length,
      lastInteraction: lastTs ? new Date(lastTs * 1000).toISOString().split('T')[0] : null,
      lastInteractionType: 'sent',
      source: 'envio-native'
    };
    
  } catch (error) {
    logger?.debug?.('envio_native_check_failed', { error: error.message });
    return null;
  }
}


/**
 * Check for past transfers using Envio HyperSync
 * This finds ERC20 Transfer events where user's wallet sent to recipient
 * Works even for delegated transfers because the Transfer event shows the actual token sender
 */
async function checkEnvioTransferHistory(walletAddress, recipientAddress, chainId, logger) {
  const hypersyncUrl = HYPERSYNC_URLS[chainId];
  if (!hypersyncUrl) {
    logger?.debug?.('envio_chain_not_supported', { chainId });
    return null;
  }
  
  const envioApiKey = process.env.ENVIO_API_KEY;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (envioApiKey) {
    headers['Authorization'] = `Bearer ${envioApiKey}`;
  }
  
  try {
    // Get current block height
    const heightResponse = await axios.get(`${hypersyncUrl}/height`, { headers, timeout: 5000 });
    const currentBlock = heightResponse.data?.height;
    if (!currentBlock) {
      logger?.debug?.('envio_height_failed', { response: heightResponse.data });
      return null;
    }
    
    // Look back ~90 days (~12s blocks for Sepolia/Ethereum, ~2s for Base)
    const blocksPerDay = chainId === 8453 || chainId === 84532 ? 43200 : 7200;
    const fromBlock = Math.max(0, currentBlock - (blocksPerDay * 90));
    
    // Pad addresses to 32 bytes for topic matching (lowercase, no 0x prefix for padding)
    const walletPadded = '0x000000000000000000000000' + walletAddress.toLowerCase().slice(2);
    const recipientPadded = '0x000000000000000000000000' + recipientAddress.toLowerCase().slice(2);
    
    logger?.debug?.('envio_transfer_query', {
      chain: chainId,
      from: walletAddress.slice(0, 10),
      to: recipientAddress.slice(0, 10),
      fromBlock,
      currentBlock
    });
    
    // Query for Transfer events FROM wallet TO recipient
    // Transfer event: topic0 = signature, topic1 = from, topic2 = to
    const query = {
      from_block: fromBlock,
      logs: [{
        topics: [
          [TRANSFER_TOPIC],      // topic0: Transfer event signature
          [walletPadded],        // topic1: from = user's wallet
          [recipientPadded]      // topic2: to = recipient
        ]
      }],
      field_selection: {
        log: ['block_number', 'transaction_hash', 'address', 'topic0', 'topic1', 'topic2', 'data'],
        block: ['number', 'timestamp']
      }
    };
    
    const response = await axios.post(`${hypersyncUrl}/query`, query, { headers, timeout: 10000 });
    
    // Check response format
    if (!response.data?.data) {
      logger?.debug?.('envio_no_data', { status: response.status, hasData: !!response.data });
      return { hasInteracted: false, interactionCount: 0, source: 'envio' };
    }
    
    // HyperSync returns data in batches - combine all logs and build block timestamp map
    const allLogs = [];
    const blockTimestamps = {};
    
    for (const batch of response.data.data) {
      if (batch.logs && Array.isArray(batch.logs)) {
        allLogs.push(...batch.logs);
      }
      if (batch.blocks && Array.isArray(batch.blocks)) {
        for (const block of batch.blocks) {
          // Block number and timestamp can be hex or decimal
          const blockNum = typeof block.number === 'string' && block.number.startsWith('0x')
            ? parseInt(block.number, 16)
            : block.number;
          const timestamp = typeof block.timestamp === 'string' && block.timestamp.startsWith('0x')
            ? parseInt(block.timestamp, 16)
            : block.timestamp;
          if (blockNum && timestamp) {
            blockTimestamps[blockNum] = timestamp;
          }
        }
      }
    }
    
    if (allLogs.length === 0) {
      logger?.debug?.('envio_no_transfers_found', { batches: response.data.data.length });
      return { hasInteracted: false, interactionCount: 0, source: 'envio' };
    }
    
    // Find the most recent transfer timestamp
    let lastTransferTimestamp = null;
    for (const log of allLogs) {
      const blockNum = typeof log.block_number === 'string' && log.block_number.startsWith('0x')
        ? parseInt(log.block_number, 16)
        : log.block_number;
      const ts = blockTimestamps[blockNum];
      if (ts && (!lastTransferTimestamp || ts > lastTransferTimestamp)) {
        lastTransferTimestamp = ts;
      }
    }
    
    // Format the last transfer date
    let lastTransferDate = null;
    if (lastTransferTimestamp) {
      lastTransferDate = new Date(lastTransferTimestamp * 1000).toISOString().split('T')[0];
    }
    
    logger?.info?.('envio_found_transfers', { 
      from: walletAddress.slice(0, 10),
      to: recipientAddress.slice(0, 10),
      count: allLogs.length,
      lastDate: lastTransferDate
    });
    
    return {
      hasInteracted: true,
      interactionCount: allLogs.length,
      lastInteraction: lastTransferDate,
      lastInteractionType: 'sent',
      source: 'envio'
    };
    
  } catch (error) {
    logger?.warn?.('envio_transfer_check_failed', { 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return null;
  }
}

/**
 * Call GoPlus Security API for address security check
 * FREE API - checks for scams, phishing, blacklists, honeypots
 * 
 * @param {string} address - Address to check
 * @param {number} chainId - Chain ID
 * @param {object} logger - Logger instance
 * @returns {object|null} Security data or null if API fails
 */
async function checkGoPlusSecurity(address, chainId, logger) {
  const goPlusChainId = GOPLUS_CHAIN_IDS[chainId];
  
  // GoPlus may not support testnets
  if (!goPlusChainId) {
    logger?.debug?.('goplus_chain_not_supported', { chainId });
    return null;
  }
  
  try {
    const response = await axios.get(
      `${GOPLUS_API_BASE}/address_security/${address}`,
      {
        params: { chain_id: goPlusChainId },
        timeout: 5000
      }
    );
    
    if (response.data?.code !== 1 || !response.data?.result) {
      logger?.debug?.('goplus_no_result', { address, response: response.data });
      return null;
    }
    
    const result = response.data.result[address.toLowerCase()];
    if (!result) {
      // Address not found in GoPlus database - not necessarily bad
      return { notInDatabase: true };
    }
    
    // Parse GoPlus flags (they use "1" for true, "0" for false as strings)
    const flags = {
      isBlacklisted: result.blacklist_doubt === '1',
      isPhishing: result.phishing_activities === '1',
      isMalicious: result.malicious_behavior === '1',
      isHoneypot: result.honeypot_related_address === '1',
      isSanctioned: result.sanctioned === '1',
      isMixer: result.mixer === '1',
      isContract: result.contract_address === '1',
      isTrusted: result.trust_list === '1',
      hasCybercrime: result.cybercrime === '1',
      hasMoneyLaundering: result.money_laundering === '1',
      hasFinancialCrime: result.financial_crime === '1',
      hasDarkweb: result.darkweb_transactions === '1',
      hasReinit: result.reinit === '1', // Contract can be reinitialized (risky)
      hasFakeKYC: result.fake_kyc === '1',
      dataSource: result.data_source || 'goplus'
    };
    
    // Calculate severity
    const hasDangerFlags = flags.isBlacklisted || flags.isPhishing || flags.isMalicious || 
                          flags.isSanctioned || flags.hasCybercrime || flags.hasMoneyLaundering ||
                          flags.hasFinancialCrime || flags.hasDarkweb;
    const hasWarningFlags = flags.isHoneypot || flags.isMixer || flags.hasReinit || flags.hasFakeKYC;
    
    return {
      ...flags,
      severity: hasDangerFlags ? 'danger' : hasWarningFlags ? 'warning' : 'safe',
      raw: result
    };
    
  } catch (error) {
    logger?.debug?.('goplus_api_error', { error: error.message, address });
    return null;
  }
}

/**
 * Build human-readable GoPlus security summary
 */
function buildGoPlusFlags(goPlusResult) {
  if (!goPlusResult) return [];
  if (goPlusResult.notInDatabase) return [];
  
  const flags = [];
  
  // Danger flags (should block or strongly warn)
  if (goPlusResult.isBlacklisted) {
    flags.push({ type: 'danger', message: 'BLACKLISTED - This address is flagged as a scam or fraud' });
  }
  if (goPlusResult.isPhishing) {
    flags.push({ type: 'danger', message: 'PHISHING - This address is associated with phishing attacks' });
  }
  if (goPlusResult.isMalicious) {
    flags.push({ type: 'danger', message: 'MALICIOUS - This address has malicious behavior history' });
  }
  if (goPlusResult.isSanctioned) {
    flags.push({ type: 'danger', message: 'SANCTIONED - This address is on a government sanctions list' });
  }
  if (goPlusResult.hasCybercrime) {
    flags.push({ type: 'danger', message: 'CYBERCRIME - Associated with cybercrime activities' });
  }
  if (goPlusResult.hasMoneyLaundering) {
    flags.push({ type: 'danger', message: 'MONEY LAUNDERING - Flagged for money laundering' });
  }
  if (goPlusResult.hasFinancialCrime) {
    flags.push({ type: 'danger', message: 'FINANCIAL CRIME - Associated with financial crimes' });
  }
  if (goPlusResult.hasDarkweb) {
    flags.push({ type: 'danger', message: 'DARKWEB - Has darkweb transaction history' });
  }
  
  // Warning flags
  if (goPlusResult.isHoneypot) {
    flags.push({ type: 'warning', message: 'HONEYPOT RELATED - May be associated with honeypot scams' });
  }
  if (goPlusResult.isMixer) {
    flags.push({ type: 'warning', message: 'MIXER - This is a mixing service address' });
  }
  if (goPlusResult.hasReinit) {
    flags.push({ type: 'warning', message: 'REINIT RISK - Contract can be reinitialized (potential rug pull)' });
  }
  if (goPlusResult.hasFakeKYC) {
    flags.push({ type: 'warning', message: 'FAKE KYC - Associated with fake identity verification' });
  }
  
  // Positive flags
  if (goPlusResult.isTrusted) {
    flags.push({ type: 'positive', message: 'TRUSTED - On GoPlus trust list' });
  }
  
  return flags;
}

function checksumAddress(address) {
  if (!address) return address;
  try { return ethers.getAddress(address); } catch { return address; }
}

/**
 * Check if an address is a contract (has code) or an EOA
 */
async function checkIsContract(address, provider) {
  try {
    const code = await provider.getCode(address);
    return code !== '0x' && code !== '0x0';
  } catch {
    return null; // Unknown
  }
}



/**
 * Check against known address labels
 */
function checkKnownLabels(address) {
  const lower = address.toLowerCase();
  return KNOWN_ADDRESSES[lower] || null;
}

/**
 * Calculate overall risk level based on all checks
 */
function calculateRiskLevel(checks) {
  const { isContract, interactions, knownLabel, goPlusSecurity } = checks;
  
  // GoPlus danger = HIGH RISK (block/warn strongly)
  if (goPlusSecurity?.severity === 'danger') {
    return 'critical'; // New level for scam/fraud
  }
  
  // GoPlus warning = elevated risk
  if (goPlusSecurity?.severity === 'warning') {
    return 'high';
  }
  
  // GoPlus trusted = boost toward low risk
  if (goPlusSecurity?.isTrusted) {
    return 'low';
  }
  
  // Known trusted addresses = low risk
  if (knownLabel?.trusted) {
    return 'low';
  }
  
  // Previous interactions = lower risk
  if (interactions?.hasInteracted && interactions?.interactionCount >= 2) {
    return 'low';
  }
  
  // Contract addresses need careful consideration
  if (isContract === true && !knownLabel) {
    return 'medium';
  }
  
  // No previous interaction = medium risk
  if (!interactions?.hasInteracted) {
    return 'medium';
  }
  
  // Default to medium for unknown
  return 'medium';
}

/**
 * Build human-readable flags from checks
 */
function buildFlags(checks) {
  const { isContract, interactions, knownLabel } = checks;
  const flags = [];
  
  // Positive flags
  if (knownLabel?.trusted) {
    flags.push({ type: 'positive', message: `Known address: ${knownLabel.label}` });
  }
  
  if (interactions?.hasInteracted) {
    flags.push({ 
      type: 'positive', 
      message: `You've interacted ${interactions.interactionCount}x before (last: ${interactions.lastInteraction})` 
    });
  }
  
  // Warning flags
  if (isContract === true && !knownLabel) {
    flags.push({ type: 'warning', message: 'This is a smart contract address - verify it\'s the correct contract' });
  }
  
  if (interactions?.hasInteracted === false) {
    flags.push({ type: 'warning', message: 'First time sending to this address' });
  }
  
  return flags;
}

/**
 * Build recommendation based on risk level
 */
function buildRecommendation(riskLevel, checks) {
  switch (riskLevel) {
    case 'low':
      if (checks.knownLabel?.trusted) {
        return `This is a known ${checks.knownLabel.type} address (${checks.knownLabel.label}). Safe to proceed.`;
      }
      if (checks.interactions?.hasInteracted) {
        return 'You\'ve successfully sent to this address before. Safe to proceed.';
      }
      return 'No concerns detected. Safe to proceed.';
      
    case 'medium':
      if (!checks.interactions?.hasInteracted) {
        return 'This is your first time sending to this address. Please double-check the address is correct before confirming.';
      }
      if (checks.isContract) {
        return 'This is a smart contract. Make sure it\'s the correct contract address before proceeding.';
      }
      return 'Please verify the recipient address is correct before confirming.';
      
    case 'high':
      return 'CAUTION: This address has limited or no transaction history. Please verify this is the correct recipient before sending funds.';
      
    default:
      return 'Please verify the recipient address before proceeding.';
  }
}

export const walletSecurityTools = [
  // ============================================================
  // GoPlus Security Check (standalone)
  // ============================================================
  {
    name: 'goplus_check_address',
    description: `Check address security using GoPlus Security API ONLY.

This tool ONLY uses GoPlus Security to check for:
- Scam/fraud addresses
- Phishing addresses
- Sanctioned addresses (OFAC)
- Money laundering associations
- Cybercrime associations
- Honeypot contracts
- Mixer addresses
- Trusted/verified addresses

Use this for security threat detection. For interaction history, use envio_check_interaction separately.`,
    parameters: z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe('Address to check for security threats')
    }),
    tags: ['free', 'read', 'security', 'goplus'],
    handler: async ({ address }, context) => {
      const chainId = context?.chainId;
      const logger = context?.logger;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);
      
      const addressChecksummed = checksumAddress(address);
      
      logger?.info?.('goplus_check_address_start', { 
        address: addressChecksummed,
        chain: config.name
      });
      
      // Only GoPlus + contract check
      const [goPlusSecurity, isContract] = await Promise.all([
        checkGoPlusSecurity(address, chainId, logger),
        checkIsContract(address, provider)
      ]);
      
      const knownLabel = checkKnownLabels(address);
      const goPlusFlags = buildGoPlusFlags(goPlusSecurity);
      
      // Determine verdict based on GoPlus only
      let verdict = 'unknown';
      let verdictEmoji = '?';
      let verdictMessage = 'Unable to determine - GoPlus has no data for this address';
      
      if (goPlusSecurity?.severity === 'danger') {
        verdict = 'dangerous';
        verdictEmoji = 'DANGER';
        verdictMessage = 'DANGEROUS - Flagged for malicious activity';
      } else if (goPlusSecurity?.severity === 'warning') {
        verdict = 'suspicious';
        verdictEmoji = 'WARNING';
        verdictMessage = 'SUSPICIOUS - Has warning flags';
      } else if (goPlusSecurity?.isTrusted || knownLabel?.trusted) {
        verdict = 'trusted';
        verdictEmoji = 'OK';
        verdictMessage = knownLabel?.trusted 
          ? `TRUSTED - Known: ${knownLabel.label}`
          : 'TRUSTED - On GoPlus trust list';
      } else if (goPlusSecurity?.severity === 'safe') {
        verdict = 'safe';
        verdictEmoji = 'OK';
        verdictMessage = 'SAFE - No threats detected';
      }
      
      logger?.info?.('goplus_check_address_complete', { 
        address: addressChecksummed,
        verdict,
        goPlusSeverity: goPlusSecurity?.severity,
        flagCount: goPlusFlags.length
      });
      
      const flagSummary = goPlusFlags.length > 0 
        ? goPlusFlags.map(f => `- ${f.message}`).join('\n')
        : '- No security flags detected';
      
      return {
        address: addressChecksummed,
        chain: config.name,
        source: 'GoPlus Security API',
        
        // Overall verdict
        verdict,
        verdictMessage,
        
        // Type info
        isContract: isContract === true ? 'Smart Contract' : isContract === false ? 'Wallet (EOA)' : 'Unknown',
        knownLabel: knownLabel ? `${knownLabel.label} (${knownLabel.type})` : null,
        
        // GoPlus details
        goPlusSecurity: goPlusSecurity ? {
          severity: goPlusSecurity.severity,
          isBlacklisted: goPlusSecurity.isBlacklisted,
          isPhishing: goPlusSecurity.isPhishing,
          isMalicious: goPlusSecurity.isMalicious,
          isSanctioned: goPlusSecurity.isSanctioned,
          isHoneypot: goPlusSecurity.isHoneypot,
          isMixer: goPlusSecurity.isMixer,
          isTrusted: goPlusSecurity.isTrusted,
          hasCybercrime: goPlusSecurity.hasCybercrime,
          hasMoneyLaundering: goPlusSecurity.hasMoneyLaundering
        } : { unavailable: true, reason: 'API unavailable or chain not supported' },
        
        // Flags
        flags: goPlusFlags,
        
        // Formatted for display
        showToUser: `GoPlus Security Check

Address: ${addressChecksummed}
Type: ${isContract === true ? 'Smart Contract' : isContract === false ? 'Wallet (EOA)' : 'Unknown'}
${knownLabel ? `Known As: ${knownLabel.label}\n` : ''}
Verdict: ${verdictMessage}

Security Flags:
${flagSummary}

Source: GoPlus Security API (free tier)`
      };
    }
  },
  
  // ============================================================
  // Envio Recipient Check (for transfer flow)
  // ============================================================
  {
    name: 'envio_check_recipient',
    description: `Check recipient address before transfers using Envio HyperSync.

Call this BEFORE transfer_funds to check:
- Have you sent ETH to this address before?
- Have you sent tokens to this address before?
- How many times have you interacted?
- When was your last interaction?

Supports ENS names (e.g., vitalik.eth) - resolves via mainnet.
This helps warn users about first-time recipients. Uses Envio for fast, accurate history lookup.`,
    parameters: z.object({
      recipient: z.string().describe('Recipient address (0x...) or ENS name (e.g., vitalik.eth)'),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Your wallet address (defaults to connected wallet)')
    }),
    tags: ['free', 'read', 'transfer', 'envio'],
    handler: async ({ recipient, walletAddress }, context) => {
      const chainId = context?.chainId;
      const logger = context?.logger;
      const config = getChainConfig(chainId);
      
      const userWallet = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!userWallet) {
        return {
          error: 'No wallet address provided',
          message: 'Please connect your wallet or specify a wallet address to check interaction history.'
        };
      }
      
      // Resolve ENS if needed
      let resolvedRecipient = recipient;
      let ensName = null;
      
      if (recipient.endsWith('.eth')) {
        ensName = recipient;
        try {
          const mainnetProvider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
          resolvedRecipient = await mainnetProvider.resolveName(recipient);
          if (!resolvedRecipient) {
            return {
              error: `Could not resolve ENS name: ${recipient}`,
              message: 'Make sure the ENS name exists on mainnet.',
              suggestion: 'Try using the address directly (0x...) instead.'
            };
          }
          logger?.info?.('ens_resolved', { ensName, address: resolvedRecipient });
        } catch (e) {
          logger?.warn?.('ens_resolution_failed', { ensName, error: e.message });
          return {
            error: `ENS resolution failed: ${e.message}`,
            message: 'Could not resolve the ENS name.',
            suggestion: 'Try using the address directly (0x...) instead.'
          };
        }
      } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        return {
          error: 'Invalid recipient',
          message: 'Please provide a valid address (0x...) or ENS name (.eth).'
        };
      }
      
      const addressChecksummed = checksumAddress(resolvedRecipient);
      const userWalletChecksummed = checksumAddress(userWallet);
      
      logger?.info?.('envio_check_recipient_start', { 
        recipient: addressChecksummed,
        ensName,
        wallet: userWalletChecksummed.slice(0, 10),
        chain: config.name
      });
      
      // Query both native ETH and token transfers via Envio
      const [envioNativeInteractions, envioTokenInteractions] = await Promise.all([
        checkEnvioNativeTransfers(userWallet, resolvedRecipient, chainId, logger),
        checkEnvioTransferHistory(userWallet, resolvedRecipient, chainId, logger)
      ]);
      
      // Combine results
      const nativeCount = envioNativeInteractions?.interactionCount || 0;
      const tokenCount = envioTokenInteractions?.interactionCount || 0;
      const totalCount = nativeCount + tokenCount;
      const hasInteracted = totalCount > 0;
      
      // Find most recent interaction
      let lastInteraction = null;
      if (envioNativeInteractions?.lastInteraction && envioTokenInteractions?.lastInteraction) {
        lastInteraction = envioNativeInteractions.lastInteraction > envioTokenInteractions.lastInteraction
          ? envioNativeInteractions.lastInteraction
          : envioTokenInteractions.lastInteraction;
      } else {
        lastInteraction = envioNativeInteractions?.lastInteraction || envioTokenInteractions?.lastInteraction;
      }
      
      logger?.info?.('envio_check_recipient_complete', { 
        recipient: addressChecksummed,
        hasInteracted,
        totalCount,
        nativeCount,
        tokenCount,
        lastInteraction
      });
      
      // Build formatted output
      let interactionSummary;
      if (hasInteracted) {
        const parts = [];
        if (nativeCount > 0) parts.push(`${nativeCount} ETH transfer${nativeCount > 1 ? 's' : ''}`);
        if (tokenCount > 0) parts.push(`${tokenCount} token transfer${tokenCount > 1 ? 's' : ''}`);
        interactionSummary = `You have sent to this address ${totalCount} time${totalCount > 1 ? 's' : ''} before (${parts.join(', ')})`;
      } else {
        interactionSummary = 'First time sending to this address - please verify carefully';
      }
      
      // Format recipient display
      const recipientDisplay = ensName 
        ? `${ensName} (${addressChecksummed.slice(0, 6)}...${addressChecksummed.slice(-4)})`
        : addressChecksummed;
      
      return {
        recipient: addressChecksummed,
        recipientENS: ensName, // Original ENS name if used
        yourWallet: userWalletChecksummed,
        chain: config.name,
        source: 'Envio HyperSync',
        
        // Interaction data
        hasInteracted,
        isFirstTime: !hasInteracted,
        totalInteractions: totalCount,
        nativeEthTransfers: nativeCount,
        tokenTransfers: tokenCount,
        lastInteraction: lastInteraction,
        
        // Summary for LLM
        summary: interactionSummary,
        
        // Formatted for display
        showToUser: `**Recipient Check** (Envio)

**Recipient:** ${recipientDisplay}

${hasInteracted ? `You have sent to this address ${totalCount} time${totalCount > 1 ? 's' : ''} before` : 'First time sending to this address - please verify carefully'}
${lastInteraction ? `\nLast transfer: ${lastInteraction}` : ''}

Source: Envio HyperSync`
      };
    }
  }
];

