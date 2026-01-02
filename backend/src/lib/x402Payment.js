/**
 * x402Payment.js - x402 payment utilities
 *
 * Handles USDC payments for paid tools (x402).
 * - Checks wallet USDC balance
 * - If insufficient, can trigger swap from ETH
 * - Transfers payment to x402 recipient
 */

import { ethers } from 'ethers';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Default x402 payment recipient
const X402_PAYTO = process.env.X402_PAYTO || '0xc4a26e163b0f281b455498414d6ab1fce06baf1b';

// Minimum USDC balance to maintain for x402 payments
const MIN_USDC_BALANCE = ethers.parseUnits('0.1', USDC_DECIMALS); // 0.1 USDC

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

/**
 * Check USDC balance for a wallet
 */
export async function getUsdcBalance(walletAddress, provider) {
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const balance = await usdc.balanceOf(walletAddress);
  return {
    balanceWei: balance.toString(),
    balanceFormatted: ethers.formatUnits(balance, USDC_DECIMALS),
    hasEnoughForPayment: balance >= MIN_USDC_BALANCE
  };
}

/**
 * Check if wallet has enough USDC for an x402 payment
 */
export async function canPayX402(walletAddress, costUsdcUnits, provider) {
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const balance = await usdc.balanceOf(walletAddress);
  const cost = BigInt(costUsdcUnits || '10000'); // Default 0.01 USDC
  
  return {
    hasSufficientBalance: balance >= cost,
    currentBalance: ethers.formatUnits(balance, USDC_DECIMALS),
    requiredAmount: ethers.formatUnits(cost, USDC_DECIMALS),
    shortfall: balance < cost 
      ? ethers.formatUnits(cost - balance, USDC_DECIMALS)
      : '0'
  };
}

/**
 * Get suggested swap amount to cover x402 costs
 * Returns amount that would give user ~0.1 USDC buffer
 */
export function getSuggestedSwapAmount(currentUsdcBalance, costUsdcUnits) {
  const cost = BigInt(costUsdcUnits || '10000');
  const target = cost + MIN_USDC_BALANCE; // Cost + buffer
  const current = BigInt(currentUsdcBalance || '0');
  
  if (current >= target) {
    return null; // No swap needed
  }
  
  const needed = target - current;
  return {
    neededUsdcWei: needed.toString(),
    neededUsdcFormatted: ethers.formatUnits(needed, USDC_DECIMALS),
    suggestedSwapUsdc: ethers.formatUnits(needed, USDC_DECIMALS)
  };
}

/**
 * Build context for x402 payment flow
 * This is passed to the LLM to help it handle the payment
 */
export function buildX402PaymentContext(toolName, costUsdcUnits, walletUsdcBalance) {
  const cost = BigInt(costUsdcUnits || '10000');
  const balance = BigInt(walletUsdcBalance || '0');
  const hasFunds = balance >= cost;

  return {
    toolName,
    cost: ethers.formatUnits(cost, USDC_DECIMALS),
    costWei: cost.toString(),
    walletBalance: ethers.formatUnits(balance, USDC_DECIMALS),
    hasFunds,
    needsSwap: !hasFunds,
    shortfall: hasFunds ? '0' : ethers.formatUnits(cost - balance, USDC_DECIMALS),
    x402Recipient: X402_PAYTO
  };
}

