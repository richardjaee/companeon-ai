# Privacy Policy

**Last Updated: February 11, 2025**

This Privacy Policy describes how Companeon ("we," "us," or "our") collects, uses, and shares information when you use our platform, website, AI agent, and related services (the "Service"). By using the Service, you agree to the practices described in this policy.

---

## 1. Information We Collect

### 1.1 Wallet Information

When you connect your cryptocurrency wallet, we collect:

- **Wallet address:** Your public blockchain address used to identify your account
- **Chain and network information:** The blockchain network you are connected to
- **Connection method:** The wallet provider used (e.g., MetaMask, Coinbase Wallet, WalletConnect, Web3Auth)

We do **not** collect your private keys, seed phrases, or wallet passwords. Companeon is a non-custodial service and never has access to your signing credentials.

### 1.2 Permission Data

When you grant ERC-7715 permissions, we store:

- Permission contexts including token addresses, spending limits, and time bounds
- Delegation metadata required to execute transactions on your behalf
- Permission status (active, revoked, expired)

### 1.3 Conversation and Chat Data

When you interact with the AI agent, we collect:

- Chat messages and conversation history
- AI agent responses and reasoning steps
- Tool calls and their results (e.g., price lookups, balance queries)
- Session metadata (timestamps, session IDs)

### 1.4 Transaction Data

When the AI agent executes transactions, we log:

- Transaction hashes and on-chain references
- Transaction parameters (token addresses, amounts, recipients)
- Execution status and error information
- Credit usage associated with transactions

### 1.5 Credit and Payment Data

When you purchase credits, we collect:

- USDC payment transaction hashes
- Credit balance and usage history
- Payment amounts and timestamps

We do not collect traditional payment information (credit card numbers, bank accounts) as all payments are processed on-chain.

### 1.6 Autonomous Agent Data

If you deploy OpenClaw autonomous agents, we collect:

- Agent configuration (skills, limits, channels)
- Agent activity logs (actions taken, transactions executed)
- Channel integration tokens (encrypted at rest with AES-256-GCM)

### 1.7 Technical and Usage Data

We automatically collect:

- Browser type and version
- Device information and operating system
- IP address (for rate limiting and abuse prevention)
- Pages visited and features used
- Error logs and crash reports (via Sentry)
- Performance metrics

## 2. How We Use Your Information

We use the information we collect to:

- **Provide the Service:** Execute transactions, manage permissions, process credit purchases, and operate the AI agent
- **Maintain your session:** Persist conversation history and preferences across interactions
- **Improve the Service:** Analyze usage patterns, debug errors, and enhance AI agent accuracy
- **Ensure security:** Detect and prevent fraud, abuse, and unauthorized access
- **Communicate with you:** Send transaction confirmations, error notifications, and service updates through the chat interface
- **Comply with legal obligations:** Respond to lawful requests and enforce our Terms of Service

## 3. Blockchain and On-Chain Data

### 3.1 Public Nature of Blockchain Data

You acknowledge that blockchain transactions are recorded on public, immutable ledgers. This means:

- Your wallet address and transaction history are publicly visible to anyone
- Transactions executed by the AI agent on your behalf are publicly visible
- Companeon cannot delete, modify, or hide on-chain transaction data
- Third parties may independently observe and analyze your on-chain activity

### 3.2 On-Chain vs. Off-Chain Data

The data we store off-chain (conversation history, session data, credit balances) is separate from on-chain data. Our data retention and deletion practices apply only to off-chain data we control.

## 4. How We Share Your Information

### 4.1 We Do Not Sell Your Data

We do not sell, rent, or trade your personal information to third parties for marketing purposes.

### 4.2 Service Providers

We share data with third-party service providers who help us operate the Service:

| Provider | Purpose | Data Shared |
|----------|---------|-------------|
| Google Cloud Platform | Infrastructure, database hosting (Firestore) | All off-chain data (encrypted at rest) |
| Sentry | Error monitoring and crash reporting | Error logs, device info, IP addresses |
| Blockchain RPC Providers | Transaction submission and blockchain queries | Wallet addresses, transaction data |
| Envio HyperSync | Historical blockchain data indexing | Wallet addresses, query parameters |

### 4.3 Third-Party Wallet and DeFi Services

When you use the Service, your wallet provider (MetaMask, Coinbase Wallet, WalletConnect, Web3Auth) and DeFi protocols (Uniswap, etc.) may independently collect data according to their own privacy policies. We encourage you to review their policies.

### 4.4 Legal Requirements

We may disclose your information if required by law, regulation, legal process, or governmental request, or if we believe disclosure is necessary to:

- Comply with applicable law or legal obligations
- Protect the rights, property, or safety of Companeon, our users, or the public
- Detect, prevent, or address fraud, security, or technical issues

### 4.5 Business Transfers

In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.

## 5. Data Storage and Security

### 5.1 Storage Location

Your off-chain data is stored on Google Cloud Platform infrastructure. Data may be processed and stored in the United States or other regions where Google Cloud operates.

### 5.2 Security Measures

We implement reasonable security measures to protect your data, including:

- Encryption at rest for all data stored in Firestore
- AES-256-GCM encryption for sensitive credentials (e.g., channel bot tokens)
- HTTPS/TLS for all data in transit
- Access controls and authentication for backend services
- Security headers (CSP, HSTS, XSS protection) on all web traffic

### 5.3 No Guarantee

While we take reasonable steps to protect your data, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security of your information.

## 6. Data Retention

We retain your data as follows:

| Data Type | Retention Period |
|-----------|-----------------|
| Wallet address and permissions | As long as your permissions are active, plus 90 days after revocation |
| Conversation history | As long as your account is active, or until you request deletion |
| Transaction logs | Indefinitely (for audit and compliance purposes) |
| Credit purchase records | Indefinitely (for financial record-keeping) |
| Autonomous agent logs | 90 days after agent termination |
| Error logs and analytics | 90 days |
| Technical/usage data | 90 days |

On-chain data is retained permanently on the blockchain and is outside our control.

## 7. Your Rights and Choices

### 7.1 Access and Export

You may request a copy of the personal data we hold about you by contacting us.

### 7.2 Deletion

You may request deletion of your off-chain data, including conversation history, session data, and account information. Please note:

- On-chain data (transactions, permissions) cannot be deleted as it resides on the blockchain
- We may retain certain data as required by law or for legitimate business purposes (e.g., fraud prevention, financial records)
- Credit purchase records may be retained for accounting and compliance purposes

### 7.3 Revoke Permissions

You can revoke your ERC-7715 permissions at any time through the Service interface, which immediately stops the AI agent from executing transactions on your behalf.

### 7.4 Disconnect Wallet

You can disconnect your wallet from the Service at any time. This stops new data collection but does not automatically delete previously collected data.

### 7.5 Opt-Out of Analytics

You can limit analytics data collection by using browser privacy features, ad blockers, or disabling JavaScript. Note that disabling JavaScript will prevent the Service from functioning.

## 8. Cookies and Local Storage

The Service uses browser local storage and session storage for:

- Wallet connection state and session persistence
- User preferences and UI settings
- Authentication tokens

We do not use third-party advertising cookies. Sentry may set cookies for error tracking purposes.

## 9. International Data Transfers

If you are accessing the Service from outside the United States, your data may be transferred to, stored, and processed in the United States or other countries where our service providers operate. By using the Service, you consent to these transfers.

For users in the European Economic Area (EEA), United Kingdom, or other jurisdictions with data protection laws, we rely on standard contractual clauses and other lawful transfer mechanisms.

## 10. Children's Privacy

The Service is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children under 18. If we learn that we have collected data from a child under 18, we will take steps to delete that information promptly.

## 11. California Privacy Rights

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):

- **Right to Know:** You can request details about the categories and specific pieces of personal information we collect
- **Right to Delete:** You can request deletion of your personal information, subject to certain exceptions
- **Right to Non-Discrimination:** We will not discriminate against you for exercising your privacy rights
- **No Sale of Personal Information:** We do not sell your personal information

## 12. European Privacy Rights

If you are in the EEA or UK, you have rights under the General Data Protection Regulation (GDPR):

- **Right of Access:** Request a copy of your data
- **Right to Rectification:** Request correction of inaccurate data
- **Right to Erasure:** Request deletion of your data (subject to legal obligations)
- **Right to Restrict Processing:** Request limitation of how we use your data
- **Right to Data Portability:** Receive your data in a structured, machine-readable format
- **Right to Object:** Object to processing based on legitimate interests
- **Right to Withdraw Consent:** Withdraw consent at any time where processing is based on consent

To exercise these rights, contact us using the information below.

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be communicated by updating the "Last Updated" date at the top of this page. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.

We encourage you to review this policy periodically.

## 14. Contact Us

If you have questions about this Privacy Policy or wish to exercise your privacy rights, you can reach us at:

- **Website:** [companeon.io](https://companeon.io)
- **GitHub:** [github.com/richardjaee/companeon-ai](https://github.com/richardjaee/companeon-ai)
