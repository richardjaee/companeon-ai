# Terms of Service

**Last Updated: February 11, 2025**

Welcome to Companeon. These Terms of Service ("Terms") govern your access to and use of the Companeon platform, including our website, AI agent, APIs, and related services (collectively, the "Service"). By connecting your wallet or using the Service, you agree to be bound by these Terms.

If you do not agree to these Terms, do not use the Service.

---

## 1. Description of Service

Companeon is a non-custodial, wallet-native AI agent that converts conversational prompts into on-chain blockchain transactions. The Service enables you to:

- Connect a compatible cryptocurrency wallet
- Grant scoped, time-bound spending permissions to an AI agent using the ERC-7715 standard
- Interact with the AI agent via natural language to execute token swaps, transfers, and other on-chain operations
- Deploy autonomous sub-agents ("OpenClaw Agents") that operate within your delegated permissions
- Purchase usage credits to access agent functionality

Companeon does not take custody of your funds, private keys, or seed phrases at any time. All transactions are executed through smart contract delegations that you explicitly authorize and can revoke at any time.

## 2. Eligibility

To use the Service, you must:

- Be at least 18 years of age (or the age of majority in your jurisdiction)
- Have the legal capacity to enter into a binding agreement
- Not be a resident of, or located in, any jurisdiction where the use of cryptocurrency services is prohibited or restricted
- Not be listed on any sanctions list maintained by the United States (OFAC), European Union, United Nations, or any other applicable authority
- Comply with all applicable local, state, national, and international laws and regulations

## 3. Wallet Connection and Authentication

### 3.1 Wallet Providers

The Service supports wallet connections through third-party providers including MetaMask, Coinbase Wallet, WalletConnect, and Web3Auth. Your use of these wallet providers is subject to their respective terms of service and privacy policies. Companeon is not responsible for the operation, security, or availability of third-party wallet providers.

### 3.2 Account Responsibility

You are solely responsible for:

- Maintaining the security of your wallet, private keys, and seed phrases
- All activity that occurs through your connected wallet on the Service
- Ensuring your wallet software is up to date and secure

Companeon will never ask for your private keys or seed phrases.

## 4. ERC-7715 Permissions

### 4.1 Permission Grants

The Service uses the ERC-7715 Advanced Permissions standard to enable AI-assisted transactions. When you grant permissions, you:

- Specify which tokens the AI agent may interact with
- Set per-token spending limits (daily, weekly, or custom periods)
- Define time-bound validity windows with start and end dates
- Authorize the AI agent to execute transactions within these constraints

### 4.2 On-Chain Enforcement

Permissions are enforced on-chain via smart contract enforcers. The AI agent cannot exceed the spending limits, token restrictions, or time bounds you have set. All delegated transactions are executed through the `DelegationManager` contract, which validates permissions before execution.

### 4.3 Revocation

You may revoke your ERC-7715 permissions at any time through the Service interface or directly on-chain. Revocation takes effect immediately and prevents the AI agent from executing any further transactions on your behalf.

### 4.4 Your Responsibility

You are solely responsible for the permission parameters you configure. Companeon provides tools to set spending limits and time bounds, but the final configuration is your decision. You should carefully review all permission settings before granting them.

## 5. AI Agent and Autonomous Agents

### 5.1 AI-Assisted Transactions

The AI agent interprets your natural language requests and attempts to execute corresponding on-chain transactions. While the agent is designed to follow your instructions accurately, you acknowledge that:

- AI systems can misinterpret instructions or produce unexpected results
- The agent relies on third-party data sources (price feeds, liquidity pools, blockchain state) that may be inaccurate or delayed
- Transaction outcomes depend on blockchain network conditions, including gas prices, network congestion, and MEV (Maximal Extractable Value)
- You should review transaction details before confirming execution

### 5.2 Not Financial Advice

The Service, including any information, analysis, or suggestions provided by the AI agent, does not constitute financial advice, investment advice, trading advice, or any other form of professional advice. The AI agent's outputs are for informational and transactional purposes only. You are solely responsible for your investment and trading decisions.

### 5.3 OpenClaw Autonomous Agents

You may deploy autonomous sub-agents through the OpenClaw integration. These agents operate within the scope of your ERC-7715 delegation and are subject to additional constraints:

