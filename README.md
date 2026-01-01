# Companeon Agent Backend

Wallet-native AI agent backend that executes on-chain transactions through conversational prompts using ERC-7715 delegated permissions.

Built with **Express** · **Google Gemini 2.5** · **ERC-7715** · **Envio HyperSync** · **Firestore**

---

## Quick Start

1) Install

```bash
npm install
```

2) Configure

- Copy `.env.example` to `.env` and set required values

3) Run

```bash
npm run dev
# or: npm start
```

4) Check

```bash
curl http://localhost:${PORT:-8080}/health
curl http://localhost:${PORT:-8080}/version
```

Entry point: `server.js` (calls `src/index.js`).

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

#### 1. **Express API Server** (`src/index.js`)
- RESTful + SSE streaming endpoints
- Session management (Firestore)
- Request authentication
- Chain context management

#### 2. **Agent (ReAct Loop)** (`src/agent/Agent.js`)
- Iterative reasoning loop: Think → Act → Observe
- Tool selection and execution
- Autonomous error recovery
- Duplicate call prevention
- Auto-diagnosis for delegation errors

#### 3. **Tool Registry** (`src/tools/`)
- **Wallet Tools**: Holdings, swaps, transfers
- **DeFi Tools**: Uniswap integration, gas estimation
- **Research Tools**: Perplexity search (x402), price data
- **Security Tools**: GoPlus recipient verification, Envio transaction history
- **Delegation Tools**: Limit checking, permission diagnosis

#### 4. **LLM Client** (`src/llm/GeminiClient.js`)
- Google Gemini 2.5 Flash integration
- Native function calling
- Streaming responses

#### 5. **Delegation Signer** (`src/lib/delegationSigner.js`)
- ERC-7715 transaction wrapping
- MetaMask Smart Accounts Kit integration
- Permission context management

#### 6. **Session Store** (`src/memory/FirestoreSessionStore.js`)
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
| `/version` | GET | Service name and version |
| `/metrics` | GET | Server metrics |
| `/delegation/clear-cache` | POST | Clear delegation cache |
| `/images/:id` | GET | Retrieve stored image |

---

## ERC-7715 Delegation Flow

### 1. Permission Grant (Frontend)

```javascript
// User grants permissions via MetaMask
const delegation = await grantDelegation({
  delegator: userWallet,    // User's wallet
  delegate: backendKey,     // Backend signer
  permissions: [
    { token: 'ETH', limit: '0.1 ETH per day' },
    { token: 'USDC', limit: '100 USDC per day' }
  ]
});

// Store in Firestore
POST /register-wallet-agent
Body: { walletAddress, permissionsContext }
```

### 2. Transaction Execution (Backend)

```javascript
// Backend wraps tx in delegation
const tx = {
  to: USDC_ADDRESS,
  data: transferData,  // transfer(recipient, amount)
  value: 0n
};

// DelegationSigner wraps this in:
DelegationManager.redeemDelegations(
  [permissionsContext],  // User's delegation
  [executionMode],       // Single call
  [encodedExecution]     // The actual tx
);

// On-chain enforcement:
// - DelegationManager checks spending limits
// - Reverts if exceeded
// - Updates spent amounts
```

### 3. Permission-Aware Tools

**`check_delegation_limits`** - Query live on-chain permission state

Uses MetaMask SDK methods:
- `getNativeTokenPeriodTransferEnforcerAvailableAmount()` - ETH remaining
- `getErc20PeriodTransferEnforcerAvailableAmount()` - ERC-20 remaining
- `decodeExpirationFromDelegation()` - Expiry date

Returns:
```json
{
  "eth": {
    "available": "0.5 ETH",
    "resetsIn": "3 hours",
    "expiresAt": "2025-02-01"
  },
  "usdc": {
    "available": "50 USDC",
    "resetsIn": "1 day",
    "expiresAt": "2025-02-01"
  }
}
```

**`diagnose_delegation_error`** - Parse revert messages

Translates enforcer errors:
- `NativeTokenPeriodTransferEnforcer:transfer-amount-exceeded`
- `ERC20PeriodTransferEnforcer:transfer-amount-exceeded`
- Timestamp expiration failures

Into plain English:
```
"This transfer exceeds your daily ETH limit.
You can wait for the reset, reduce the amount, or extend your permission."
```

### 4. Error Recovery

If delegation fails:
1. Agent auto-calls `diagnose_delegation_error`
2. Checks current limits vs. requested amount
3. Explains to user what happened
4. Suggests: reduce amount, wait for reset, or grant new permissions

---

## Envio Integration

### HyperSync Query Endpoint

All Envio tools use:
```
POST https://sepolia.hypersync.xyz/query
```

~2000× faster than standard RPC polling.

### Envio-Wrapped Agent Tools

| Tool | Query Type | Purpose |
|------|------------|---------|
| `envio_get_token_transfers` | ERC-20 Transfer logs | Token transfer history |
| `envio_get_eth_transfers` | Native transactions | ETH transfer history |
| `envio_get_all_transfers` | Parallel ETH + ERC-20 | Unified transfer timeline |
| `envio_get_recent_activity` | Aggregated logs | Wallet activity summary |
| `envio_count_wallet_transactions` | Count-focused queries | Transaction volume stats |
| `envio_get_delegation_executions` | RedeemedDelegation events | AI action audit trail |
| `envio_check_recipient` | Historical lookups | First-time vs known address |

