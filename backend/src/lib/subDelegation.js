/**
 * subDelegation.js - Agent-to-Agent Re-delegation
 *
 * Implements chained delegation per the MetaMask Delegation Framework (ERC-7710).
 *
 * Delegation chain:
 * 1. User grants delegation to Companeon (root, authority = ROOT_AUTHORITY)
 * 2. Companeon creates sub-delegation to DCA/Transfer Agent (authority = hash of parent)
 * 3. Agent executes with both delegations: [sub-delegation, parent-delegation]
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
 * Create a sub-delegation metadata object; signing happens at execution time.
 */
export async function createSubDelegation({
  parentPermissionsContext,
  companeonKey,
  dcaAgentAddress,
  limits,
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

  // Build a minimal sub-delegation (no caveats here – limits enforced by parent)
  const subDelegation = {
    delegate: dcaAgentAddress,
    delegator: companeonWallet.address,
    authority: parentHash,
    caveats: [],
    salt: BigInt(Date.now()),
    signature: '0x'
  };

  // Sign EIP-712 delegation
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
    const value = {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: [],
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
