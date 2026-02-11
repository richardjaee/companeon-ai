'use client';

import { useState } from 'react';
import Container from '../Layout/Container';
import Script from 'next/script';

const FAQSection = () => {
  const questions = [
    {
      title: "What is Companeon?",
      content: "Companeon is a wallet-native AI agent that converts conversational prompts into on-chain transactions. Instead of navigating multiple DeFi apps, you simply tell the agent what you want to do in plain English, like \"swap 50 USDC to ETH\" or \"send 0.5 ETH to vitalik.eth\", and it handles the execution directly from your wallet.\n\nThe agent uses ERC-7715 Advanced Permissions to operate within scoped spending limits you define. Your assets never leave your wallet, and the agent cannot exceed the boundaries you set."
    },
    {
      title: "How do ERC-7715 permissions work?",
      content: "ERC-7715 is a permission standard that lets you grant scoped, time-bound delegation to an agent. To use it, you first upgrade your MetaMask wallet to a smart account via ERC-7702. This is a one-time on-chain transaction that enables advanced permission features.\n\nOnce upgraded, you can set specific limits for each token (e.g. 0.1 ETH per day), a time frequency (hourly, daily, or weekly), and an expiration date. The entire system is powered by MetaMask's Delegation Manager contract. These limits are enforced on-chain by smart contract enforcers built into the delegation framework. When the agent executes a transaction, the enforcer contract validates that the amount is within your limit and the permission hasn't expired. If the agent tries to exceed your limits, the transaction is rejected on-chain. This means even if the backend were compromised, your assets remain protected by the Delegation Manager contract."
    },
    {
      title: "Does Companeon have custody of my assets?",
      content: "No. Companeon never takes custody of your assets and does not deploy its own smart contracts. Your tokens stay in your wallet at all times. Every transaction is executed directly through your wallet using MetaMask's Delegation Manager contract, meaning the agent can act on your behalf only within the spending limits you define. You can revoke permissions at any time, and all limits are enforced on-chain by the delegation framework, not by our servers."
    },
    {
      title: "What can the AI agent do?",
      content: "The agent can execute token swaps via Uniswap, transfer ETH and ERC-20 tokens to any address or ENS name, check your portfolio balances and real-time prices, analyze your on-chain transaction history, estimate gas costs across speed tiers, set up recurring automated transfers, check address security via GoPlus, and browse the web for market research.\n\nAll transaction-executing actions require either your confirmation (ask mode) or pre-authorized auto mode. Read-only operations like checking balances and getting quotes are always free."
    },
    {
      title: "What does Companeon support?",
      content: "Companeon works with MetaMask, which natively supports the ERC-7715 permission standard. Transactions can be executed on Ethereum Mainnet, with Sepolia testnet available for testing."
    },
    {
      title: "How much does it cost?",
      content: "Companeon does not charge any platform fees for swaps, transfers, or portfolio management. You only pay standard network gas fees for the transactions the agent executes on your behalf.\n\nThe only cost beyond gas is LLM credits, which cover the AI reasoning behind each conversation. Credits are affordable and transparent, so you always know what you're paying for."
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
