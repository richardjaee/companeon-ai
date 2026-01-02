# Companeon Frontend

Next.js frontend for Companeon - A wallet-native AI agent for conversational crypto management.

Built with **Next.js 14** · **TypeScript** · **Tailwind CSS** · **MetaMask Smart Accounts Kit**

---

## Features

- **Wallet Connection**: Multi-wallet support (MetaMask, Coinbase, WalletConnect, etc.)
- **ERC-7715 Permissions**: Grant and manage AI agent delegations
- **Chat Interface**: Conversational AI agent interaction
- **Portfolio View**: Real-time wallet holdings and balances
- **Permission Management**: View and control agent spending limits
- **Multi-Chain**: Base, Ethereum, Sepolia support

---

## Installation

### Prerequisites
- Node.js 18+
- Backend API running (see [companeon-ai](https://github.com/YOUR_USERNAME/companeon-ai))

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Run development server
npm run dev

# Open http://localhost:3000
```

---

## Environment Variables

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

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [chain]/           # Chain-specific routes
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/
│   ├── Chat/              # AI chat interface
│   ├── Dashboard/         # Portfolio & permissions UI
│   ├── Auth/              # Wallet connection
│   └── shared/            # Reusable components
├── lib/
│   ├── smartAccount/      # ERC-7715 integration
│   ├── wallets/           # Wallet providers
│   ├── api/               # Backend API client
│   └── config/            # Chain configurations
├── hooks/                 # React hooks
├── context/               # React context providers
└── types/                 # TypeScript types
```

---

## Key Technologies

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Permissions** | MetaMask Smart Accounts Kit (ERC-7715) |
| **Wallet** | ethers.js + EIP-6963 |
| **State** | React Context |

---

## Development

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run type-check
```

---

## Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel
```

### Google Cloud Run

```bash
# Build Docker image
docker build -t companeon-frontend .

# Deploy to Cloud Run
gcloud run deploy companeon-frontend \
  --image gcr.io/PROJECT_ID/companeon-frontend \
  --platform managed \
  --region us-central1 \
  --set-env-vars="NEXT_PUBLIC_BACKEND_URL=https://your-backend.com"
```

---

## License

Apache License 2.0 with Commons Clause

This project is free for personal, educational, and non-commercial use. You may not use this software to provide commercial services. For commercial licensing inquiries, please contact the Companeon team.

---

## Related Repos

- [Companeon Backend](https://github.com/YOUR_USERNAME/companeon-ai) - AI agent backend with ERC-7715 delegation
