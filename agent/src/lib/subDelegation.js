/**
 * subDelegation.js - Agent-to-Agent Re-delegation
 *
 * Implements chained delegation per the MetaMask Delegation Framework (ERC-7710).
 *
 * Delegation chain:
 * 1. User grants delegation to Companeon (root, authority = ROOT_AUTHORITY)
 * 2. Companeon creates sub-delegation to DCA/Transfer Agent (authority = hash of parent)
 *    with scoped caveats that narrow the parent's permissions
 * 3. Agent executes with both delegations: [sub-delegation, parent-delegation]
 *
 * Sub-delegation caveats are accumulative: the DelegationManager validates ALL caveats
 * across the entire chain. Sub-delegation caveats can only narrow (never widen) parent
 * permissions.
 */

import { ethers } from 'ethers';
import { Firestore } from '@google-cloud/firestore';

// Lazy-load SDK dependencies for caveat building
let sdkModule = null;
let sdkUtilsModule = null;

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

// Map frequency strings to period durations in seconds
const FREQUENCY_TO_SECONDS = {
  hourly: 3600,
  daily: 86400,
  weekly: 604800,
  test: 120
};

let firestoreClient = null;
function getFirestore() {
  if (!firestoreClient) {
    firestoreClient = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID
    });
  }
  return firestoreClient;
}

// ROOT_AUTHORITY per Delegation Framework
const ROOT_AUTHORITY = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// Types
const DELEGATION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('Delegation(address delegate,address delegator,bytes32 authority,Caveat[] caveats,uint256 salt)Caveat(address enforcer,bytes terms)')
);
const CAVEAT_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes('Caveat(address enforcer,bytes terms)')
);

// Decode/encode permissionsContext (Delegation[])
export function decodePermissionsContext(permissionsContext) {
  if (!permissionsContext || permissionsContext === '0x') throw new Error('Empty permissionsContext');
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const tup = 'tuple(address delegate,address delegator,bytes32 authority,tuple(address enforcer,bytes terms, bytes args)[] caveats,uint256 salt,bytes signature)[]';
  const decoded = abi.decode([tup], permissionsContext);
  return decoded[0];
}
export function encodePermissionsContext(delegations) {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const tup = 'tuple(address delegate,address delegator,bytes32 authority,tuple(address enforcer,bytes terms, bytes args)[] caveats,uint256 salt,bytes signature)[]';
  return abi.encode([tup], [delegations]);
}

export function getDelegationHash(delegation) {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const caveatHashes = (delegation.caveats || []).map(c => {
    const enc = abi.encode(['bytes32','address','bytes32'], [CAVEAT_TYPEHASH, c.enforcer, ethers.keccak256(c.terms)]);
    return ethers.keccak256(enc);
  });
  const caveatArrayHash = ethers.keccak256(ethers.solidityPacked(['bytes32[]'], [caveatHashes.length > 0 ? caveatHashes : []]));
  const encDeleg = abi.encode(
    ['bytes32','address','address','bytes32','bytes32','uint256'],
    [DELEGATION_TYPEHASH, delegation.delegate, delegation.delegator, delegation.authority, caveatArrayHash, delegation.salt]
  );
  return ethers.keccak256(encDeleg);
}

/**
 * Build scoped caveats for a sub-delegation using the SDK's CaveatBuilder.
 *
 * Caveats narrow the parent delegation's permissions. Available caveat types:
 * - nativeTokenPeriodTransfer: limit ETH per period (e.g., 0.001 ETH/day)
 * - erc20PeriodTransfer: limit ERC-20 per period
 * - allowedTargets: restrict to specific recipient addresses
 * - timestamp: enforce an expiration time
 *
 * @param {object} caveatConfig - Configuration for caveats
 * @param {string} caveatConfig.token - Token symbol (e.g., "ETH", "USDC")
 * @param {string} caveatConfig.amount - Amount per period (human-readable, e.g., "0.001")
 * @param {string} caveatConfig.frequency - Period frequency ("hourly", "daily", "weekly", "test")
 * @param {string} [caveatConfig.recipient] - Restrict transfers to this address
 * @param {string} [caveatConfig.tokenAddress] - ERC-20 token contract address
 * @param {number} [caveatConfig.decimals] - Token decimals (default 18 for ETH)
 * @param {number} [caveatConfig.expiresAt] - Unix timestamp for sub-delegation expiry
 * @param {number} chainId - Chain ID for environment lookup
 * @param {object} [logger] - Optional logger
 * @returns {Array} Array of Caveat objects { enforcer, terms, args }
 */
