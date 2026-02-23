/**
 * wallet-index.js - Register wallet-based tools
 *
 * Direct wallet automation via ERC-7715 delegation
 * - Transactions execute directly via delegation
 */

import { walletHoldingsTools } from './wallet-holdings.js';
import { walletSwapTools } from './wallet-swap.js';
import { walletTransferTools } from './wallet-transfer.js';
import { walletSecurityTools } from './wallet-security.js';
import { walletApprovalTools } from './wallet-approvals.js';
import { priceTools } from './price.js';
import { researchTools } from './research.js';
import { delegationTools } from './delegation.js';
import { gasTools } from './gas.js';
import { envioTools } from './envio.js';
import { transferAgentTools } from './transfer-agent.js';
import { autonomousAgentTools } from './autonomous-agents.js';
import { dcaAgentTools } from './dca-agent.js';
import { rebalancingAgentTools } from './rebalancing-agent.js';
import { aggregatorTools } from './aggregator.js';
import { walletNftTools } from './wallet-nfts.js';

// Add default tags to tools that don't have them
function tagTools(tools, defaultTags) {
  return tools.map(tool => ({
    ...tool,
    tags: tool.tags || defaultTags
  }));
}

/**
 * Register all wallet-based tools with the registry
 */
export function registerWalletTools(registry) {
  // Holdings tools - free, read-only (wallet-based)
  for (const tool of tagTools(walletHoldingsTools, ['free', 'read'])) {
    registry.register(tool);
  }

  // Price tools - free, read-only
  for (const tool of tagTools(priceTools, ['free', 'read', 'research'])) {
    registry.register(tool);
  }

  // Swap tools - DISABLED in favor of 0x aggregator
  // for (const tool of walletSwapTools) {
  //   const tags = tool.name === 'execute_swap'
  //     ? ['tx', 'write']
  //     : ['free', 'read'];
  //   registry.register({ ...tool, tags: tool.tags || tags });
  // }

  // Transfer tools - wallet-based
  for (const tool of tagTools(walletTransferTools, ['tx', 'write'])) {
    registry.register(tool);
  }

  // Research tools - paid (x402)
  for (const tool of tagTools(researchTools, ['paid', 'x402', 'research'])) {
    registry.register(tool);
  }

  // Delegation tools - for checking limits and diagnosing errors
  for (const tool of tagTools(delegationTools, ['free', 'read', 'delegation'])) {
    registry.register(tool);
  }

  // Gas tools - for checking prices and estimating costs
  for (const tool of tagTools(gasTools, ['free', 'read', 'gas'])) {
    registry.register(tool);
  }

  // Security tools - for recipient assessment before transfers
  for (const tool of tagTools(walletSecurityTools, ['free', 'read', 'security'])) {
    registry.register(tool);
  }

  // Approval tools - check approvals and guide on revocation
  for (const tool of tagTools(walletApprovalTools, ['free', 'read', 'security'])) {
    registry.register(tool);
  }

  // Envio tools - for transaction history and analytics
  for (const tool of tagTools(envioTools, ['free', 'read', 'history', 'envio'])) {
    registry.register(tool);
  }

  // A2A / Recurring transfer tools (agent-to-agent)
  for (const tool of transferAgentTools) {
    registry.register(tool);
  }
  for (const tool of autonomousAgentTools) {
    registry.register(tool);
  }

  // DCA tools - recurring swap schedules
  for (const tool of dcaAgentTools) {
    registry.register(tool);
  }

  // Rebalancing tools - portfolio rebalancing schedules
  for (const tool of rebalancingAgentTools) {
    registry.register(tool);
  }

  // NFT tools - read holdings and transfer ERC-721s
  for (const tool of walletNftTools) {
    const tags = tool.name === 'transfer_nft'
      ? ['tx', 'write', 'nft']
      : ['free', 'read', 'nft'];
    registry.register({ ...tool, tags: tool.tags || tags });
  }

  // Aggregator tools - DEX aggregation via 0x
  for (const tool of aggregatorTools) {
    const tags = tool.name === 'execute_aggregated_swap'
      ? ['tx', 'write', 'aggregator']
      : ['free', 'read', 'aggregator'];
    registry.register({ ...tool, tags: tool.tags || tags });
  }

  return registry;
}

/**
 * Get all wallet tool definitions for direct export
 */
export function getAllWalletTools() {
  return [
    ...tagTools(walletHoldingsTools, ['free', 'read']),
    ...tagTools(priceTools, ['free', 'read', 'research']),
    // Uniswap swap tools disabled in favor of 0x aggregator
    // ...walletSwapTools.map(t => ({ ...t, tags: t.tags || (t.name === 'execute_swap' ? ['tx', 'write'] : ['free', 'read']) })),
    ...tagTools(walletTransferTools, ['tx', 'write']),
    ...tagTools(researchTools, ['paid', 'x402', 'research']),
    ...tagTools(delegationTools, ['free', 'read', 'delegation']),
    ...tagTools(gasTools, ['free', 'read', 'gas']),
    ...tagTools(walletSecurityTools, ['free', 'read', 'security']),
    ...tagTools(walletApprovalTools, ['free', 'read', 'security']),
    ...tagTools(envioTools, ['free', 'read', 'history', 'envio']),
    ...aggregatorTools.map(t => ({ ...t, tags: t.tags || (t.name === 'execute_aggregated_swap' ? ['tx', 'write', 'aggregator'] : ['free', 'read', 'aggregator']) })),
    ...walletNftTools.map(t => ({ ...t, tags: t.tags || (t.name === 'transfer_nft' ? ['tx', 'write', 'nft'] : ['free', 'read', 'nft']) }))
  ];
}
