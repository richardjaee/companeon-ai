# Task Backlog

Managed by the Claude autonomous loop. See `CLAUDE.md` for protocol.

## Pending
- [ ] Add NFT agent tools (get_nft_holdings, transfer_nft, list_nft_collections) using the existing /assets/nfts API and DelegationSigner — the NFTCards UI exists but the agent has zero NFT tools registered *(in-progress: claude/add-nft-agent-tools-getnftholdings-transfernft-lis)*
- [ ] Add conditional price-triggered order scheduling: schedule_conditional_order and cancel_conditional_order agent tools, ConditionalOrders Firestore collection, worker job checking CoinMarketCap prices every minute and firing swaps/transfers when conditions are met
- [ ] Add cross-chain bridge tool using Li.Fi or Socket aggregator API — chainConfig.js already defines Ethereum, Base, Arbitrum, Optimism but there is no bridge tool so users cannot move funds between chains through the agent
- [ ] Add DeFi yield tools for Aave V3 on Base: get_yield_rates (fetch pool APYs), supply_to_aave (deposit ERC-20 via DelegationSigner), withdraw_from_aave (redeem aTokens) — add Aave V3 contract addresses to chainConfig.js for Base
- [ ] Add transaction simulation pre-flight via Tenderly simulate API before every transfer/swap execution — add simulateTransaction helper in agent/src/lib/simulation.js, call it before execute tools, return human-readable failure reason to agent if simulation fails
- [ ] Add automation execution notifications: notificationSettings field in Firestore, POST /notifications/settings API endpoint, sendNotification helper in worker jobs that POSTs to a configured webhook URL on success/failure, notification settings card in AccountView
- [ ] Integrate EIP-7702 zero-friction onboarding for plain EOA users — audit grantPermissions.ts for smart-account-only assumptions, add account type detection, offer in-place EIP-7702 upgrade in GrantPermissionsModal instead of showing an error
- [ ] Integrate MetaMask Smart Accounts Kit paymaster for gas abstraction (pay gas in USDC) — update DelegationSigner to use paymaster flow instead of ETH top-ups from gasSponsor.js, add preferredGasToken option to GrantPermissionsModal
- [ ] Add per-automation cost and activity breakdown in AgentsView: gas spent, credits consumed, success rate per schedule — add gasCostWei and creditsUsed fields to worker job execution records, GET /schedules/:id/stats API endpoint, stats row in AgentsView
- [ ] Expose wallet tools as an MCP server — add agent/src/mcp/server.js wrapping the existing ToolRegistry, expose read tools (get_holdings, get_prices, check_delegation_limits) with wallet-address binding via API key, add GET /mcp discovery endpoint

## Done
- [x] Implement OpenClaw integration with ERC-7710 sub-delegation and MetaMask gator-cli skill