**Example: `envio_get_delegation_executions`**

Tracks all ERC-7715 delegated executions:
- When permissions were used
- Who executed (user vs AI agent)
- What was executed
- On-chain verification via RedeemedDelegation events

Enables queries like:
- *"What actions has the AI taken with my wallet?"*
- *"Show delegated transactions this week"*

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

### Required

```bash
# LLM Configuration (choose one)
GOOGLE_GENAI_API_KEY=        # Google AI Studio key (easiest)
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

### Optional

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

---

## Installation

### Prerequisites
- Node.js 18+
- Google Cloud Project (for Firestore + Gemini)
- Private key for delegation signing

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys

# 3. Set up Firestore
# Create collections: sessions, UserWallets

# 4. Run locally
npm run dev

# Server starts on http://localhost:8080
```

---

## Deployment

### Google Cloud Run

```bash
# Build container
docker build -t companeon-agent .

# Push to GCR
docker tag companeon-agent gcr.io/PROJECT_ID/companeon-agent
docker push gcr.io/PROJECT_ID/companeon-agent

# Deploy
gcloud run deploy companeon-agent \
  --image gcr.io/PROJECT_ID/companeon-agent \
  --platform managed \
  --region us-central1 \
  --set-env-vars="GOOGLE_GENAI_API_KEY=..." \
  --set-env-vars="BACKEND_DELEGATION_KEY=..." \
  --set-env-vars="RPC_URL=https://mainnet.base.org"
```

### Required Permissions
- Firestore read/write
- KMS decrypt (if using encrypted keys)
- Cloud Run execute

---

## Safety Features

### Spending Limits
- Enforced on-chain via ERC-7715
- Daily/hourly reset periods
- Per-token limits

### Duplicate Prevention
- Tracks write operations (swaps, transfers)
- Blocks identical parallel calls
- Allows different operations (multi-swap)

### Confirmation Modes
```javascript
autoTxMode: 'ask'   // Requires user approval (default)
autoTxMode: 'auto'  // Executes immediately
```

### Error Recovery
- Automatic retry with exponential backoff
- Smart error categorization
- Recovery suggestions for LLM
- Max 3 attempts per error type

---

## Project Structure

```
backend/
├── src/
│   ├── index.js                 # Express server
│   ├── agent/
│   │   ├── Agent.js            # ReAct loop
│   │   └── wallet-prompts.js   # System prompts
│   ├── llm/
│   │   └── GeminiClient.js     # LLM integration
│   ├── tools/
│   │   ├── ToolRegistry.js     # Tool management
│   │   └── definitions/        # Tool implementations
│   │       ├── wallet-*.js     # Wallet tools
│   │       ├── delegation.js   # Permission tools
│   │       ├── research.js     # x402 tools
│   │       ├── envio.js        # Envio history tools
│   │       └── ...
│   ├── lib/
│   │   ├── delegationSigner.js # ERC-7715 signer
│   │   ├── chainConfig.js      # Multi-chain config
│   │   └── signer.js           # Signer driver
│   ├── memory/
│   │   └── FirestoreSessionStore.js
│   └── config/
│       └── runtime.js
├── .env.example
├── package.json
└── README.md
```

---

## Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|------------|
| **Runtime** | Node.js + Express | API server |
| **LLM** | Google Gemini 2.5 Flash | Reasoning & tool calling |
| **Blockchain** | ethers.js + viem | Web3 interactions |
| **Delegation** | MetaMask Smart Accounts Kit | ERC-7715 permissions |
| **Storage** | Cloud Firestore | Sessions & memory |
| **Indexer** | Envio HyperSync | Blockchain history queries |
| **Schema** | Zod | Input validation |
| **Logging** | Winston | Structured logs |
| **DEX** | Uniswap V4 | Token swaps |

---

## Development

### Run Tests
```bash
npm test
```

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

### Clear Session Cache
```bash
curl -X POST http://localhost:8080/delegation/clear-cache
```

---

## Troubleshooting

### "Delegation limit exceeded"
- Check current limits: `check_delegation_limits` tool
- Wait for daily reset, or grant new permissions

### "RPC URL not configured"
- Set `RPC_URL` in `.env`
- Verify chain ID matches network

### "Firestore initialization failed"
- Set `GOOGLE_CLOUD_PROJECT`
- Verify service account permissions

### "Tool timeout"
- Increase `TIMEOUT_TOOL_MS` for slow operations
- Check RPC provider status

---

## License

Apache License 2.0 with Commons Clause

This project is free for personal, educational, and non-commercial use. You may not use this software to provide commercial services. For commercial licensing inquiries, please contact the Companeon team.

---

## Resources

- [ERC-7715 Spec](https://eips.ethereum.org/EIPS/eip-7715)
- [MetaMask Smart Accounts Kit](https://docs.metamask.io/smart-accounts-kit/)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)
- [Uniswap V4 Docs](https://docs.uniswap.org/)
- [Envio HyperSync](https://docs.envio.dev/docs/HyperSync/overview)
