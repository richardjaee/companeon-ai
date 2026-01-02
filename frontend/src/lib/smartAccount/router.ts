// Smart Account Router - ERC-7715 Advanced Permissions (Flask required)

import { SmartAccountPermission, CreateSmartAccountResult } from './types';
import { isMetaMaskFlask } from './detectFlask';
import { createSmartAccountWithPermissions } from './index'; // ERC-7715

export type SmartAccountImplementation = 'erc7715';

export interface SmartAccountDetectionResult {
  hasFlask: boolean;
  implementation: SmartAccountImplementation;
  message: string;
}

/**
 * Detect smart account implementation (ERC-7715 Flask required)
 * 
 * Note: This function no longer throws on Flask detection failure.
 * Flask detection can be unreliable, so we proceed anyway and let
 * the actual requestExecutionPermissions call succeed or fail.
 * This matches the test page behavior which works without detection.
 */
export async function detectSmartAccountImplementation(
  ethereum: any
): Promise<SmartAccountDetectionResult> {
  const hasFlask = await isMetaMaskFlask(ethereum);

  // Always return success - let the actual permission request determine if Flask works
  // Flask detection can return false even when Flask is installed and working
  if (!hasFlask) {
    console.warn('[SmartAccount] Flask detection returned false, but proceeding anyway');
    console.warn('[SmartAccount] The actual permission request will confirm if Flask is available');
  }

  return {
    hasFlask,
    implementation: 'erc7715',
    message: hasFlask 
      ? 'Using MetaMask Flask with ERC-7715 Advanced Permissions'
      : 'Proceeding with ERC-7715 (Flask detection inconclusive)'
  };
}

/**
 * Create smart account using ERC-7715 (Flask required)
 * 
 * This function ONLY grants ERC-7715 permissions (on Sepolia).
 * It does NOT create an NFT agent - use createSmartAccountWithAgent for that.
 * 
 * Used by: GrantPermissionsModal for wallet agent permissions
 */
export async function createSmartAccount(
  ethereum: any,
  ownerAddress: string,
  permissions: SmartAccountPermission[],
  delegateAddress: string,
  agentType?: string
): Promise<CreateSmartAccountResult & { implementation: SmartAccountImplementation }> {
  const detection = await detectSmartAccountImplementation(ethereum);

  console.log(`[SmartAccount] ${detection.message}`);
  console.log(`[SmartAccount] Implementation: ${detection.implementation}`);

  // Create ERC-7715 smart account with permissions (on Sepolia)
  const smartAccountResult = await createSmartAccountWithPermissions(
    ethereum,
    ownerAddress,
    permissions,
    delegateAddress
  );

  console.log('[Router] ERC-7715 smart account created:', smartAccountResult.smartAccountAddress);

  // Return the ERC-7715 result directly (no NFT minting for wallet agent flow)
  return {
    ...smartAccountResult,
    implementation: 'erc7715'
  };
}

/**
 * Create smart account with NFT agent (ERC-7715 + NFT)
 * 
 * This helper is no longer used in the wallet-only flow.
 * Note: ERC-7715 runs on Sepolia.
 */
// Removed createSmartAccountWithAgent and NFT agent creation
