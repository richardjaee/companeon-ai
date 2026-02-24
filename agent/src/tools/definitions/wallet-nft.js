/**
 * wallet-nft.js - Tools for querying and transferring NFTs
 *
 * Direct wallet automation via ERC-7715 delegation
 * - Reads via Alchemy NFT API
 * - Transfers execute via ERC-721/ERC-1155 safeTransferFrom through delegation
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';
import { formatGasForOutput, getGasPriceForTier } from './gas.js';

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
    name: 'supportsInterface',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'bytes4' }],
    outputs: [{ type: 'bool' }]
  }
];

const ERC1155_ABI = [
  {
    name: 'safeTransferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' }
    ],
    outputs: []
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' }
    ],
    outputs: [{ type: 'uint256' }]
  }
];

const ERC1155_INTERFACE_ID = '0xd9b67a26';

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

async function fetchNftsFromAlchemy(walletAddress, chainId = null) {
  const baseUrl = getRpcUrl(chainId);
  const nftUrl = `${baseUrl}/getNFTs?owner=${walletAddress}&pageSize=50`;

  const response = await fetch(nftUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Alchemy NFT API error: ${response.status} ${response.statusText}`);
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
      contract: nft.contract?.address || null,
      tokenId,
      type: nft.id?.tokenMetadata?.tokenType || 'ERC721',
      metadata: {
        name: nft.title || null,
        description: nft.description || null,
        image: nft.media?.[0]?.gateway || null,
        attributes: nft.metadata?.attributes || []
      }
    };
  }).filter(nft => nft.contract && nft.tokenId);
}

export const walletNftTools = [
  {
    name: 'get_nft_holdings',
    description: 'Get all NFTs owned by the connected wallet. Returns a list of NFTs with their metadata including name, image, collection address, and token ID.',
    parameters: z.object({
      walletAddress: z.string().optional().describe('Wallet address to check (defaults to connected wallet from context)')
    }),
    tags: ['free', 'read-only'],
    handler: async ({ walletAddress }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }

      const chainId = context?.chainId;
      const config = getChainConfig(chainId);

      const nfts = await fetchNftsFromAlchemy(address, chainId);

      return {
        walletAddress: address.toLowerCase(),
        chain: config.name,
        chainId: config.chainId,
        totalCount: nfts.length,
        nfts
      };
    }
  },

  {
    name: 'list_nft_collections',
    description: 'List NFT collections owned by the wallet, grouped by contract address. Shows the collection name (if available), token type, and how many NFTs from each collection the wallet holds.',
    parameters: z.object({
      walletAddress: z.string().optional().describe('Wallet address to check (defaults to connected wallet from context)')
    }),
    tags: ['free', 'read-only'],
    handler: async ({ walletAddress }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }

      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);

      const nfts = await fetchNftsFromAlchemy(address, chainId);

      const collectionsMap = new Map();
      for (const nft of nfts) {
        const key = nft.contract.toLowerCase();
        if (!collectionsMap.has(key)) {
          collectionsMap.set(key, {
            contract: nft.contract,
            type: nft.type,
            count: 0,
            tokens: []
          });
        }
        const col = collectionsMap.get(key);
        col.count++;
        col.tokens.push({ tokenId: nft.tokenId, name: nft.metadata?.name || null });
      }

      const collections = [];
      for (const col of collectionsMap.values()) {
        let collectionName = null;
        try {
          const contract = new ethers.Contract(col.contract, ERC721_ABI, provider);
          collectionName = await contract.name().catch(() => null);
        } catch {
          // not all contracts expose name()
        }
        collections.push({
          contract: col.contract,
          name: collectionName,
          type: col.type,
          count: col.count,
          tokens: col.tokens
        });
      }

      return {
        walletAddress: address.toLowerCase(),
        chain: config.name,
        chainId: config.chainId,
        totalNfts: nfts.length,
        collectionCount: collections.length,
        collections
      };
    }
  },

  {
    name: 'transfer_nft',
    description: `Transfer an NFT (ERC-721 or ERC-1155) from the wallet to another address. Uses ERC-7715 delegation.

The NFT contract must be included in the user's delegation permissions.
Call get_nft_holdings first to confirm the user owns the NFT before transferring.

Gas tiers available:
- slow: Cheapest, 1-5 min confirmation
- standard: Balanced (default)
- fast: Fastest, higher cost

The output includes gas cost estimates. Set simulate=false only after the user explicitly confirms the transfer.`,
    parameters: z.object({
      contractAddress: z.string().describe('NFT contract address (0x...)'),
      tokenId: z.string().describe('Token ID of the NFT to transfer'),
      recipient: z.string().describe('Recipient address (0x...)'),
      amount: z.number().int().min(1).default(1).describe('Number of tokens to transfer (ERC-1155 only; always 1 for ERC-721)'),
      walletAddress: z.string().optional().describe('Wallet to transfer from (defaults to connected wallet)'),
      simulate: z.boolean().default(true).describe('If true, only simulate without executing'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Gas speed tier: slow (cheapest), standard (balanced), fast (fastest)')
    }),
    tags: ['tx', 'write'],
    handler: async ({ contractAddress, tokenId, recipient, amount = 1, walletAddress, simulate = true, gasTier = 'standard' }, context) => {
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

      // Detect ERC-1155 vs ERC-721 via ERC-165 supportsInterface
      let tokenType = 'ERC721';
      try {
        const probeContract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
        const is1155 = await probeContract.supportsInterface(ERC1155_INTERFACE_ID).catch(() => false);
        if (is1155) tokenType = 'ERC1155';
      } catch {
        // default to ERC721
      }

      // Verify ownership
      if (tokenType === 'ERC721') {
        try {
          const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
          const owner = await contract.ownerOf(BigInt(tokenId));
          if (owner.toLowerCase() !== address.toLowerCase()) {
            throw new Error(
              `Wallet ${address} does not own NFT #${tokenId} in contract ${contractAddress}. ` +
              `Current owner: ${owner}`
            );
          }
        } catch (e) {
          if (e.message.includes('does not own')) throw e;
          // ownerOf may revert for non-existent tokens - allow to proceed
        }
      } else {
        try {
          const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
          const balance = await contract.balanceOf(address, BigInt(tokenId));
          if (balance < BigInt(amount)) {
            throw new Error(
              `Wallet has insufficient balance of token #${tokenId}: owns ${balance.toString()}, requested ${amount}`
            );
          }
        } catch (e) {
          if (e.message.includes('insufficient balance')) throw e;
        }
      }

      const gasEstimate = await formatGasForOutput('erc20Transfer', gasTier, chainId);

      if (simulate) {
        return {
          simulation: true,
          walletAddress: address,
          contractAddress,
          tokenId,
          tokenType,
          recipient,
          amount: tokenType === 'ERC1155' ? amount : 1,
          chain: config.name,
          gas: {
            tier: gasTier,
            tierName: gasEstimate.gasTierName,
            costEth: gasEstimate.gasCostEth,
            costUsd: gasEstimate.gasCostUsd,
            confirmationTime: gasEstimate.confirmationTime,
            allTiers: gasEstimate.allTiers
          },
          message: `Transfer simulation successful. Gas: ${gasEstimate.formatted}. Set simulate=false to execute.`,
          tip: 'Say "use faster gas" or "use slow gas" to change speed tier.'
        };
      }

      // Execute via delegation
      const { SignerDriver } = await import('../../lib/signer.js');
      const { ensureGas } = await import('../../lib/gasSponsor.js');

      const driver = new SignerDriver({ provider, logger: context?.logger });
      const signer = await driver.getSignerForWallet(address);

      const signerAddress = await signer.getAddress();
      const gasResult = await ensureGas(signerAddress, provider, context?.logger);
      if (gasResult.sponsored) {
        context?.logger?.info?.('gas_sponsored_for_nft_transfer', gasResult);
      }

      const gasSettings = await getGasPriceForTier(gasTier, chainId);

      let transferData;
      if (tokenType === 'ERC1155') {
        const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
        transferData = contract.interface.encodeFunctionData('safeTransferFrom', [
          address,
          recipient,
          BigInt(tokenId),
          BigInt(amount),
          '0x'
        ]);
      } else {
        const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
        transferData = contract.interface.encodeFunctionData('safeTransferFrom', [
          address,
          recipient,
          BigInt(tokenId)
        ]);
      }

      context?.logger?.info?.('executing_nft_transfer', {
        tokenType,
        contractAddress,
        tokenId,
        to: recipient,
        gasTier
      });

      const receipt = await signer.sendTransactionWithDelegation(
        {
          to: contractAddress,
          data: transferData,
          value: 0n,
          maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
          maxFeePerGas: gasSettings.maxFeePerGas
        },
        { tokenAddress: contractAddress }
      );

      const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown';
      const effectiveGasPrice = receipt.effectiveGasPrice
        ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei'
        : 'unknown';

      return {
        success: true,
        txHash: receipt.hash || receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        walletAddress: address,
        recipient,
        contractAddress,
        tokenId,
        tokenType,
        amount: tokenType === 'ERC1155' ? amount : 1,
        chain: config.name,
        explorerUrl: `${config.explorer}/tx/${receipt.hash || receipt.transactionHash}`,
        gas: {
          tier: gasTier,
          gasUsed,
          effectiveGasPrice
        },
        message: `Successfully transferred NFT #${tokenId} from ${contractAddress} to ${recipient}`
      };
    }
  }
];
