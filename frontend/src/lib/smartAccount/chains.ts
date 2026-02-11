import { sepolia, mainnet } from 'viem/chains';
import type { Chain } from 'viem';

const CHAIN_MAP: Record<number, Chain> = {
  11155111: sepolia,
  1: mainnet,
};

export function getViemChain(chainId: number): Chain {
  const chain = CHAIN_MAP[chainId];
  if (!chain) throw new Error(`Unsupported chain ID for ERC-7715: ${chainId}`);
  return chain;
}

export const CHAIN_PARAMS: Record<number, { hex: string; name: string; rpc: string; explorer: string }> = {
  11155111: { hex: '0xaa36a7', name: 'Sepolia', rpc: 'https://rpc.sepolia.org', explorer: 'https://sepolia.etherscan.io' },
  1: { hex: '0x1', name: 'Ethereum', rpc: 'https://rpc.ankr.com/eth', explorer: 'https://etherscan.io' },
};

/**
 * Switch wallet to target chain. Attempts wallet_switchEthereumChain first,
 * falls back to wallet_addEthereumChain if the chain isn't known.
 */
export async function switchToChain(ethereum: any, chainId: number): Promise<void> {
  const params = CHAIN_PARAMS[chainId];
  if (!params) throw new Error(`Unsupported chain ID: ${chainId}`);

  const currentChainId = await ethereum.request({ method: 'eth_chainId' });
  const currentChainNumber = parseInt(currentChainId, 16);

  if (currentChainNumber !== chainId) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: params.hex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        const chain = getViemChain(chainId);
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: params.hex,
            chainName: params.name,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [params.rpc],
            blockExplorerUrls: [params.explorer],
          }],
        });
      } else if (switchError.code === 4001) {
        throw new Error(`Please switch to ${params.name} to use ERC-7715 permissions`);
      } else {
        throw new Error(`Please switch to ${params.name} to use ERC-7715 permissions`);
      }
    }
  }
}
