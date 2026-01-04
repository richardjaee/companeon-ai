# Companeon

A wallet-native AI agent that turns conversational prompts into on-chain transactions using ERC-7715 Advanced Permissions and Envio HyperSync.

---

## Overview

Companeon lets you control your crypto wallet through natural language conversations. Instead of manually navigating multiple apps and approving each transaction, you grant ERC-7715 permissions once and let the AI agent handle the execution.

The agent operates within wallet-enforced spending limits (no custody, no vaults) and maintains a full audit trail via Envio's blockchain indexing.

**Example interactions:**
- "Send 50 USDC to vitalik.eth"
- "Swap 2 ETH to USDC using fast gas"
- "What actions have you taken with my wallet this week?"

---

## The Problem

Crypto wallet management requires users to navigate multiple apps, understand gas fees, and manually approve every transaction. Automation tools often require moving funds to new contracts or granting unlimited approvals, which introduces security risks.

## Our Solution

Users grant scoped, time-bound ERC-7715 permissions to an AI agent that can execute transactions directly from their wallet. Each permission specifies:

- Token type (ETH, USDC, etc.)
- Spending limit per period (e.g., "1 ETH per day")
- Expiration date
- Instant revocability

The agent handles routing, gas optimization, transaction simulation, and error recovery while staying within these on-chain limits. Envio indexes all delegated executions for a complete audit trail.

---

## Advanced Permissions Usage

Companeon is built on ERC-7715 Advanced Permissions using MetaMask Smart Accounts Kit. All transactions execute via the DelegationManager with wallet-enforced spending limits.

### Code Links

**Requesting Permissions (Frontend)**

Core implementation:
- [`frontend/src/lib/smartAccount/grantPermissions.ts`](./frontend/src/lib/smartAccount/grantPermissions.ts) - Uses MetaMask Smart Accounts Kit to create ERC-7715 delegations with token-specific spending limits

UI component:
- [`frontend/src/components/GrantPermissionsModal/GrantPermissionsModal.tsx`](./frontend/src/components/GrantPermissionsModal/GrantPermissionsModal.tsx) - Multi-step modal for setting permissions (token selection, spending limits, time periods)

**Redeeming Permissions (Backend)**

Core implementation:
- [`backend/src/lib/delegationSigner.js`](./backend/src/lib/delegationSigner.js) - `DelegationSigner` class wraps all transactions in `DelegationManager.redeemDelegations()`, routes ETH vs ERC-20 executions through correct permission contexts

Permission-aware tools:
- [`backend/src/tools/definitions/delegation.js`](./backend/src/tools/definitions/delegation.js) - Agent tools for querying live permission state (`check_delegation_limits`) and diagnosing enforcer errors (`diagnose_delegation_error`)

### How It Works

1. User grants permissions via MetaMask (frontend calls Smart Accounts Kit)
2. Permission contexts stored in Firestore
3. Backend retrieves contexts and wraps transactions in `DelegationManager.redeemDelegations()`
4. On-chain enforcers validate spending limits before execution
5. Agent queries remaining limits in real-time and explains failures in plain English

Example agent behavior:
- "You have 0.5 ETH remaining today. Your limit resets in 3 hours."
- "This transfer exceeds your daily ETH limit. You can wait for the reset, reduce the amount, or extend your permission."

---

## Envio Usage

Companeon integrates Envio HyperSync for blockchain indexing and wallet history queries. Instead of slow RPC polling, the agent uses HyperSync's `/query` endpoint (approximately 2000x faster) to retrieve on-chain data.

### Code Links

All Envio tools:
- [`backend/src/tools/definitions/envio.js`](./backend/src/tools/definitions/envio.js) - Contains 7 agent-callable tools that wrap HyperSync queries

### How We Use Envio

Each tool represents one agent call that orchestrates HyperSync queries and returns structured wallet data:

**1. `envio_get_token_transfers`**
- Query: ERC-20 Transfer event logs
- Returns: Token transfer history (sent + received)
- Example: "Show my last 3 USDC transfers"

**2. `envio_get_eth_transfers`**
- Query: Native transaction logs
- Returns: ETH transfer history
- Example: "Show my ETH transfers"

**3. `envio_get_all_transfers`**
- Query: Parallel ETH + ERC-20 queries, merged by timestamp
- Returns: Unified transfer timeline
- Example: "Show all transfers in my wallet"

**4. `envio_get_recent_activity`**
- Query: Aggregated logs over time window
- Returns: Activity summary (incoming, outgoing, net flow)
- Example: "What happened in my wallet today?"

