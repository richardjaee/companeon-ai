# Companeon

**First Place Winner - MetaMask Advanced Permissions Hackathon** | [New Project Track](https://x.com/metamaskdev/status/2014352928941674728)

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

## Project Structure

```
companeon-ai/
├── README.md
├── agent/
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
│   │   │       ├── aggregator.js   # 0x DEX aggregator
│   │   │       ├── delegation.js   # Permission tools
│   │   │       ├── envio.js        # Envio history tools
│   │   │       ├── transfer-agent.js      # A2A: recurring transfers
│   │   │       ├── dca-agent.js           # A2A: recurring DCA
│   │   │       └── autonomous-agents.js   # A2A: unified list/trigger
│   │   ├── lib/
│   │   │   ├── delegationSigner.js # ERC-7715 signer
│   │   │   ├── subDelegation.js    # A2A helpers (EIP-712, chain)
│   │   │   └── chainConfig.js      # Multi-chain config
│   │   └── memory/
│   │       └── FirestoreSessionStore.js
│   ├── package.json
│   └── .env.example
│
├── services/
│   ├── api/                     # API Gateway service
│   │   └── src/index.js
│   └── worker/                  # Background worker service
│       └── src/index.js
│
├── Makefile                     # Build and deploy commands
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
- [`agent/src/lib/delegationSigner.js`](./agent/src/lib/delegationSigner.js) - `DelegationSigner` class wraps all transactions in `DelegationManager.redeemDelegations()`, routes ETH vs ERC-20 executions through correct permission contexts

Permission-aware tools:
- [`agent/src/tools/definitions/delegation.js`](./agent/src/tools/definitions/delegation.js) - Agent tools for querying live permission state (`check_delegation_limits`) and diagnosing enforcer errors (`diagnose_delegation_error`)

### Agent‑to‑Agent (A2A) Delegation

In addition to direct wallet execution, Companeon supports Agent‑to‑Agent sub‑delegation for scheduled automation:

- User → Companeon permissions are granted via ERC‑7715 (MetaMask Smart Accounts Kit)
- Companeon → Agent (Transfer/DCA) sub‑delegations are created and signed (EIP‑712)
- Execution uses a chained context validated by the DelegationManager

Code links:
- Sub‑delegation helpers: [`agent/src/lib/subDelegation.js`](./agent/src/lib/subDelegation.js)
- Transfer Agent tools: [`agent/src/tools/definitions/transfer-agent.js`](./agent/src/tools/definitions/transfer-agent.js)
- DCA Agent tools: [`agent/src/tools/definitions/dca-agent.js`](./agent/src/tools/definitions/dca-agent.js)
- Unified list/trigger: [`agent/src/tools/definitions/autonomous-agents.js`](./agent/src/tools/definitions/autonomous-agents.js)

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
- [`agent/src/tools/definitions/envio.js`](./agent/src/tools/definitions/envio.js) - Contains 7 agent-callable tools that wrap HyperSync queries

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

**1. Express API Server** ([`agent/src/index.js`](./agent/src/index.js))
- RESTful + SSE streaming endpoints
- Session management (Firestore)
- Request authentication
- Chain context management

**2. Agent (ReAct Loop)** ([`agent/src/agent/Agent.js`](./agent/src/agent/Agent.js))
- Iterative reasoning loop: Think → Act → Observe
- Tool selection and execution
- Autonomous error recovery
- Duplicate call prevention
- Auto-diagnosis for delegation errors

**3. Tool Registry** ([`agent/src/tools/`](./agent/src/tools/))
- Wallet Tools: Holdings, swaps, transfers
- DeFi Tools: 0x DEX aggregator, gas estimation, price data
- Research Tools: Perplexity search (x402), web browsing
- Security Tools: GoPlus recipient verification, Envio transaction history
- Delegation Tools: Limit checking, permission diagnosis

**4. LLM Client** ([`agent/src/llm/GeminiClient.js`](./agent/src/llm/GeminiClient.js))
- Google Gemini 2.5 Flash integration
- Native function calling
- Streaming responses

**5. Delegation Signer** ([`agent/src/lib/delegationSigner.js`](./agent/src/lib/delegationSigner.js))
- ERC-7715 transaction wrapping
- MetaMask Smart Accounts Kit integration
- Permission context management

**6. Session Store** ([`agent/src/memory/FirestoreSessionStore.js`](./agent/src/memory/FirestoreSessionStore.js))
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

- `BACKEND_SUBDELEGATION_KEY` – EOA for sub-delegated agents (recurring transfers, DCA swaps)
- `BACKEND_DELEGATION_KEY` – backend delegate key (ERC‑7715)
- `FIREBASE_FUNCTIONS_URL` – base URL for the trigger endpoint (optional)
- `GOOGLE_CLOUD_PROJECT` / `FIREBASE_PROJECT_ID` – Firestore project

Firestore Collections

- `RecurringTransferSchedules` – recurring transfer metadata
- `SubDelegations` – sub‑delegation records per wallet/schedule

Relevant files

- Sub‑delegation helpers: `agent/src/lib/subDelegation.js`
- Transfer Agent tools: `agent/src/tools/definitions/transfer-agent.js`
- DCA Agent tools: `agent/src/tools/definitions/dca-agent.js`
- Unified management (list/trigger): `agent/src/tools/definitions/autonomous-agents.js`

---

## Available Tools

### Wallet Management
- `get_holdings` - Get ETH and token balances
- `transfer_funds` - Send tokens to recipient
- `get_token_balance` - Query specific token balance

### DEX Aggregator (0x)
- `get_aggregated_quote` - Get best swap rate across DEXs (supports Ethereum, Base, Arbitrum, Optimism, Polygon)
- `execute_aggregated_swap` - Execute swap via 0x aggregator
- `lookup_token` - Find token address by symbol (uses Uniswap token lists)

### DeFi Utilities
- `get_prices` - Get crypto prices (CoinMarketCap)
- `get_market_sentiment` - Fear & Greed Index
- `estimate_gas_cost` - Gas price estimation
- `get_gas_price` - Current gas prices by tier (slow/standard/fast)

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
- Docker (for local builds)
- Google Cloud Project (for Firestore + Gemini)
- gcloud CLI (for deployment)
- MetaMask Flask or compatible ERC-7715 wallet

### Quick Start (Local Development)

```bash
# Clone the repo
git clone https://github.com/anthropics/companeon-ai.git
cd companeon-ai

# Start all services with Docker
make dev

# Or start individual services:
make agent    # Backend agent on :8080
make api      # API gateway
make worker   # Background worker
```

### Manual Setup

**Backend (Agent)**
```bash
cd agent
npm install
cp .env.example .env
# Edit .env with your keys
npm run dev

# Server starts on http://localhost:8080
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your keys
npm run dev

# Open http://localhost:3000
```

**Additional Services**
```bash
# API Gateway
cd services/api && npm install && npm run dev

# Background Worker
cd services/worker && npm install && npm run dev
```

---

##

## Tech Stack

**Frontend:** Next.js 15, TypeScript, Tailwind CSS, MetaMask Smart Accounts Kit, Coinbase Wallet SDK, WalletConnect

**Backend:** Node.js, Express, Google Gemini 2.5 Flash, ethers.js, viem, Zod

**DeFi:** 0x DEX Aggregator, Uniswap Token Lists, CoinMarketCap API

**Infrastructure:** Google Cloud Run, Envio HyperSync, Cloud Firestore

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

All services deploy to **Google Cloud Run**. Use the Makefile for quick deployments.

### Quick Deploy (Recommended)

```bash
# Deploy individual services to dev
make deploy-agent-dev    # Deploy agent
make deploy-api-dev      # Deploy API gateway
make deploy-worker-dev   # Deploy background worker

# Deploy all services to dev
make deploy-dev

# Deploy to production
make deploy-agent        # Agent to prod
make deploy-api          # API to prod
make deploy-worker       # Worker to prod
make deploy-prod         # All services to prod
```

### First-Time Setup

1. **Configure gcloud CLI**
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

2. **Set environment variables** (one-time, persists across deploys)
```bash
gcloud run services update companeon-agent-dev \
  --region us-central1 \
  --set-env-vars="GOOGLE_GENAI_API_KEY=..." \
  --set-env-vars="BACKEND_DELEGATION_KEY=..." \
  --set-env-vars="RPC_URL=https://mainnet.base.org" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=your-project"
```

3. **Deploy**
```bash
make deploy-agent-dev
```

### Manual Docker Deploy

```bash
# Build and push
cd agent
docker build -t us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/agent:dev .
docker push us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/agent:dev

# Deploy to Cloud Run
gcloud run deploy companeon-agent-dev \
  --image us-central1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/agent:dev \
  --region us-central1 \
  --allow-unauthenticated
```

### View Deployment Status

```bash
# List all services
make urls

# Check specific service
gcloud run revisions list --service=companeon-agent-dev --region=us-central1
```

---

## License

Apache License 2.0 with Commons Clause

Free for personal, educational, and non-commercial use. Commercial use requires licensing.

---

**First Place Winner** - MetaMask Advanced Permissions Hackathon 2025 (New Project Track)