- Each wallet is limited to a maximum number of active autonomous agents
- Autonomous agents execute transactions according to their configured skills (trading, transfers, monitoring, DeFi) without requiring per-transaction approval
- You are responsible for configuring appropriate limits and monitoring agent activity
- You may pause, resume, or terminate autonomous agents at any time

### 5.4 Sub-Delegation

When you create autonomous agents, Companeon issues sub-delegations derived from your primary ERC-7715 permission grant. Sub-delegations inherit the constraints of the parent delegation and cannot exceed its scope.

## 6. Credits and Payments

### 6.1 Credit System

The Service operates on a credit-based system. Credits are required to use the AI agent's transaction execution capabilities.

### 6.2 Free Credits

New users may receive a limited number of free credits upon their first session. Free credits are non-transferable and may expire.

### 6.3 Credit Purchases

Credits can be purchased using USDC (USD Coin) on supported blockchain networks. When you purchase credits:

- Payment is processed on-chain via a direct USDC transfer
- Credit purchases are verified by parsing the on-chain Transfer event
- Credits are credited to your wallet address upon successful verification

### 6.4 No Refunds

All credit purchases are final and non-refundable. Due to the on-chain nature of payments, Companeon cannot reverse completed transactions. Credits have no cash value and cannot be redeemed for cryptocurrency or fiat currency.

### 6.5 Pricing Changes

Companeon reserves the right to modify credit pricing at any time. Changes will not affect credits already purchased.

## 7. Blockchain Risks

By using the Service, you acknowledge and accept the following risks inherent to blockchain technology:

### 7.1 Transaction Irreversibility

Blockchain transactions, once confirmed, are irreversible. Companeon cannot undo, reverse, or cancel a confirmed transaction. If you send tokens to an incorrect address or execute an unintended swap, those assets may be permanently lost.

### 7.2 Gas Fees

All on-chain transactions require gas fees paid in the network's native token (e.g., ETH). Gas fees are determined by network conditions and are not controlled by Companeon. You are responsible for maintaining sufficient native tokens to cover gas costs.

### 7.3 Smart Contract Risk

The Service interacts with smart contracts, including the DelegationManager, on-chain enforcers, and third-party DeFi protocols (e.g., Uniswap). Smart contracts may contain bugs, vulnerabilities, or be subject to exploits. Companeon does not guarantee the security or correctness of any smart contract.

### 7.4 Market Risk

Cryptocurrency prices are highly volatile. Token swaps, transfers, and DeFi operations may result in financial loss due to price movements, slippage, impermanent loss, or liquidity conditions. Companeon does not guarantee any particular financial outcome.

### 7.5 Network Risk

Blockchain networks may experience congestion, outages, forks, or other disruptions that affect transaction execution, timing, or finality. Companeon is not responsible for network-level failures.

### 7.6 Regulatory Risk

The regulatory landscape for cryptocurrency and DeFi is evolving. Changes in law or regulation may affect your ability to use the Service or the value of your digital assets.

## 8. Tax Obligations

You are solely responsible for determining and fulfilling any tax obligations arising from your use of the Service, including but not limited to capital gains taxes, income taxes, and any other taxes related to cryptocurrency transactions. Companeon does not provide tax advice and does not report transactions to tax authorities on your behalf. You should consult a qualified tax professional regarding your specific tax obligations.

## 9. Third-Party Services

The Service integrates with and relies upon third-party services, including but not limited to:

- **Wallet Providers:** MetaMask, Coinbase Wallet, WalletConnect, Web3Auth
- **DeFi Protocols:** Uniswap and other decentralized exchanges
- **Blockchain Infrastructure:** RPC providers, Envio HyperSync, blockchain networks
- **Data Providers:** CoinGecko, Basescan, and other price/data APIs
- **Cloud Infrastructure:** Google Cloud Platform

Companeon is not responsible for the availability, accuracy, security, or performance of third-party services. Your use of third-party services is subject to their respective terms and conditions.

## 10. Prohibited Uses

You agree not to use the Service to:

