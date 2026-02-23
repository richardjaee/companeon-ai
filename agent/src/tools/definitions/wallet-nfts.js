/**
 * wallet-nfts.js - NFT tools for reading holdings and transferring NFTs
 *
 * - get_nft_holdings: Query all NFTs owned by a wallet via Alchemy
 * - list_nft_collections: Group NFTs by collection contract
 * - transfer_nft: Transfer an ERC-721 NFT via ERC-7715 delegation
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';
import { formatGasForOutput, getGasPriceForTier } from './gas.js';

// Minimal ERC-721 ABI for ownership checks and transfers
const ERC721_ABI = [
  {
    name: 'safeTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }]
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  }
];

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

function checksumAddress(address) {
  if (!address) return address;
  try { return ethers.getAddress(address); } catch { return address; }
}

/**
 * Fetch NFTs from Alchemy getNFTs API
 * Uses the configured RPC URL base (same Alchemy key) to query NFT data
 */
async function fetchNFTsFromAlchemy(walletAddress, chainId = null) {
  const rpcUrl = getRpcUrl(chainId);
  if (!rpcUrl) throw new Error('RPC_URL not configured');

  const nftUrl = `${rpcUrl}/getNFTs?owner=${walletAddress}&pageSize=50`;

  const response = await fetch(nftUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Alchemy NFT API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.ownedNfts || []).map(nft => {
    let tokenId;
    try {
      tokenId = nft.id?.tokenId
        ? parseInt(nft.id.tokenId.replace('0x', ''), 16).toString()
        : null;
    } catch {
      tokenId = nft.id?.tokenId;
    }

    return {
      contract: nft.contract?.address ? checksumAddress(nft.contract.address) : null,
      tokenId,
      type: nft.id?.tokenMetadata?.tokenType || 'ERC721',
      name: nft.title || null,
      description: nft.description || null,
      image: nft.media?.[0]?.gateway || null,
      attributes: nft.metadata?.attributes || []
    };
  }).filter(nft => nft.contract && nft.tokenId);
}

