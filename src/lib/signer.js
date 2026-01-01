/**
 * signer.js - Wallet-based Signer Driver
 *
 * Transactions are executed via ERC-7715 delegation using DelegationManager.
 */

import { ethers } from 'ethers';
import { DelegationSigner, isDelegationEnabledForWallet } from './delegationSigner.js';

/**
 * Signer Driver for wallet-based operations
 * 
 * Uses ERC-7715 delegation to execute transactions on behalf of users.
 * The backend signs with BACKEND_DELEGATION_KEY, but transactions are
 * validated against the user's permissionsContext on-chain.
 */
export class SignerDriver {
  constructor({ provider, logger }) {
    this.provider = provider;
    this.logger = logger;
  }

  /**
   * Get a signer for a wallet address
   * 
   * Returns a DelegationSigner that routes all transactions through
   * DelegationManager.redeemDelegations() using the user's permissions.
   * 
   * @param {string} walletAddress - The user's wallet address
   * @returns {DelegationSigner} A signer that executes via delegation
   */
  async getSignerForWallet(walletAddress) {
    if (!walletAddress) {
      throw new Error('walletAddress is required');
    }
    
    this.logger?.info?.('getting_delegation_signer', { walletAddress: walletAddress.slice(0, 10) });
    
    // Check if delegation is enabled for this wallet
    const hasDelegation = await isDelegationEnabledForWallet(walletAddress, this.logger);
    
    if (!hasDelegation) {
      throw new Error(
        `No active delegation for wallet ${walletAddress.slice(0, 10)}... ` +
        'User must grant ERC-7715 permissions first via the frontend.'
      );
    }
    
    return new DelegationSigner({
      walletAddress,
      provider: this.provider,
      logger: this.logger
    });
  }

  /**
   * Get a simple EOA signer from environment (for testing/gas sponsorship only)
   * 
   * @param {string} keyName - Environment variable name (default: BACKEND_DELEGATION_KEY)
   * @returns {ethers.Wallet} A simple wallet signer
   */
  getBackendSigner(keyName = 'BACKEND_DELEGATION_KEY') {
    const pk = process.env[keyName];
    if (!pk) {
      throw new Error(`${keyName} not set in environment`);
    }
    return new ethers.Wallet(pk, this.provider);
  }
}

/**
 * Check if a signer is a DelegationSigner
 */
export function isDelegationSigner(signer) {
  return signer instanceof DelegationSigner;
}

/**
 * Execute a transaction with delegation support
 * 
 * If the signer is a DelegationSigner, uses sendTransactionWithDelegation()
 * Otherwise, uses the standard ethers sendTransaction()
 * 
 * @param {object} signer - The signer (DelegationSigner or ethers.Wallet)
 * @param {object} tx - Transaction object { to, data, value }
 * @param {object} logger - Optional logger
 * @returns {object} Transaction receipt
 */
export async function executeWithDelegationSupport(signer, tx, logger) {
  if (signer instanceof DelegationSigner) {
    logger?.info?.('execute_with_delegation', { 
      to: tx.to,
      walletAddress: signer.getWalletAddress()
    });
    return signer.sendTransactionWithDelegation(tx);
  }
  
  // Standard transaction flow (for gas sponsorship, etc.)
  if (signer.sendTransaction) {
    logger?.info?.('execute_direct', { to: tx.to });
    return signer.sendTransaction(tx);
  }
  
  throw new Error('Signer does not support sendTransaction');
}

