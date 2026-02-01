/**
 * delegationSigner.js - ERC-7715 Delegation Signer
 *
 * Flow:
 * 1. User grants ERC-7715 permission via MetaMask → Frontend calls registerWalletAgent
 * 2. Backend stores permissionsContext in UserWallets collection
 * 3. This signer wraps transactions in DelegationManager.redeemDelegations()
 * 4. Spending limits are enforced on-chain by the DelegationManager
 * 
 * References:
 * - https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/
 * - ERC-7715: https://eips.ethereum.org/EIPS/eip-7715
 */

import { ethers } from 'ethers';
import { Firestore } from '@google-cloud/firestore';

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
 * DelegationManager ABI - for MetaMask Smart Accounts Kit
 * Based on: https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/
 * 
 * redeemDelegations takes:
 * - delegations: bytes[] - array of encoded delegation data (the permissionsContext)
 * - modes: bytes32[] - execution modes (ExecutionMode.SingleDefault = 0x00...00)
 * - executions: bytes[] - array of encoded (address target, uint256 value, bytes calldata)
 */
const DELEGATION_MANAGER_ABI = [
  {
    inputs: [
      { name: 'delegations', type: 'bytes[]' },
      { name: 'modes', type: 'bytes32[]' },
      { name: 'executions', type: 'bytes[]' }
    ],
    name: 'redeemDelegations',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

/**
 * Execution mode constants for MetaMask Smart Accounts Kit
 * From: https://docs.metamask.io/smart-accounts-kit/guides/delegation/
 * 
 * ExecutionMode is a bytes32 where:
 * - SingleDefault (0x00...00) = single execution
 * - BatchDefault (0x01...00) = batch execution
 */
const EXECUTION_MODE = {
  // Single execution mode - bytes32 with 0x00 prefix
  SINGLE_DEFAULT: '0x0000000000000000000000000000000000000000000000000000000000000000',
  // Batch execution mode - bytes32 with 0x01 prefix  
  BATCH_DEFAULT: '0x0100000000000000000000000000000000000000000000000000000000000000'
};

/**
 * Extract revert reason from an ethers error
 * 
 * Delegation errors often contain enforcer-specific messages like:
 * - "NativeTokenPeriodTransferEnforcer:transfer-amount-exceeded"
 * - "ERC20TransferAmountEnforcer:allowance-exceeded"
 * - "TimestampEnforcer:delegation-expired"
 * 
 * @param {Error} error - The error from ethers
 * @returns {string|null} The extracted revert reason or null
 */
function extractRevertReason(error) {
  if (!error) return null;
  
  // Check for revert data in various places ethers might put it
  const revertData = error.data || error.error?.data || error.reason;
  
  // Common enforcer error patterns to look for
  const enforcerPatterns = [
    /NativeTokenPeriodTransferEnforcer:[a-z-]+/i,
    /NativeTokenTransferAmountEnforcer:[a-z-]+/i,
    /ERC20TransferAmountEnforcer:[a-z-]+/i,
    /TimestampEnforcer:[a-z-]+/i,
    /AllowedCalldataEnforcer:[a-z-]+/i,
    /AllowedTargetsEnforcer:[a-z-]+/i,
    /[A-Z][a-zA-Z]+Enforcer:[a-z-]+/i
  ];
  
  // Check the error message for enforcer patterns
  const fullMessage = `${error.message || ''} ${error.reason || ''} ${revertData || ''}`;
  
  for (const pattern of enforcerPatterns) {
    const match = fullMessage.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  // Try to decode revert data if it's hex
  if (typeof revertData === 'string' && revertData.startsWith('0x')) {
    try {
      // Standard Error(string) revert
      if (revertData.startsWith('0x08c379a0')) {
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const decoded = abiCoder.decode(['string'], '0x' + revertData.slice(10));
        return decoded[0];
      }
    } catch {
      // Ignore decode errors
    }
  }
  
  // Check shortMessage which ethers often uses
  if (error.shortMessage) {
    for (const pattern of enforcerPatterns) {
      const match = error.shortMessage.match(pattern);
      if (match) return match[0];
    }
  }
  
  return null;
}

/**
 * Get delegation data for a wallet address from UserWallets collection
 * 
 * @param {string} walletAddress - The user's wallet address
 * @param {object} logger - Optional logger
 * @returns {object} Delegation data including permissionsContext
 */
export async function getDelegationDataForWallet(walletAddress, logger) {
  if (!walletAddress) {
    throw new Error('walletAddress is required');
  }
  
  const normalizedAddress = walletAddress.toLowerCase();
  const db = getFirestore();
  
  // Query UserWallets collection (set by registerWalletAgent in Firebase Functions)
  const walletDoc = await db.collection('UserWallets').doc(normalizedAddress).get();
  
  if (!walletDoc.exists) {
    throw new Error(`Wallet ${normalizedAddress} not registered. User must grant ERC-7715 permissions first via the frontend.`);
  }
  
  const walletData = walletDoc.data();
  const delegation = walletData.delegation;
  
  if (!delegation?.enabled) {
    throw new Error(`Delegation is not enabled for wallet ${normalizedAddress}. User must grant permissions first.`);
  }
  
  if (!delegation.permissionsContext || !delegation.delegationManager) {
    throw new Error(`Wallet ${normalizedAddress} missing ERC-7715 delegation data (permissionsContext or delegationManager)`);
  }
  
  // Check if delegation has expired
  if (delegation.expiresAt && delegation.expiresAt < Date.now() / 1000) {
    throw new Error(`Delegation for wallet ${normalizedAddress} has expired. User must grant new permissions.`);
  }
  
  // Get the backend delegation key from environment
  const backendKey = process.env.BACKEND_DELEGATION_KEY;
  if (!backendKey) {
    throw new Error('BACKEND_DELEGATION_KEY not configured in environment');
  }
  
  return {
    walletAddress: normalizedAddress,
    smartAccountAddress: walletData.smartAccountAddress || normalizedAddress,
    chainId: delegation.chainId,
    // ERC-7715 delegation data
    permissionsContext: delegation.permissionsContext,  // Primary context (native ETH)
    allPermissionContexts: delegation.allPermissionContexts || {},  // Token-specific contexts { "native": "0x...", "0x1c7d...": "0x..." }
    delegationManager: delegation.delegationManager,
    scopes: delegation.scopes || [],  // Store scope info for limit queries
    // Backend key for signing the redemption tx (same for ALL users!)
    backendKey
  };
}

/**
 * Encode execution for MetaMask DelegationManager
 * 
 * Executions are ABI-encoded tuples of (address target, uint256 value, bytes calldata)
 * Based on: https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/
 */
/**
 * Encode execution for ERC-7579
 * CRITICAL: Uses solidityPacked (abi.encodePacked) NOT abi.encode!
 * 
 * The ERC-7579 ExecutionLib.decodeSingle expects:
 * - bytes 0-20: target address (raw, not padded)
 * - bytes 20-52: value (uint256)
 * - bytes 52+: calldata (raw bytes)
 * 
 * Using abi.encode would pad the address to 32 bytes, breaking decoding!
 */
function encodeExecution(target, value, callData) {
  // Use solidityPacked for ERC-7579 compatibility
  return ethers.solidityPacked(
    ['address', 'uint256', 'bytes'],
    [target, value, callData || '0x']
  );
}

/**
 * Encode multiple executions as a batch
 */
function encodeExecutions(calls) {
  return calls.map(call => encodeExecution(call.to, call.value || 0n, call.data));
}

/**
 * DelegationSigner - Executes transactions through ERC-7715 delegation
 */
export class DelegationSigner {
  constructor({ walletAddress, provider, logger }) {
    if (!walletAddress) {
      throw new Error('walletAddress is required for DelegationSigner');
    }
    this.walletAddress = walletAddress.toLowerCase();
    this.provider = provider;
    this.logger = logger;
    this._delegationData = null;
    this._backendWallet = null;
  }
  
  /**
   * Load delegation data and create backend wallet
   */
  async _init() {
    if (this._delegationData) return;
    
    this.logger?.info?.('delegation_signer_init', { walletAddress: this.walletAddress });
    
    // Get delegation data from Firestore (UserWallets collection)
    this._delegationData = await getDelegationDataForWallet(this.walletAddress, this.logger);
    
    // Create wallet from backend key (same key for ALL users)
    this._backendWallet = new ethers.Wallet(this._delegationData.backendKey, this.provider);
    
    this.logger?.info?.('delegation_signer_ready', {
      walletAddress: this.walletAddress,
      backendAddress: this._backendWallet.address,
      delegationManager: this._delegationData.delegationManager
    });
  }
  
  /**
   * Get the backend wallet address (the delegate)
   */
  async getAddress() {
    await this._init();
    return this._backendWallet.address;
  }
  
  /**
   * Get the delegation manager address
   */
  async getDelegationManager() {
    await this._init();
    return this._delegationData.delegationManager;
  }
  
  /**
   * Get the user's smart account address
   */
  async getSmartAccountAddress() {
    await this._init();
    return this._delegationData.smartAccountAddress;
  }
  
  /**
   * Get the user's wallet address
   */
  getWalletAddress() {
    return this.walletAddress;
  }
  
  /**
   * Execute a transaction through ERC-7715 delegation
   * 
   * Based on MetaMask Smart Accounts Kit:
   * https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/
   * 
   * The delegate (backend wallet) calls DelegationManager.redeemDelegations() with:
   * - delegations: the permissionsContext from wallet_grantPermissions
   * - modes: ExecutionMode.SingleDefault for single execution
   * - executions: encoded (address target, uint256 value, bytes calldata)
   * 
   * @param {Object} tx - Transaction object with { to, data, value }
   * @param {Object} options - Optional { tokenAddress } to specify which permission context to use
   * @returns {Object} Transaction receipt
   */
  async sendTransactionWithDelegation(tx, options = {}) {
    await this._init();
    
    const { to, data, value = 0n } = tx;
    const { tokenAddress } = options;
    
    // Select the correct permissionsContext based on token type
    // For native ETH: use 'native' or primary context
    // For ERC-20: use the token address as key
    let permissionsContext;
    const allContexts = this._delegationData.allPermissionContexts || {};
    
    if (tokenAddress) {
      // ERC-20 transfer - look for token-specific context
      const tokenKey = tokenAddress.toLowerCase();
      permissionsContext = allContexts[tokenKey] || allContexts[tokenAddress];
      
      if (!permissionsContext) {
        throw new Error(
          `No delegation permission found for token ${tokenAddress}. ` +
          `Available contexts: native${Object.keys(allContexts).filter(k => k !== 'native').map(k => `, ${k}`).join('')}. ` +
          `User must grant ERC-20 delegation for this token.`
        );
      }
      
      this.logger?.info?.('delegation_using_erc20_context', {
        tokenAddress,
        contextLength: permissionsContext.length
      });
    } else {
      // Native ETH transfer - use native context or primary
      permissionsContext = allContexts['native'] || this._delegationData.permissionsContext;
    }
    
    this.logger?.info?.('delegation_execute_start', {
      walletAddress: this.walletAddress,
      target: to,
      tokenAddress: tokenAddress || 'native',
      delegationManager: this._delegationData.delegationManager,
      backendAddress: this._backendWallet.address
    });
    
    // Create DelegationManager contract instance
    const delegationManager = new ethers.Contract(
      this._delegationData.delegationManager,
      DELEGATION_MANAGER_ABI,
      this._backendWallet
    );
    
    // Encode the execution (target, value, calldata)
    const execution = encodeExecution(to, value, data);
    
    this.logger?.debug?.('delegation_params', {
      permissionsContextLength: permissionsContext?.length,
      mode: EXECUTION_MODE.SINGLE_DEFAULT,
      executionLength: execution.length,
      tokenAddress: tokenAddress || 'native'
    });
    
    try {
      // Call redeemDelegations per MetaMask Smart Accounts Kit
      const redeemTx = await delegationManager.redeemDelegations(
        [permissionsContext],                       // delegations (bytes[]) - token-specific!
        [EXECUTION_MODE.SINGLE_DEFAULT],            // modes (bytes32[])
        [execution]                                  // executions (bytes[])
      );
      
      this.logger?.info?.('delegation_tx_sent', { txHash: redeemTx.hash });
      
      const receipt = await redeemTx.wait();
      
      this.logger?.info?.('delegation_tx_confirmed', {
        txHash: redeemTx.hash,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      });

      // Check for on-chain revert (status 0 means the tx was mined but reverted)
      if (receipt.status === 0) {
        const error = new Error('Transaction reverted on-chain after being mined. The delegation enforcer rejected the operation.');
        error.code = 'TX_REVERTED';
        error.txHash = redeemTx.hash;
        throw error;
      }

      return receipt;
      
    } catch (error) {
      this.logger?.error?.('delegation_execute_failed', {
        error: error.message,
        code: error.code,
        target: to,
        walletAddress: this.walletAddress,
        delegationManager: this._delegationData.delegationManager
      });
      
      // Create a rich, structured error for the LLM to interpret
      const delegationError = new Error();
      delegationError.name = 'DelegationError';
      delegationError.walletAddress = this.walletAddress;
      delegationError.target = to;
      delegationError.value = value?.toString() || '0';
      delegationError.originalError = error.message;
      delegationError.code = error.code;
      
      // Extract enforcer-specific error from revert data
      const revertReason = extractRevertReason(error);
      delegationError.revertReason = revertReason;
      
      // Build a message the LLM can naturally interpret
      if (revertReason) {
        delegationError.message = `Delegation transaction failed: ${revertReason}. ` +
          `Use the diagnose_delegation_error tool with errorMessage="${revertReason}" ` +
          `to understand what went wrong and explain it to the user.`;
      } else if (error.code === 'CALL_EXCEPTION') {
        delegationError.message = `Delegation transaction was rejected by the smart contract. ` +
          `This usually means a spending limit was exceeded or the action isn't permitted. ` +
          `Use check_delegation_limits to see the current state, then explain to the user.`;
      } else {
        delegationError.message = `Delegation failed: ${error.message}. ` +
          `Check if the wallet has valid delegation permissions.`;
      }
      
      throw delegationError;
    }
  }
  
  /**
   * Execute multiple transactions in a batch
   * 
   * For batch execution, we use ExecutionMode.BatchDefault
   * 
   * @param {Array} calls - Array of { to, data, value } objects
   * @returns {Object} Transaction receipt
   */
  async sendBatchWithDelegation(calls) {
    await this._init();
    
    this.logger?.info?.('delegation_batch_start', {
      walletAddress: this.walletAddress,
      callCount: calls.length,
      delegationManager: this._delegationData.delegationManager
    });
    
    const delegationManager = new ethers.Contract(
      this._delegationData.delegationManager,
      DELEGATION_MANAGER_ABI,
      this._backendWallet
    );
    
    // For batch, we pass multiple executions with the same delegation
    const executions = encodeExecutions(calls);
    
    // Each execution gets the same delegation context and batch mode
    const contexts = calls.map(() => this._delegationData.permissionsContext);
    const modes = calls.map(() => EXECUTION_MODE.BATCH_DEFAULT);
    
    try {
      const redeemTx = await delegationManager.redeemDelegations(
        contexts,
        modes,
        executions
      );
      
      this.logger?.info?.('delegation_batch_sent', { txHash: redeemTx.hash });
      
      const receipt = await redeemTx.wait();
      
      this.logger?.info?.('delegation_batch_confirmed', {
        txHash: redeemTx.hash,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      });

      if (receipt.status === 0) {
        const error = new Error('Batch transaction reverted on-chain after being mined. The delegation enforcer rejected the operation.');
        error.code = 'TX_REVERTED';
        error.txHash = redeemTx.hash;
        throw error;
      }

      return receipt;
      
    } catch (error) {
      this.logger?.error?.('delegation_batch_failed', {
        error: error.message,
        callCount: calls.length,
        walletAddress: this.walletAddress
      });
      
      // Create rich error for LLM interpretation
      const delegationError = new Error();
      delegationError.name = 'DelegationError';
      delegationError.walletAddress = this.walletAddress;
      delegationError.batchSize = calls.length;
      delegationError.originalError = error.message;
      delegationError.revertReason = extractRevertReason(error);
      
      if (delegationError.revertReason) {
        delegationError.message = `Batch delegation failed: ${delegationError.revertReason}. ` +
          `Use diagnose_delegation_error to understand and explain to user.`;
      } else {
        delegationError.message = `Batch delegation failed: ${error.message}`;
      }
      
      throw delegationError;
    }
  }
  
  /**
   * Standard ethers Signer interface methods
   */
  async signMessage(message) {
    await this._init();
    return this._backendWallet.signMessage(message);
  }
  
  async signTypedData(domain, types, value) {
    await this._init();
    return this._backendWallet.signTypedData(domain, types, value);
  }
  
  connect(provider) {
    return new DelegationSigner({
      walletAddress: this.walletAddress,
      provider,
      logger: this.logger
    });
  }
}

/**
 * Check if a wallet has ERC-7715 delegation enabled
 * 
 * @param {string} walletAddress - The user's wallet address
 * @param {object} logger - Optional logger
 * @returns {boolean} True if delegation is enabled
 */
export async function isDelegationEnabledForWallet(walletAddress, logger) {
  if (!walletAddress) return false;
  
  try {
    const db = getFirestore();
    const walletDoc = await db.collection('UserWallets').doc(walletAddress.toLowerCase()).get();
    
    if (!walletDoc.exists) return false;
    
    const data = walletDoc.data();
    const delegation = data.delegation;
    
    // Check if delegation is enabled and not expired
    if (!delegation?.enabled || !delegation.permissionsContext) {
      return false;
    }
    
    if (delegation.expiresAt && delegation.expiresAt < Date.now() / 1000) {
      logger?.warn?.('delegation_expired', { walletAddress });
      return false;
    }
    
    return true;
    
  } catch (error) {
    logger?.warn?.('delegation_check_failed', { walletAddress, error: error.message });
    return false;
  }
}

/**
 * Clear the delegation cache (useful after permission updates)
 */

// ============================================