async function buildSubDelegationCaveats(caveatConfig, chainId, logger) {
  if (!caveatConfig) return [];

  const { token, amount, frequency, recipient, tokenAddress, decimals, expiresAt } = caveatConfig;
  const { getSmartAccountsEnvironment } = await getSDK();
  const { createCaveatBuilder } = await getSDKUtils();

  const environment = getSmartAccountsEnvironment(chainId);
  const builder = createCaveatBuilder(environment);

  const isNative = !token || token.toUpperCase() === 'ETH';
  const periodDuration = FREQUENCY_TO_SECONDS[frequency] || FREQUENCY_TO_SECONDS.daily;
  const startDate = Math.floor(Date.now() / 1000);

  if (isNative && amount) {
    const periodAmountWei = ethers.parseEther(amount);
    builder.addCaveat('nativeTokenPeriodTransfer', {
      periodAmount: periodAmountWei,
      periodDuration,
      startDate
    });
    logger?.info?.('sub_delegation_caveat_native', {
      amount, periodDuration, startDate
    });
  }

  if (!isNative && amount && tokenAddress) {
    const tokenDecimals = decimals || 6;
    const periodAmountUnits = BigInt(Math.round(parseFloat(amount) * Math.pow(10, tokenDecimals)));
    builder.addCaveat('erc20PeriodTransfer', {
      tokenAddress,
      periodAmount: periodAmountUnits,
      periodDuration,
      startDate
    });
    logger?.info?.('sub_delegation_caveat_erc20', {
      token, amount, tokenAddress, periodDuration, startDate
    });
  }

  if (recipient) {
    builder.addCaveat('allowedTargets', {
      targets: [recipient]
    });
    logger?.info?.('sub_delegation_caveat_targets', { recipient });
  }

  if (expiresAt) {
    builder.addCaveat('timestamp', {
      afterThreshold: 0,
      beforeThreshold: expiresAt
    });
    logger?.info?.('sub_delegation_caveat_timestamp', { expiresAt });
  }

  const caveats = builder.build();
  logger?.info?.('sub_delegation_caveats_built', { count: caveats.length });
  return caveats;
}

/**
 * Create a sub-delegation metadata object; signing happens at execution time.
 */
export async function createSubDelegation({
  parentPermissionsContext,
  companeonKey,
  dcaAgentAddress,
  limits,
  caveatConfig,
  delegationManager,
  chainId,
  logger
}) {
  const parentDelegations = decodePermissionsContext(parentPermissionsContext);
  if (parentDelegations.length === 0) throw new Error('No parent delegation');
  const parentDelegation = parentDelegations[0];
  const parentHash = getDelegationHash(parentDelegation);
  const companeonWallet = new ethers.Wallet(companeonKey);
  if (parentDelegation.delegate.toLowerCase() !== companeonWallet.address.toLowerCase()) {
    throw new Error('Companeon address mismatch with parent delegate');
  }
  logger?.info?.('sub_delegation_parent', { parentHash: parentHash.slice(0, 18) });

  // Build scoped caveats that narrow the parent delegation's permissions
  const caveats = await buildSubDelegationCaveats(caveatConfig, chainId, logger);

  const subDelegation = {
    delegate: dcaAgentAddress,
    delegator: companeonWallet.address,
    authority: parentHash,
    caveats,
    salt: BigInt(Date.now()),
    signature: '0x'
  };

  logger?.info?.('sub_delegation_created', {
    delegate: dcaAgentAddress,
    caveatCount: caveats.length,
    hasScopedCaveats: caveats.length > 0
  });

  // Sign EIP-712 delegation (caveats must be included in the signed data)
  async function signDelegationEip712(delegation, signer, dmAddress, cid) {
    const domain = { name: 'DelegationManager', version: '1', chainId: cid, verifyingContract: dmAddress };
    const types = {
      Caveat: [ { name: 'enforcer', type: 'address' }, { name: 'terms', type: 'bytes' } ],
      Delegation: [
        { name: 'delegate', type: 'address' },
        { name: 'delegator', type: 'address' },
        { name: 'authority', type: 'bytes32' },
        { name: 'caveats', type: 'Caveat[]' },
        { name: 'salt', type: 'uint256' }
      ]
    };
    // Include actual caveats in signed data (enforcer + terms only, not args)
    const signableCaveats = (delegation.caveats || []).map(c => ({
      enforcer: c.enforcer,
      terms: c.terms
    }));
    const value = {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: signableCaveats,
      salt: delegation.salt.toString()
    };
    return await signer.signTypedData(domain, types, value);
  }

  subDelegation.signature = await signDelegationEip712(subDelegation, companeonWallet, delegationManager, chainId);

  const chainedPermissionsContext = encodePermissionsContext([ subDelegation, ...parentDelegations ]);

  return {
    parentHash,
    to: dcaAgentAddress,
    limits: limits || null,
    caveatConfig: caveatConfig || null,
    delegationManager,
    chainId,
    createdAt: Date.now(),
    chainedPermissionsContext
  };
}

export async function storeSubDelegation(walletAddress, scheduleId, subDelegationData) {
  const db = getFirestore();
  const normalized = walletAddress.toLowerCase();
  const docRef = db.collection('SubDelegations').doc(`${normalized}_${scheduleId}`);
  await docRef.set({
    walletAddress: normalized,
    scheduleId,
    ...subDelegationData,
    updatedAt: Date.now()
  }, { merge: true });
}

export async function getSubDelegation(walletAddress, scheduleId) {
  const db = getFirestore();
  const normalized = walletAddress.toLowerCase();
  const docRef = db.collection('SubDelegations').doc(`${normalized}_${scheduleId}`);
  const doc = await docRef.get();
  return doc.exists ? doc.data() : null;
}

/**
 * Get all sub-delegations for a wallet address.
 */
export async function getSubDelegationsForWallet(walletAddress) {
  const db = getFirestore();
  const normalized = walletAddress.toLowerCase();
  const snapshot = await db.collection('SubDelegations')
    .where('walletAddress', '==', normalized)
    .get();

  if (snapshot.empty) return [];

  const results = [];
  snapshot.forEach(doc => {
    results.push({ id: doc.id, ...doc.data() });
  });
  return results;
}
