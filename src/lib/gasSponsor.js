/**
 * gasSponsor.js - Gas sponsorship utilities
 * 
 * Sponsors gas for agent transactions using a dedicated funding key.
 * This allows users to execute swaps even if their signer has no ETH for gas.
 */

import { ethers } from 'ethers';

const MIN_GAS_BALANCE_WEI = ethers.parseEther('0.0001'); // Min balance before sponsoring
const GAS_TOPUP_AMOUNT_WEI = ethers.parseEther('0.001'); // Amount to send for gas

let sponsorWallet = null;

/**
 * Get the gas sponsor wallet
 */
export function getGasSponsorWallet(provider) {
  if (sponsorWallet) {
    return sponsorWallet.connect(provider);
  }
  
  const sponsorKey = process.env.GAS_SPONSOR_KEY || process.env.FUNDING_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!sponsorKey) {
    return null;
  }
  
  sponsorWallet = new ethers.Wallet(sponsorKey);
  return sponsorWallet.connect(provider);
}

/**
 * Check if an address needs gas sponsorship
 */
export async function needsGasSponsorship(address, provider) {
  try {
    const balance = await provider.getBalance(address);
    return balance < MIN_GAS_BALANCE_WEI;
  } catch (e) {
    return false;
  }
}

/**
 * Sponsor gas for an address by sending ETH from sponsor wallet
 */
export async function sponsorGas(targetAddress, provider, logger) {
  const sponsor = getGasSponsorWallet(provider);
  if (!sponsor) {
    throw new Error('No gas sponsor key configured. Set GAS_SPONSOR_KEY or FUNDING_PRIVATE_KEY.');
  }
  
  logger?.info?.('gas_sponsor_check', { target: targetAddress });
  
  // Check sponsor balance
  const sponsorBalance = await provider.getBalance(sponsor.address);
  if (sponsorBalance < GAS_TOPUP_AMOUNT_WEI * 2n) {
    logger?.warn?.('gas_sponsor_low', { 
      sponsorAddress: sponsor.address, 
      balance: ethers.formatEther(sponsorBalance) 
    });
    throw new Error('Gas sponsor wallet is low on funds');
  }
  
  // Check if target needs gas
  const targetBalance = await provider.getBalance(targetAddress);
  if (targetBalance >= MIN_GAS_BALANCE_WEI) {
    logger?.info?.('gas_sponsor_not_needed', { 
      target: targetAddress, 
      balance: ethers.formatEther(targetBalance) 
    });
    return { sponsored: false, reason: 'Target has sufficient gas' };
  }
  
  // Send gas
  logger?.info?.('gas_sponsor_sending', { 
    from: sponsor.address, 
    to: targetAddress, 
    amount: ethers.formatEther(GAS_TOPUP_AMOUNT_WEI) 
  });
  
  const tx = await sponsor.sendTransaction({
    to: targetAddress,
    value: GAS_TOPUP_AMOUNT_WEI
  });
  
  const receipt = await tx.wait();
  
  logger?.info?.('gas_sponsor_complete', { 
    txHash: tx.hash, 
    blockNumber: receipt.blockNumber 
  });
  
  return {
    sponsored: true,
    txHash: tx.hash,
    amount: ethers.formatEther(GAS_TOPUP_AMOUNT_WEI),
    sponsorAddress: sponsor.address
  };
}

/**
 * Ensure an address has enough gas, sponsoring if needed
 */
export async function ensureGas(targetAddress, provider, logger) {
  if (await needsGasSponsorship(targetAddress, provider)) {
    return sponsorGas(targetAddress, provider, logger);
  }
  return { sponsored: false, reason: 'Has sufficient gas' };
}

