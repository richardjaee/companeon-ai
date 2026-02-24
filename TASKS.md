# Task Backlog

Managed by the Claude autonomous loop. See `CLAUDE.md` for protocol.

## Pending
- [ ] Add conditional price-triggered order scheduling: schedule_conditional_order and cancel_conditional_order agent tools, ConditionalOrders Firestore collection, worker job checking CoinMarketCap prices every minute and firing swaps/transfers when conditions are met
- [ ] Add cross-chain bridge tool using Li.Fi or Socket aggregator API — chainConfig.js already defines Ethereum, Base, Arbitrum, Optimism but there is no bridge tool so users cannot move funds between chains through the agent
- [ ] Add DeFi yield tools for Aave V3 on Base: get_yield_rates (fetch pool APYs), supply_to_aave (deposit ERC-20 via DelegationSigner), withdraw_from_aave (redeem aTokens) — add Aave V3 contract addresses to chainConfig.js for Base
- [ ] Add transaction simulation pre-flight via Tenderly simulate API before every transfer/swap execution — add simulateTransaction helper in agent/src/lib/simulation.js, call it before execute tools, return human-readable failure reason to agent if simulation fails
- [ ] Add automation execution notifications: notificationSettings field in Firestore, POST /notifications/settings API endpoint, sendNotification helper in worker jobs that POSTs to a configured webhook URL on success/failure, notification settings card in AccountView
- [ ] Integrate EIP-7702 zero-friction onboarding for plain EOA users — audit grantPermissions.ts for smart-account-only assumptions, add account type detection, offer in-place EIP-7702 upgrade in GrantPermissionsModal instead of showing an error
- [ ] Integrate MetaMask Smart Accounts Kit paymaster for gas abstraction (pay gas in USDC) — update DelegationSigner to use paymaster flow instead of ETH top-ups from gasSponsor.js, add preferredGasToken option to GrantPermissionsModal
- [ ] Add per-automation cost and activity breakdown in AgentsView: gas spent, credits consumed, success rate per schedule — add gasCostWei and creditsUsed fields to worker job execution records, GET /schedules/:id/stats API endpoint, stats row in AgentsView
- [ ] Expose wallet tools as an MCP server — add agent/src/mcp/server.js wrapping the existing ToolRegistry, expose read tools with wallet-address binding via API key, add GET /mcp discovery endpoint
- [ ] Add GoPlus Security API pre-flight check in agent/src/lib/delegationSigner.js before transfer and swap execution to flag known scam or drainer contract addresses
- [ ] Add spending cap and per-transaction limit fields to GrantPermissionsModal and grantPermissions.ts to match Coinbase Agentic Wallets guardrail pattern (session_spending_cap, per_tx_limit)
- [ ] Replace console.log with structured JSON logging using winston in services/api/src/index.js and services/worker/src/index.js
- [ ] Wrap CompaneonChatInterface and Dashboard layout with ErrorBoundary component to prevent full-page crashes on unhandled render errors
- [ ] Add Mistral as an alternative model provider option in the create_openclaw_agent tool and OpenClaw instance config
- [ ] Add try/catch to GET /companeon-agent/get-agent-status in services/api/src/index.js at line 1838 — async Firestore query at line 1842 has no error handler; unhandled rejection returns a raw exception body on database timeout
- [ ] Replace console.log in services/worker/src/jobs/dcaAgent.js, dcaSwapAgent.js, and rebalancingAgent.js with structured JSON logging — 19 uncovered console.log calls in job files; existing logging task only targets index.js
- [ ] Wrap frontend/src/app/layout.tsx root body in ErrorBoundary around ClientLayout — root layout has no error boundary so a render error in any provider crashes the entire app with no recovery UI; distinct from the existing task targeting CompaneonChatInterface and DashboardLayout
- [ ] Add wallet_grantPermissions ERC-7715 RPC detection in frontend/src/lib/smartAccount/grantPermissions.ts — check if the connected wallet exposes wallet_grantPermissions and call it directly instead of the manual delegation flow, falling back for wallets that do not support it
- [ ] Add Coinbase Agentic Wallets wrapper in agent/src/lib/agenticWallet.js using the CDP Agentic Wallets API (launched Feb 11 2026) — enables gasless Base mainnet transactions and built-in KYT screening as an alternative execution path to the current manual gas top-up flow via gasSponsor.js
- [ ] Add Discord Components v2 interactive approval buttons to services/openclaw/skills/companeon-wallet/bins/companeon-wallet — emit structured button payloads for transfer and swap confirmations using the OpenClaw 2026 components response format so users can approve or reject wallet operations from Discord without leaving the chat
- [ ] Add Jest test infrastructure across agent/ and frontend/ — create jest.config.js in each, add first unit tests for subDelegation.js (encodePermissionsContext, decodePermissionsContext, getDelegationHash) — no test files exist anywhere in the codebase; these delegation encoding functions are security-critical and encoding bugs could cause wallet exploits
- [ ] Add ERC-1155 support to transfer_nft in agent/src/tools/definitions/wallet-nfts.js — current implementation only supports ERC-721 safeTransferFrom; add ERC-165 supportsInterface detection and ERC-1155 safeTransferFrom(from, to, id, amount, data) for semi-fungible token transfers
- [ ] Add ALCHEMY_API_KEY-based NFT URL construction in wallet-nfts.js fetchNFTsFromAlchemy — current code appends /getNFTs to the raw RPC URL which breaks with non-Alchemy providers or RPC URLs with trailing paths; derive Alchemy base URL from ALCHEMY_API_KEY env var as fallback

## Done
- [x] Implement OpenClaw integration with ERC-7710 sub-delegation and MetaMask gator-cli skill
- [x] Add NFT agent tools (get_nft_holdings, transfer_nft, list_nft_collections) using the existing /assets/nfts API and DelegationSigner