**5. `envio_count_wallet_transactions`**
- Query: Count-focused log queries
- Returns: Transaction volume stats
- Example: "How many transactions did I make this month?"

**6. `envio_get_delegation_executions`**
- Query: `RedeemedDelegation` event logs from MetaMask DelegationManager
- Returns: When delegated permissions were used, whether executed by user or AI agent
- Example: "What actions has the AI taken with my wallet?"
- **This produces a verifiable on-chain audit trail of AI activity**

**7. `envio_check_recipient`**
- Query: Historical transfer lookups
- Returns: First-time vs known address detection
- Example: "Have I sent to this address before?"

### Why Envio

Envio turns blockchain history into agent memory. The agent can reason over live on-chain state and provide contextual responses instead of raw transaction logs.

---

## Architecture

### System Overview

```
User Prompt → Express API → Agent (ReAct Loop) → Tools → Blockchain
                ↓                    ↓              ↓
            Sessions          LLM (Gemini)    ERC-7715 Delegation
            (Firestore)       Tool Calling    DelegationManager
```

### Core Components

**1. Express API Server** ([`backend/src/index.js`](./backend/src/index.js))
- RESTful + SSE streaming endpoints
- Session management (Firestore)
- Request authentication
- Chain context management

**2. Agent (ReAct Loop)** ([`backend/src/agent/Agent.js`](./backend/src/agent/Agent.js))
- Iterative reasoning loop: Think → Act → Observe
- Tool selection and execution
- Autonomous error recovery
- Duplicate call prevention
- Auto-diagnosis for delegation errors

**3. Tool Registry** ([`backend/src/tools/`](./backend/src/tools/))
- Wallet Tools: Holdings, swaps, transfers
- DeFi Tools: Uniswap integration, gas estimation
- Research Tools: Perplexity search (x402), price data
- Security Tools: GoPlus recipient verification, Envio transaction history
- Delegation Tools: Limit checking, permission diagnosis

**4. LLM Client** ([`backend/src/llm/GeminiClient.js`](./backend/src/llm/GeminiClient.js))
- Google Gemini 2.5 Flash integration
- Native function calling
- Streaming responses

**5. Delegation Signer** ([`backend/src/lib/delegationSigner.js`](./backend/src/lib/delegationSigner.js))
- ERC-7715 transaction wrapping
- MetaMask Smart Accounts Kit integration
- Permission context management

**6. Session Store** ([`backend/src/memory/FirestoreSessionStore.js`](./backend/src/memory/FirestoreSessionStore.js))
- Persistent conversation history
- Memory facts (wallet address, preferences)
- Pending operation tracking

---

## Request Flow

### 1. User Sends Message

```
POST /sessions/:id/messages/stream
Body: {
  content: "swap 1 ETH to USDC",
  walletAddress: "0x...",
  controls: { autoTxMode: "ask" }
}
```

### 2. Agent Loop Starts

```
┌─────────────────────────────────────────────────────────┐
│ Agent Loop (max 10 iterations)                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Build System Prompt                                  │
│     - Available tools                                    │
│     - Memory context (wallet, pending ops)               │
│     - Control modes (autoTxMode, x402Mode)               │
│                                                           │
│  2. Call LLM with Messages                               │
│     - System prompt                                      │
│     - Conversation history                               │
│     - User's message                                     │
│                                                           │
│  3. LLM Response                                         │
│     ┌─────────────────┬────────────────────┐            │
│     │ Tool Calls?     │ Final Response?     │            │
│     └─────────────────┴────────────────────┘            │
│          ↓                        ↓                      │
│     Execute Tools            Return to User              │
│          ↓                                                │
│     Add Results to Messages                              │
│          ↓                                                │
│     Loop Back to Step 2                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3. Tool Execution

**Example: `execute_swap` tool**

```javascript
// 1. Validate inputs (Zod schema)
// 2. Get swap quote from Uniswap
// 3. Check delegation limits (if needed)
// 4. Execute via DelegationSigner
//    → Wraps in DelegationManager.redeemDelegations()
//    → Uses user's ERC-7715 permissions
// 5. Return tx receipt
```

### 4. Stream Events to Client

```
SSE Events:
┌──────────────────────────────────────┐
│ thinking    │ LLM reasoning          │
│ tool_call   │ Tool invocation        │
│ tool_result │ Tool output            │
│ message     │ Final response         │
│ tx_message  │ On-chain confirmation  │
└──────────────────────────────────────┘
```

---

## API Endpoints

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions` | POST | Create new session |
| `/sessions/:id` | GET | Get session details |
| `/sessions/:id/remember` | POST | Store memory fact |
| `/sessions/:id/messages/stream` | POST | Send message (SSE stream) |

