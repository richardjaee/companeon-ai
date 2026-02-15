// Smart Account Router - ERC-7715 Advanced Permissions

import { SmartAccountPermission, CreateSmartAccountResult } from './types';
import { createSmartAccountWithPermissions } from './index'; // ERC-7715

export type SmartAccountImplementation = 'erc7715';

export interface SmartAccountDetectionResult {
  implementation: SmartAccountImplementation;
  message: string;
}

/**
 * Detect smart account implementation.
 * ERC-7715 is supported in MetaMask v13.17.0+ (regular extension).
 */
export async function detectSmartAccountImplementation(
  ethereum: any
): Promise<SmartAccountDetectionResult> {
  return {
    implementation: 'erc7715',
    message: 'Using ERC-7715 Advanced Permissions'
  };
}

/**
 * Create smart account using ERC-7715.
 *
 * This function grants ERC-7715 permissions on the specified chain.
 *
 * Used by: GrantPermissionsModal for wallet agent permissions
 */
export async function createSmartAccount(
  ethereum: any,
  ownerAddress: string,
  permissions: SmartAccountPermission[],
  delegateAddress: string,
  chainId: number = 8453
): Promise<CreateSmartAccountResult & { implementation: SmartAccountImplementation }> {
  const detection = await detectSmartAccountImplementation(ethereum);

  // Create ERC-7715 smart account with permissions on target chain
  const smartAccountResult = await createSmartAccountWithPermissions(
    ethereum,
    ownerAddress,
    permissions,
    delegateAddress,
    chainId
  );

  // Return the ERC-7715 result directly (no NFT minting for wallet agent flow)
  return {
    ...smartAccountResult,
    implementation: 'erc7715'
  };
}