export const walletNftTools = [
  {
    name: 'get_nft_holdings',
    description: 'Get all NFTs (ERC-721 and ERC-1155 tokens) owned by the connected wallet. Returns collection name, token ID, and metadata for each NFT.',
    parameters: z.object({
      walletAddress: z.string().optional()
        .describe('Wallet address to check (defaults to connected wallet)')
    }),
    tags: ['free', 'read', 'nft'],
    handler: async ({ walletAddress }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }

      const chainId = context?.chainId;
      const config = getChainConfig(chainId);

      context?.logger?.info?.('get_nft_holdings', { address: address.slice(0, 10), chainId });

      const nfts = await fetchNFTsFromAlchemy(address, chainId);

      if (context?.remember) {
        context.remember('lastNftCount', nfts.length);
        context.remember('lastNftFetchedAt', new Date().toISOString());
      }

      return {
        walletAddress: address,
        chain: config.name,
        chainId: config.chainId,
        totalNfts: nfts.length,
        nfts
      };
    }
  },

  {
    name: 'list_nft_collections',
    description: 'List NFT collections owned by the wallet, grouped by contract. Shows collection name, contract address, and count of tokens owned in each collection.',
    parameters: z.object({
      walletAddress: z.string().optional()
        .describe('Wallet address to check (defaults to connected wallet)')
    }),
    tags: ['free', 'read', 'nft'],
    handler: async ({ walletAddress }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }

      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);

      context?.logger?.info?.('list_nft_collections', { address: address.slice(0, 10), chainId });

      const nfts = await fetchNFTsFromAlchemy(address, chainId);

      // Group by contract address
      const collectionsMap = {};
      for (const nft of nfts) {
        const key = nft.contract.toLowerCase();
        if (!collectionsMap[key]) {
          collectionsMap[key] = {
            contract: nft.contract,
            tokenIds: [],
            type: nft.type
          };
        }
        collectionsMap[key].tokenIds.push(nft.tokenId);
      }

      // Resolve collection names on-chain for each unique contract
      const collections = await Promise.all(
        Object.values(collectionsMap).map(async col => {
          let collectionName = null;
          let collectionSymbol = null;
          try {
            const contract = new ethers.Contract(col.contract, ERC721_ABI, provider);
            [collectionName, collectionSymbol] = await Promise.all([
              contract.name().catch(() => null),
              contract.symbol().catch(() => null)
            ]);
          } catch {
            // Non-standard contract, name unavailable
          }

          return {
            contract: col.contract,
            name: collectionName,
            symbol: collectionSymbol,
            type: col.type,
            count: col.tokenIds.length,
            tokenIds: col.tokenIds
          };
        })
      );

      // Sort by count descending
      collections.sort((a, b) => b.count - a.count);

      return {
        walletAddress: address,
        chain: config.name,
        chainId: config.chainId,
        totalCollections: collections.length,
        totalNfts: nfts.length,
        collections
      };
    }
  },

  {
    name: 'transfer_nft',
    description: `Transfer an ERC-721 NFT from the wallet to another address. Uses ERC-7715 delegation.

Gas tiers available:
- slow: Cheapest, 1-5 min confirmation
- standard: Balanced (default)
- fast: Fastest, higher cost

Set simulate=true (default) to preview the transfer before executing.`,
    parameters: z.object({
      contractAddress: z.string()
        .describe('NFT contract address (0x...)'),
      tokenId: z.string()
        .describe('Token ID to transfer (e.g., "1234")'),
      recipient: z.string()
        .describe('Recipient wallet address (0x...)'),
      walletAddress: z.string().optional()
        .describe('Sender wallet address (defaults to connected wallet)'),
      simulate: z.boolean().default(true)
        .describe('If true, only preview without executing. Set to false to execute.'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Gas speed tier: slow (cheapest), standard (balanced), fast (fastest)')
    }),
    tags: ['tx', 'write', 'nft'],
    handler: async ({ contractAddress, tokenId, recipient, walletAddress, simulate = true, gasTier = 'standard' }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }

      if (!contractAddress || !contractAddress.startsWith('0x') || contractAddress.length !== 42) {
        throw new Error('Valid NFT contract address (0x...) is required');
      }

      if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
        throw new Error('Valid recipient address (0x...) is required');
      }

      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);
      const logger = context?.logger;

      const tokenIdBigInt = BigInt(tokenId);
      const checksumContract = checksumAddress(contractAddress);
      const checksumRecipient = checksumAddress(recipient);
      const checksumSender = checksumAddress(address);

      // Verify ownership before proceeding
      const nftContract = new ethers.Contract(checksumContract, ERC721_ABI, provider);

      let collectionName = null;
      try {
        collectionName = await nftContract.name().catch(() => null);
        const currentOwner = await nftContract.ownerOf(tokenIdBigInt);
        if (currentOwner.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            `Wallet ${address.slice(0, 10)}... does not own token #${tokenId} ` +
            `in contract ${checksumContract}. Current owner: ${currentOwner}`
          );
        }
      } catch (err) {
        if (err.message.includes('does not own')) throw err;
        throw new Error(`Failed to verify NFT ownership: ${err.message}`);
      }

      const gasEstimate = await formatGasForOutput('nftTransfer', gasTier, chainId);

      if (simulate) {
        return {
          simulation: true,
          walletAddress: checksumSender,
          contractAddress: checksumContract,
          collectionName,
          tokenId,
          recipient: checksumRecipient,
          chain: config.name,
          gas: {
            tier: gasTier,
            tierName: gasEstimate.gasTierName,
            costEth: gasEstimate.gasCostEth,
            costUsd: gasEstimate.gasCostUsd,
            confirmationTime: gasEstimate.confirmationTime,
            allTiers: gasEstimate.allTiers
          },
          message: `Transfer preview: NFT #${tokenId}${collectionName ? ` from ${collectionName}` : ''} to ${checksumRecipient.slice(0, 10)}... Gas: ${gasEstimate.formatted}. Set simulate=false to execute.`,
          tip: 'Say "use faster gas" or "use slow gas" to change speed tier.'
        };
      }

      // Execute transfer via delegation
      const { SignerDriver } = await import('../../lib/signer.js');
      const { ensureGas } = await import('../../lib/gasSponsor.js');

      const driver = new SignerDriver({ provider, logger });
      const signer = await driver.getSignerForWallet(address);

      const signerAddress = await signer.getAddress();
      const gasResult = await ensureGas(signerAddress, provider, logger);
      if (gasResult.sponsored) {
        logger?.info?.('gas_sponsored_for_nft_transfer', gasResult);
      }

      const gasSettings = await getGasPriceForTier(gasTier, chainId);

      logger?.info?.('executing_nft_transfer', {
        contract: checksumContract,
        tokenId,
        to: checksumRecipient,
        gasTier
      });

      const transferData = nftContract.interface.encodeFunctionData('safeTransferFrom', [
        checksumSender,
        checksumRecipient,
        tokenIdBigInt
      ]);

      const receipt = await signer.sendTransactionWithDelegation({
        to: checksumContract,
        data: transferData,
        value: 0n,
        maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
        maxFeePerGas: gasSettings.maxFeePerGas
      });

      const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown';
      const effectiveGasPrice = receipt.effectiveGasPrice
        ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei'
        : 'unknown';

      return {
        success: true,
        txHash: receipt.hash || receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        walletAddress: checksumSender,
        contractAddress: checksumContract,
        collectionName,
        tokenId,
        recipient: checksumRecipient,
        chain: config.name,
        explorerUrl: `${config.explorer}/tx/${receipt.hash || receipt.transactionHash}`,
        gas: {
          tier: gasTier,
          gasUsed,
          effectiveGasPrice
        },
        message: `Successfully transferred NFT #${tokenId}${collectionName ? ` from ${collectionName}` : ''} to ${checksumRecipient.slice(0, 6)}...${checksumRecipient.slice(-4)}`
      };
    }
  }
];
