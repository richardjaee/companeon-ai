'use client';

import { useState, useEffect, useRef } from 'react';
import Container from '@/components/Layout/Container';
import {
  Shield,
  MessageSquare,
  RefreshCw,
  Zap,
  Eye
} from 'lucide-react';

interface CombinedFeaturesSectionProps {
  onPortfolioClick: () => void;
  isLoading: boolean;
  isConnected: boolean;
}

export default function CombinedFeaturesSection({
  onPortfolioClick,
  isLoading,
  isConnected
}: CombinedFeaturesSectionProps) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(new Array(6).fill(false));
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !visibleItems.some(item => item)) {
          visibleItems.forEach((_, index) => {
            setTimeout(() => {
              setVisibleItems(prev => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
            }, index * 120);
          });
        }
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [visibleItems]);

  const capabilities = [
    {
      title: "Zero custody",
      icon: <Shield className="h-7 w-7" />,
      description: "Your assets never leave your wallet. The agent executes transactions through ERC-7715 delegation, enforced on-chain by smart contract enforcers."
    },
    {
      title: "Conversational execution",
      icon: <MessageSquare className="h-7 w-7" />,
      description: "Say what you want in plain English. The agent gets quotes, shows previews, and executes on your confirmation. No forms, no routing, no slippage settings."
    },
    {
      title: "Scoped permissions",
      icon: <Zap className="h-7 w-7" />,
      description: "Set per-token spending limits that auto-reset hourly, daily, or weekly. The agent cannot exceed your limits even if the backend is compromised."
    },
    {
      title: "Recurring automation",
      icon: <RefreshCw className="h-7 w-7" />,
      description: "Set up daily transfers, scheduled swaps, and automated DeFi operations. Sub-delegation lets specialized agents run tasks within your parent permissions."
    },
    {
      title: "Transparent reasoning",
      icon: <Eye className="h-7 w-7" />,
      description: "See the agent's thinking in real-time. Every tool call, every quote, every decision is visible in the chat before execution."
    }
  ];

  return (
    <div ref={sectionRef} className="bg-white pt-24 pb-[80px]">
      <div className="px-6 lg:px-20 w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className={`py-6 lg:py-6 xl:py-8 lg:pr-8 flex flex-col justify-start bg-white transition-all duration-1000 ease-out ${
              visibleItems[0] ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <h2 className="text-[32px] lg:text-[42px] font-medium mb-4 leading-tight lg:mt-4 xl:mt-6 font-[family-name:var(--font-space-grotesk)]">Built for trust, not custody</h2>
            <p className="text-gray-600 text-base mb-6 leading-relaxed pr-2">
              Every design decision puts you in control. The agent works for you, within the boundaries you set.
            </p>
          </div>

          {capabilities.map((capability, index) => (
            <div
              key={index}
              className={`transition-all duration-1000 ease-out ${
                visibleItems[index + 1] ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="bg-white border border-gray-200 rounded-lg p-8 h-full flex flex-col min-h-[280px]">
                <div className="bg-gray-100 w-14 h-14 rounded-full flex items-center justify-center text-[#AD29FF] mb-8">
                  {capability.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{capability.title}</h3>
                <p className="text-gray-600 text-base leading-relaxed flex-grow">{capability.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