- Violate any applicable law, regulation, or sanction
- Engage in money laundering, terrorist financing, or other financial crimes
- Manipulate markets, including wash trading, front-running, or spoofing
- Circumvent or attempt to circumvent permission limits, security measures, or access controls
- Interfere with, disrupt, or overload the Service infrastructure
- Use automated systems (bots, scripts) to abuse the Service beyond normal usage
- Attempt to gain unauthorized access to other users' wallets, data, or accounts
- Use the Service in connection with any securities offering or token sale in violation of applicable law
- Engage in any activity that could harm other users or the integrity of the Service

## 11. Intellectual Property

All content, software, code, designs, and trademarks associated with the Service are owned by or licensed to Companeon. You are granted a limited, non-exclusive, non-transferable license to use the Service for its intended purpose.

You may not copy, modify, distribute, reverse engineer, or create derivative works of the Service without prior written consent.

## 12. Disclaimers

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. TO THE MAXIMUM EXTENT PERMITTED BY LAW, COMPANEON DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO:

- MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT
- ACCURACY, RELIABILITY, OR COMPLETENESS OF AI-GENERATED OUTPUTS
- UNINTERRUPTED, SECURE, OR ERROR-FREE OPERATION OF THE SERVICE
- THE VALUE, SECURITY, OR LEGALITY OF ANY DIGITAL ASSET OR TRANSACTION

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, COMPANEON AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR:

- ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
- LOSS OF PROFITS, REVENUE, DATA, OR DIGITAL ASSETS
- DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE
- DAMAGES ARISING FROM UNAUTHORIZED ACCESS TO YOUR WALLET OR ACCOUNT
- DAMAGES ARISING FROM THE ACTIONS OF THE AI AGENT OR AUTONOMOUS AGENTS
- DAMAGES ARISING FROM THIRD-PARTY SERVICE FAILURES OR BLOCKCHAIN NETWORK ISSUES

IN NO EVENT SHALL COMPANEON'S TOTAL LIABILITY EXCEED THE AMOUNT YOU HAVE PAID TO COMPANEON IN CREDIT PURCHASES DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

## 14. Indemnification

You agree to indemnify, defend, and hold harmless Companeon and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising from:

- Your use of the Service
- Your violation of these Terms
- Your violation of any applicable law or regulation
- The transactions executed through your granted permissions
- Any activity conducted through your connected wallet

## 15. Termination

### 15.1 By You

You may stop using the Service at any time by disconnecting your wallet and revoking your ERC-7715 permissions. Unused credits will remain associated with your wallet address but Companeon has no obligation to maintain the Service indefinitely.

### 15.2 By Companeon

Companeon reserves the right to suspend or terminate your access to the Service at any time, with or without notice, for any reason, including but not limited to violation of these Terms or suspected fraudulent activity.

### 15.3 Effect of Termination

Upon termination, your right to use the Service ceases immediately. Any permissions you have granted on-chain will remain active until you revoke them directly. Companeon is not responsible for revoking your on-chain permissions upon termination.

## 16. Dispute Resolution

### 16.1 Governing Law

These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of laws provisions.

### 16.2 Arbitration

Any dispute arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall be conducted in English.

### 16.3 Class Action Waiver

You agree that any disputes will be resolved on an individual basis and that you waive your right to participate in a class action, collective action, or representative proceeding.

## 17. Force Majeure

Companeon shall not be liable for any failure or delay in performing its obligations under these Terms due to circumstances beyond its reasonable control, including but not limited to: natural disasters, acts of war or terrorism, pandemics, government actions or regulations, blockchain network failures or forks, internet or infrastructure outages, cyberattacks, or changes in applicable law or regulation.

## 18. Modifications

Companeon reserves the right to modify these Terms at any time. Material changes will be communicated through the Service or by updating the "Last Updated" date. Your continued use of the Service after changes are posted constitutes acceptance of the modified Terms.

## 19. No Waiver

The failure of Companeon to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision. Any waiver of any provision of these Terms will be effective only if in writing and signed by Companeon.

## 20. Severability

If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.

## 21. Entire Agreement

These Terms, together with the Privacy Policy, constitute the entire agreement between you and Companeon regarding the Service and supersede any prior agreements.

## 22. Contact

If you have questions about these Terms, you can reach us at:

- **Website:** [companeon.io](https://companeon.io)
- **GitHub:** [github.com/richardjaee/companeon-ai](https://github.com/richardjaee/companeon-ai)
