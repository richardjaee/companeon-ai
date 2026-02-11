'use client';

import { useState } from 'react';
import Container from '../Layout/Container';
import Script from 'next/script';

const FAQSection = () => {
  const questions = [
    {
      title: "What is Companeon?",
      content: "Companeon is a wallet-native AI agent that converts conversational prompts into on-chain transactions. Instead of navigating multiple DeFi apps, you simply tell the agent what you want to do in plain English, like \"swap 50 USDC to ETH\" or \"send 0.5 ETH to vitalik.eth\", and the agent intelligently uses its tools to find the best swap route across Uniswap liquidity pools, estimate gas costs, resolve ENS names, run recipient security checks, and preview the full transaction before you confirm.\n\nThe agent uses ERC-7715 Advanced Permissions to operate within scoped spending limits you define. Your assets never leave your wallet, and the agent cannot exceed the boundaries you set."
    },
    {
      title: "How do ERC-7715 permissions work?",
      content: "ERC-7715 is a permission standard that lets you grant scoped, time-bound delegation to an agent. To use it, you first upgrade your MetaMask wallet to a smart account via ERC-7702. This is a one-time on-chain transaction that enables advanced permission features.\n\nOnce upgraded, you can set specific limits for each token (e.g. 0.1 ETH per day), a time frequency (hourly, daily, or weekly), and an expiration date. The entire system is powered by MetaMask's Delegation Manager contract which enforces spending permissions on-chain at no extra cost. If the agent tries to exceed your spending limits, the transaction is rejected on-chain. Everything is executed and enforced directly within your wallet, so there's no external custody, private key exposure, or unlimited approval risk."
    },
    {
      title: "Does Companeon have custody of my assets?",
      content: "No. Companeon never takes custody of your assets and does not deploy its own smart contracts. Your tokens stay in your wallet at all times. Every transaction is executed directly through your wallet using MetaMask's Delegation Manager contract, meaning the agent can act on your behalf only within the spending limits you define. You can revoke permissions at any time, and all limits are enforced on-chain by the delegation framework, not by our servers."
    },
    {
      title: "What can the AI agent do?",
      content: "The agent can execute token swaps, check gas prices, analyze on-chain history, copy trade, transfer tokens, set up recurring automated operations, and stake. Every agent has access to a full set of tools including integrations to powerful APIs like Alchemy, CoinMarketCap, 0x, GoPlus Security, web browsing, and more, all included at no extra cost."
    },
    {
      title: "What chains and wallets does Companeon support?",
      content: "Companeon works with MetaMask, which natively supports the ERC-7715 permission standard. Transactions can be executed on Ethereum Mainnet, with Sepolia testnet available for testing. We are working to add more chain support, and will add additional wallet providers once ERC-7715 is more widely supported."
    },
    {
      title: "How much does it cost?",
      content: "Companeon does not charge any additional fees for any transaction executed through our agent and we also sponsor all gas fees for agent transactions.  We only charge for LLM credits, which cover the AI reasoning behind each conversation. Credits come in at 4.99 USDC for 200 credits and can be purchased directly with your wallet. No credit card, subscriptions, or emails required."
    }
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": questions.map((q) => ({
      "@type": "Question",
      "name": q.title,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": q.content.replace(/\n\n/g, ' ')
      }
    }))
  };

  return (
    <div className="bg-[#f2f2f2] pt-24 pb-[80px]">
      <Script id="faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>

      <Container>
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/4 mb-8 md:mb-0">
            <h2 className="text-[32px] lg:text-[42px] font-medium text-black leading-tight font-[family-name:var(--font-space-grotesk)]">
              FAQs
            </h2>
          </div>

          <div className="w-full md:w-3/4">
            <div className="mb-0">
              {questions.map((question, index) => (
                <div key={index} className={`${index === questions.length - 1 ? 'mb-0' : 'mb-5'}`}>
                  <div
                    className="font-medium text-[20px] flex items-center cursor-pointer py-[15px] text-black"
                    onClick={() => toggleQuestion(index)}
                  >
                    <span>{question.title}</span>
                    <span className={`ml-auto transition-transform duration-300 text-base
                      ${openIndex === index ? 'rotate-[-90deg]' : 'rotate-90'}`}
                    >
                      &#x276F;
                    </span>
                  </div>

                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    openIndex === index ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="mt-[10px] mb-[15px] pb-[15px]">
                      <p className="font-normal text-[16px] text-gray-600 whitespace-pre-line">
                        {question.content}
                      </p>
                    </div>
                  </div>
                  {index !== questions.length - 1 && (
                    <hr className="border-none h-[1px] bg-gray-300 opacity-80 mb-[20px] mt-[20px]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default FAQSection;