### Tools

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tools/:name` | POST | Execute single tool |
| `/tasks` | POST | One-shot agent execution |

### Utility

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Server metrics |
| `/delegation/clear-cache` | POST | Clear delegation cache |
| `/images/:id` | GET | Retrieve stored image |

---

## Agent-to-Agent (A2A) Recurring Transfers

This backend supports recurring transfers via Agent‑to‑Agent (A2A) delegation:

- Companeon creates a sub‑delegation to a Transfer Agent
- The Transfer Agent executes recurring transfers using the user's ERC‑7715 permissions
- Schedules are stored in Firestore; execution can be triggered by a Cloud Function or cron worker

LLM Tools

- `preview_recurring_transfer` – preview and ask for confirmation
- `schedule_recurring_transfer` – create the recurring transfer
- `list_recurring_transfers` – list transfer schedules
- `cancel_recurring_transfer` – cancel by schedule ID
- `trigger_scheduled_now` – call a Cloud Function to run due items (optional)
- `list_all_scheduled` – list both transfers and DCAs (if present)

Environment

- `DCA_AGENT_PRIVATE_KEY` – EOA for the DCA Agent (recurring DCA)
- `TRANSFER_AGENT_PRIVATE_KEY` – EOA for the Transfer Agent (recurring transfers)
- `BACKEND_DELEGATION_KEY` – backend delegate key (ERC‑7715)
- `FIREBASE_FUNCTIONS_URL` – base URL for the trigger endpoint (optional)
- `GOOGLE_CLOUD_PROJECT` / `FIREBASE_PROJECT_ID` – Firestore project

Firestore Collections

- `RecurringTransferSchedules` – recurring transfer metadata
- `SubDelegations` – sub‑delegation records per wallet/schedule

Relevant files

- Sub‑delegation helpers: `backend/src/lib/subDelegation.js`
- Transfer Agent tools: `backend/src/tools/definitions/transfer-agent.js`
- DCA Agent tools: `backend/src/tools/definitions/dca-agent.js`
- Unified management (list/trigger): `backend/src/tools/definitions/autonomous-agents.js`

---

## Available Tools

### Wallet Management
- `get_holdings` - Get ETH and token balances
- `transfer_funds` - Send tokens to recipient
- `execute_swap` - Swap tokens via Uniswap
- `get_swap_quote` - Preview swap rates
- `get_token_balance` - Query specific token balance

### DeFi Utilities
- `get_prices` - Get crypto prices (CoinMarketCap)
- `get_market_sentiment` - Fear & Greed Index
- `estimate_gas_cost` - Gas price estimation
- `get_gas_price` - Current gas prices by tier (slow/standard/fast)
- `check_pool_liquidity` - Uniswap pool liquidity check

### Research (Paid/x402)
- `browse_web` - Perplexity web search (0.001 USDC)
- `generate_image` - Image generation (0.001 USDC)
- `get_x402_quote` - Get quote for paid service
- `pay_x402` - Execute x402 payment
- `list_x402_services` - Available x402 services
- `request_x402_refund` - Request refund for failed service

### Security
- `goplus_check_address` - GoPlus scam/phishing detection
- `envio_check_recipient` - Check recipient address history (Envio)
- `envio_check_interaction` - Verify previous interactions (Envio)

### Delegation
- `check_delegation_limits` - Check ETH/ERC-20 spending limits
- `diagnose_delegation_error` - Debug permission errors

### History (Envio)
- `envio_get_token_transfers` - ERC-20 transfer history
- `envio_get_eth_transfers` - ETH transfer history
- `envio_get_all_transfers` - Unified transfer history
- `envio_get_recent_activity` - Wallet activity summary
- `envio_count_wallet_transactions` - Transaction count stats
- `envio_get_delegation_executions` - Delegated execution audit trail

---

## Environment Variables

### Backend (Required)

```bash
# LLM Configuration (choose one)
GOOGLE_GENAI_API_KEY=        # Google AI Studio key
# OR
GOOGLE_CLOUD_PROJECT=        # GCP project for Vertex AI
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.0-flash-exp

# Blockchain
BACKEND_DELEGATION_KEY=      # Backend delegation key (private key)
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453

# Firestore
GOOGLE_CLOUD_PROJECT=        # For session storage
```

### Backend (Optional)

```bash
# External APIs
PPLX_API_KEY=               # Perplexity (web research)
CMC_API_KEY=                # CoinMarketCap (price data)
GOPLUS_API_KEY=             # GoPlus (security checks)

# x402 (Coinbase)
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=

# Security
INTERNAL_API_KEY=           # API authentication

# Tuning
LOG_LEVEL=info
TIMEOUT_TASK_MS=120000
TIMEOUT_MODEL_MS=30000
MAX_AGENT_ITERATIONS=10
```

### Frontend

```bash
# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# Chain Configuration
NEXT_PUBLIC_DEFAULT_CHAIN_ID=8453  # Base
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org

# WalletConnect (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- Google Cloud Project (for Firestore + Gemini)
- MetaMask Flask or compatible ERC-7715 wallet

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your keys
npm run dev

# Server starts on http://localhost:8080
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your keys
npm run dev

# Open http://localhost:3000
```

---

## Project Structure

```
companeon-ai/
├── README.md
├── backend/
│   ├── src/
│   │   ├── index.js                 # Express server
│   │   ├── agent/
│   │   │   ├── Agent.js            # ReAct loop
│   │   │   └── wallet-prompts.js   # System prompts
│   │   ├── llm/
│   │   │   └── GeminiClient.js     # LLM integration
│   │   ├── tools/
│   │   │   ├── ToolRegistry.js     # Tool management
│   │   │   └── definitions/
│   │   │       ├── wallet-*.js     # Wallet tools
│   │   │       ├── delegation.js   # Permission tools
│   │   │       ├── envio.js        # Envio history tools
│   │   │       └── research.js     # x402 tools
│   │   ├── lib/
│   │   │   ├── delegationSigner.js # ERC-7715 signer
│   │   │   ├── chainConfig.js      # Multi-chain config
│   │   │   └── signer.js           # Signer driver
│   │   └── memory/
│   │       └── FirestoreSessionStore.js
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── app/                    # Next.js App Router
    │   │   ├── [chain]/           # Chain-specific routes
    │   │   └── layout.tsx         # Root layout
    │   ├── components/
    │   │   ├── Chat/              # AI chat interface
    │   │   ├── Dashboard/         # Portfolio & permissions UI
    │   │   ├── GrantPermissionsModal/ # ERC-7715 grant UI
    │   │   └── shared/            # Reusable components
    │   ├── lib/
    │   │   ├── smartAccount/
    │   │   │   └── grantPermissions.ts # ERC-7715 grant logic
    │   │   ├── wallets/           # Wallet providers
    │   │   └── api/               # Backend API client
    │   ├── hooks/                 # React hooks
    │   └── context/               # React context providers
    ├── package.json
    └── .env.example
```

---

## Tech Stack

**Frontend:** Next.js 14, TypeScript, Tailwind CSS, MetaMask Smart Accounts Kit

**Backend:** Node.js, Express, Google Gemini 2.5 Flash, ethers.js, viem

**Infrastructure:** Envio HyperSync, Cloud Firestore, Uniswap V4

---

## Safety Features

**Spending Limits**
- Enforced on-chain via ERC-7715
- Daily/hourly reset periods
- Per-token limits

**Duplicate Prevention**
- Tracks write operations (swaps, transfers)
- Blocks identical parallel calls
- Allows different operations (multi-swap)

**Confirmation Modes**
```javascript
autoTxMode: 'ask'   // Requires user approval (default)
autoTxMode: 'auto'  // Executes immediately
```

**Error Recovery**
- Automatic retry with exponential backoff
- Smart error categorization
- Recovery suggestions for LLM
- Max 3 attempts per error type

---

## Deployment

### Google Cloud Run (Backend)

```bash
cd backend
docker build -t companeon-backend .
docker tag companeon-backend gcr.io/PROJECT_ID/companeon-backend
docker push gcr.io/PROJECT_ID/companeon-backend

gcloud run deploy companeon-backend \
  --image gcr.io/PROJECT_ID/companeon-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars="GOOGLE_GENAI_API_KEY=..." \
  --set-env-vars="BACKEND_DELEGATION_KEY=..." \
  --set-env-vars="RPC_URL=https://mainnet.base.org"
```

### Vercel (Frontend)

```bash
cd frontend
vercel
```

---

## License

Apache License 2.0 with Commons Clause

Free for personal, educational, and non-commercial use. Commercial use requires licensing.

---

Built for MetaMask Advanced Permissions Hackathon 2025
