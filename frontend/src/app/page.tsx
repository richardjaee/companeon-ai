'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import Footer from '@/components/Footer/Footer';

import FAQSection from '@/components/FAQSection/FAQSection';
import TweetSection from '@/components/TweetSection/TweetSection';
import Container from '@/components/Layout/Container';
import WalletConnectModal from '@/components/WalletConnectModal/WalletConnectModal';
import AuthModal from '@/components/Auth/AuthModal';

import CombinedFeaturesSection from '@/components/CombinedFeatures/CombinedFeaturesSection';
import dynamic from 'next/dynamic';

const RemotionPlayer = dynamic(() => import('@/components/Remotion/RemotionPlayer'), { ssr: false });

import Script from 'next/script';
import * as Sentry from '@sentry/nextjs';

export default function HomePage() {
  const router = useRouter();
  const { connectWallet, isConnected, address } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const isAuth = isConnected && !!address;
    setIsAuthenticated(isAuth);
  }, [address, isConnected]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWalletReset = () => {
      setIsAuthenticated(false);
      setIsLoading(false);
      setShowConnectModal(false);
      setShowAuthModal(false);
    };

    window.addEventListener('wallet:reset', handleWalletReset);
    return () => window.removeEventListener('wallet:reset', handleWalletReset);
  }, []);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Companeon",
    "applicationCategory": "FinanceApplication",
    "description": "Companeon is a wallet-native AI agent that converts conversational prompts into on-chain transactions using ERC-7715 permissions. Trade, swap, and transfer crypto by chatting.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "operatingSystem": "Web-based",
    "author": {
      "@type": "Organization",
      "name": "Companeon",
      "url": "https://companeon.ai"
    },
    "url": "https://companeon.ai"
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Companeon",
    "url": "https://companeon.ai",
    "description": "Wallet-native AI agent for on-chain transactions. Convert conversational prompts into swaps, transfers, and DeFi operations without custody."
  };

  const handleConnectWallet = async (walletType: string) => {
    if (isConnected) {
      router.push('/mainnet/dashboard');
      return;
    }

    try {
      setIsLoading(true);
      const result = await connectWallet(walletType as 'metamask');

      if (result && typeof result === 'string') {
        setShowConnectModal(false);
        router.push('/mainnet/dashboard');
      }
    } catch (error) {
      Sentry.captureException(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);

    if (window.location.pathname === '/') {
      router.push('/mainnet/dashboard');
    } else {
      window.location.reload();
    }
  };

  const handleGetStarted = () => {
    if (!isConnected || !address) {
      setShowConnectModal(true);
      return;
    }
    router.push('/mainnet/dashboard');
  };

  const getButtonText = () => {
    if (isLoading) return 'Connecting...';
    if (isConnected && address) return 'Launch app';
    return 'Get started';
  };

  return (
    <div className="min-h-screen">
      <Script id="homepage-jsonld" type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </Script>
      <Script id="organization-jsonld" type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </Script>

      {/* Hero Section */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#1A1A1A' }}>
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/animations/hero-01-Animation-poster.jpg"
          className="absolute top-0 left-0 w-full h-full object-cover z-10"
          style={{ backgroundColor: '#1A1A1A' }}
          onLoadedData={(e) => {
            const video = e.target as HTMLVideoElement;
            video.play().catch(console.error);
          }}
          onCanPlay={(e) => {
            const video = e.target as HTMLVideoElement;
            video.play().catch(console.error);
          }}
          onEnded={(e) => {
            const video = e.target as HTMLVideoElement;
            video.currentTime = 0;
            video.play().catch(console.error);
          }}
        >
          <source src="/animations/hero-01-Animation.mp4" type="video/mp4" />
        </video>

        {/* Overlay */}
        <div className="absolute top-0 left-0 w-full h-full bg-black/40 z-20" />

        {/* Hero Content */}
        <div className="relative z-30 py-32">
          <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-8 lg:gap-12 px-6 lg:px-20 w-full max-w-7xl mx-auto">
            {/* Left side - Text */}
            <div className="w-full lg:w-[57.5%] text-center lg:text-left">
              <div className="leading-none">
                <h1 className="text-white text-[36px] sm:text-[60px] mb-1 sm:mb-2 font-medium font-[family-name:var(--font-space-grotesk)]">Your AI agent for</h1>
                <h1 className="text-white text-[36px] sm:text-[60px] font-medium font-[family-name:var(--font-space-grotesk)]">on-chain transactions</h1>
              </div>

              <p className="text-gray-300 mt-4 sm:mt-4 mb-10 sm:mb-10 text-sm sm:text-2xl leading-relaxed mx-auto lg:mx-0" style={{ maxWidth: "500px" }}>
                Trade, swap, and transfer crypto by chatting. Grant scoped permissions to an AI that executes directly from your wallet.
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-2 sm:mb-2">
                <button
                  onClick={handleGetStarted}
                  disabled={isLoading}
                  className="bg-[#AD29FF] hover:bg-[#9523DC] text-white text-[16px] rounded-full shadow-lg hover:shadow-xl transition-all disabled:opacity-50 z-30 relative h-12 flex items-center justify-center"
                  style={{ paddingLeft: '24px', paddingRight: '24px' }}
                >
                  <span className="font-medium">
                    {getButtonText()}
                  </span>
                </button>

                <button
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-transparent border-2 border-white text-white text-[16px] rounded-full hover:bg-white hover:text-gray-900 transition-all z-30 relative inline-flex items-center justify-center h-12"
                  style={{ paddingLeft: '24px', paddingRight: '24px' }}
                >
                  <span className="font-medium">
                    How it works
                  </span>
                </button>
              </div>

              {/* Social proof - Desktop */}
              <div className="hidden lg:flex items-center gap-3 mt-16">
                <svg width="32" height="32" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32.96 1L19.62 10.93l2.47-5.85L32.96 1z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.04 1l13.22 10.03-2.35-5.95L2.04 1zM28.15 23.53l-3.55 5.44 7.6 2.09 2.18-7.4-6.23-.13zM.64 23.66l2.17 7.4 7.59-2.09-3.54-5.44-6.22.13z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.07 14.51l-2.12 3.2 7.55.34-.25-8.13-5.18 4.59zM24.93 14.51l-5.24-4.69-.17 8.23 7.54-.34-2.13-3.2zM10.4 28.97l4.54-2.2-3.92-3.06-.62 5.26zM20.06 26.77l4.53 2.2-.61-5.26-3.92 3.06z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24.59 28.97l-4.53-2.2.36 2.96-.04 1.25 4.21-1.99zM10.4 28.97l4.22 2.01-.03-1.25.35-2.96-4.54 2.2z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14.7 21.93l-3.78-1.11 2.67-1.22 1.11 2.33zM20.3 21.93l1.11-2.33 2.68 1.22-3.79 1.11z" fill="#233447" stroke="#233447" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.4 28.97l.65-5.44-4.19.13 3.54 5.31zM23.95 23.53l.64 5.44 3.55-5.31-4.19-.13zM27.06 17.71l-7.54.34.7 3.88 1.11-2.33 2.68 1.22 3.05-3.11zM10.92 20.82l2.67-1.22 1.11 2.33.7-3.88-7.55-.34 3.07 3.11z" fill="#CC6228" stroke="#CC6228" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7.95 17.71l3.17 6.18-.11-3.07-3.06-3.11zM24.01 20.82l-.12 3.07 3.17-6.18-3.05 3.11zM15.5 18.05l-.7 3.88.88 4.54.2-5.98-.38-2.44zM19.52 18.05l-.37 2.43.18 5.99.88-4.54-.69-3.88z" fill="#E27525" stroke="#E27525" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.22 21.93l-.88 4.54.63.44 3.92-3.06.12-3.07-3.79 1.15zM10.92 20.82l.11 3.07 3.92 3.06.63-.44-.88-4.54-3.78-1.15z" fill="#F5841F" stroke="#F5841F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.26 30.98l.04-1.25-.34-.3h-4.92l-.33.3.03 1.25-4.34-2.01 1.52 1.24 3.07 2.13h5.01l3.08-2.13 1.51-1.24-4.33 2.01z" fill="#C0AC9D" stroke="#C0AC9D" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.06 26.77l-.63-.44h-3.86l-.63.44-.35 2.96.33-.3h4.92l.34.3-.12-2.96z" fill="#161616" stroke="#161616" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M33.52 11.35l1.13-5.45L32.96 1l-12.9 9.57 4.97 4.2 7.02 2.05 1.55-1.81-.67-.49 1.07-.97-.82-.64 1.07-.81-.71-.53zM.35 5.9l1.14 5.45-.73.53 1.07.81-.82.64 1.07.97-.68.49 1.55 1.81 7.02-2.05 4.97-4.2L2.04 1 .35 5.9z" fill="#763E1A" stroke="#763E1A" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M32.05 16.82l-7.02-2.05 2.13 3.2-3.17 6.18 4.16-.05h6.22l-2.32-7.28zM10.07 14.77l-7.02 2.05-2.32 7.28h6.22l4.16.05-3.17-6.18 2.13-3.2zM19.52 18.05l.45-7.78 2.05-5.19H12.91l2.04 5.19.45 7.78.17 2.44.01 5.98h3.86l.01-5.98.08-2.44z" fill="#F5841F" stroke="#F5841F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-normal text-gray-300">MetaMask Hackathon Winner</span>
              </div>
            </div>

            {/* Right side - MacBook Mock */}
            <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
              <div className="w-full max-w-[680px]">
                <div className="relative">
                  {/* MacBook Screen */}
                  <div className="relative rounded-t-lg overflow-hidden" style={{
                    background: 'linear-gradient(145deg, #374151, #1f2937)',
                    padding: '6px 6px 0 6px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                  }}>
                    <div className="relative bg-black rounded-md overflow-hidden" style={{
                      aspectRatio: '16 / 9',
                      border: '1px solid #111827'
                    }}>
                      <RemotionPlayer composition="hero-demo" />
                    </div>
                  </div>

                  {/* MacBook Base */}
                  <div className="relative">
                    <div className="h-4 rounded-b-lg" style={{
                      background: 'linear-gradient(145deg, #374151, #1f2937)',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                    }}>
                      <div className="absolute top-0.5 left-1/2 transform -translate-x-1/2 w-10 h-2.5 rounded-sm" style={{
                        background: 'linear-gradient(145deg, #4b5563, #374151)',
                        border: '0.5px solid #1f2937'
                      }}></div>
                    </div>
                    <div className="h-0.5 rounded-b-lg mx-1" style={{
                      background: 'linear-gradient(145deg, #1f2937, #111827)'
                    }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social proof - Mobile */}
          <div className="lg:hidden flex items-center justify-center gap-3 mt-16 px-6">
            <svg width="32" height="32" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32.96 1L19.62 10.93l2.47-5.85L32.96 1z" fill="#E17726" stroke="#E17726" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.04 1l13.22 10.03-2.35-5.95L2.04 1zM28.15 23.53l-3.55 5.44 7.6 2.09 2.18-7.4-6.23-.13zM.64 23.66l2.17 7.4 7.59-2.09-3.54-5.44-6.22.13z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.07 14.51l-2.12 3.2 7.55.34-.25-8.13-5.18 4.59zM24.93 14.51l-5.24-4.69-.17 8.23 7.54-.34-2.13-3.2zM10.4 28.97l4.54-2.2-3.92-3.06-.62 5.26zM20.06 26.77l4.53 2.2-.61-5.26-3.92 3.06z" fill="#E27625" stroke="#E27625" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24.59 28.97l-4.53-2.2.36 2.96-.04 1.25 4.21-1.99zM10.4 28.97l4.22 2.01-.03-1.25.35-2.96-4.54 2.2z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.7 21.93l-3.78-1.11 2.67-1.22 1.11 2.33zM20.3 21.93l1.11-2.33 2.68 1.22-3.79 1.11z" fill="#233447" stroke="#233447" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.4 28.97l.65-5.44-4.19.13 3.54 5.31zM23.95 23.53l.64 5.44 3.55-5.31-4.19-.13zM27.06 17.71l-7.54.34.7 3.88 1.11-2.33 2.68 1.22 3.05-3.11zM10.92 20.82l2.67-1.22 1.11 2.33.7-3.88-7.55-.34 3.07 3.11z" fill="#CC6228" stroke="#CC6228" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.95 17.71l3.17 6.18-.11-3.07-3.06-3.11zM24.01 20.82l-.12 3.07 3.17-6.18-3.05 3.11zM15.5 18.05l-.7 3.88.88 4.54.2-5.98-.38-2.44zM19.52 18.05l-.37 2.43.18 5.99.88-4.54-.69-3.88z" fill="#E27525" stroke="#E27525" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.22 21.93l-.88 4.54.63.44 3.92-3.06.12-3.07-3.79 1.15zM10.92 20.82l.11 3.07 3.92 3.06.63-.44-.88-4.54-3.78-1.15z" fill="#F5841F" stroke="#F5841F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.26 30.98l.04-1.25-.34-.3h-4.92l-.33.3.03 1.25-4.34-2.01 1.52 1.24 3.07 2.13h5.01l3.08-2.13 1.51-1.24-4.33 2.01z" fill="#C0AC9D" stroke="#C0AC9D" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.06 26.77l-.63-.44h-3.86l-.63.44-.35 2.96.33-.3h4.92l.34.3-.12-2.96z" fill="#161616" stroke="#161616" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M33.52 11.35l1.13-5.45L32.96 1l-12.9 9.57 4.97 4.2 7.02 2.05 1.55-1.81-.67-.49 1.07-.97-.82-.64 1.07-.81-.71-.53zM.35 5.9l1.14 5.45-.73.53 1.07.81-.82.64 1.07.97-.68.49 1.55 1.81 7.02-2.05 4.97-4.2L2.04 1 .35 5.9z" fill="#763E1A" stroke="#763E1A" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M32.05 16.82l-7.02-2.05 2.13 3.2-3.17 6.18 4.16-.05h6.22l-2.32-7.28zM10.07 14.77l-7.02 2.05-2.32 7.28h6.22l4.16.05-3.17-6.18 2.13-3.2zM19.52 18.05l.45-7.78 2.05-5.19H12.91l2.04 5.19.45 7.78.17 2.44.01 5.98h3.86l.01-5.98.08-2.44z" fill="#F5841F" stroke="#F5841F" strokeWidth="0.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-normal text-gray-300">MetaMask Hackathon Winner</span>
          </div>
        </div>
      </div>

      {/* Tweet Recognition Section */}
      <TweetSection />

      {/* Problem Statement Section */}
      <div className="bg-[#AD29FF]" style={{ paddingTop: '96px', paddingBottom: '144px' }}>
        <Container>
          <div className="text-center mb-16 max-w-5xl mx-auto">
            <h3 className="text-xl font-medium text-white mb-4 leading-tight">THE PROBLEM</h3>
            <h2 className="text-[32px] lg:text-[42px] font-medium text-white mb-4 leading-tight font-[family-name:var(--font-space-grotesk)]">
              DeFi is powerful, but the UX is broken.
            </h2>
          </div>
          <div className="w-full max-w-5xl mx-auto">
            <div className="flex flex-col gap-8">
              <div className="bg-white border border-gray-200 rounded-lg p-8 w-full text-center">
                <h3 className="text-[56px] font-medium text-black mb-2 leading-none font-[family-name:var(--font-space-grotesk)]">8+</h3>
                <p className="text-lg text-black font-semibold">
                  Steps to execute a single token swap on Uniswap.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <h3 className="text-[56px] font-medium text-black mb-2 leading-none font-[family-name:var(--font-space-grotesk)]">$3.4B</h3>
                  <p className="text-lg text-black font-semibold">
                    In ETH lost forever due to user error like wrong addresses.
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <h3 className="text-[56px] font-medium text-black mb-2 leading-none font-[family-name:var(--font-space-grotesk)]">3+</h3>
                  <p className="text-lg text-black font-semibold">
                    Apps needed to swap, verify, and track a single transaction.
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                  <h3 className="text-[56px] font-medium text-black mb-2 leading-none font-[family-name:var(--font-space-grotesk)]">0</h3>
                  <p className="text-lg text-black font-semibold">
                    Undo buttons. Every on-chain action is irreversible.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* How it Works Section */}
      <div id="how-it-works" className="pt-24 pb-24 bg-white overflow-x-hidden">
        <Container>
          <div className="text-center mb-32">
            <h3 className="text-xl font-medium text-black mb-4 leading-tight">HOW IT WORKS</h3>
            <p className="text-[32px] lg:text-[42px] max-w-5xl mx-auto font-medium text-black leading-tight font-[family-name:var(--font-space-grotesk)]">
              From prompt to transaction in seconds.
            </p>
          </div>
          <div className="flex flex-col gap-28">
            {/* Step 1 - Text left, video right */}
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-28 px-6 lg:px-20 max-w-7xl mx-auto">
              <div className="text-center lg:text-left lg:w-[432px] order-1 lg:order-1">
                <h3 className="text-2xl md:text-[40px] font-medium mb-6 leading-tight font-[family-name:var(--font-space-grotesk)]">Set your spending limits</h3>
                <ul className="space-y-2 text-base md:text-lg text-black">
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Select which tokens the agent can use from your wallet</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Set per-token spending limits that auto-reset daily or weekly</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Configure start and end dates for time-bound permissions</span>
                  </li>
                </ul>
              </div>
              <div className="flex-shrink-0 order-2 lg:order-2">
                <RemotionPlayer composition="permissions-setup" />
              </div>
            </div>

            {/* Step 2 - Video left, text right */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-28 px-6 lg:px-20 max-w-7xl mx-auto">
              <div className="text-center lg:text-left lg:w-[432px] order-1 lg:order-1">
                <h3 className="text-2xl md:text-[40px] font-medium mb-6 leading-tight font-[family-name:var(--font-space-grotesk)]">Grant ERC-7715 permissions</h3>
                <ul className="space-y-2 text-base md:text-lg text-black">
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">One-click grant via MetaMask Smart Accounts Kit</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Permissions enforced on-chain via smart contract enforcers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Revoke anytime - you stay in full control of your wallet</span>
                  </li>
                </ul>
              </div>
              <div className="flex-shrink-0 order-2 lg:order-2">
                <RemotionPlayer composition="permissions-grant" />
              </div>
            </div>

            {/* Step 3 - Text left, video right */}
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-28 px-6 lg:px-20 max-w-7xl mx-auto">
              <div className="text-center lg:text-left lg:w-[432px] order-1 lg:order-1">
                <h3 className="text-2xl md:text-[40px] font-medium mb-6 leading-tight font-[family-name:var(--font-space-grotesk)]">Chat with your AI agent</h3>
                <ul className="space-y-2 text-base md:text-lg text-black">
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Describe what you want in plain English - swaps, transfers, DeFi</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Agent finds the best route, quotes, and executes on your behalf</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-2 h-2 bg-black rounded-full mt-2 mr-3 flex-shrink-0 self-start"></span>
                    <span className="flex-1 text-left">Review and confirm every transaction before it goes on-chain</span>
                  </li>
                </ul>
              </div>
              <div className="flex-shrink-0 order-2 lg:order-2">
                <RemotionPlayer composition="agent-chat" />
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Features Section */}
      <CombinedFeaturesSection
        onPortfolioClick={handleGetStarted}
        isLoading={isLoading}
        isConnected={isConnected}
      />

      {/* FAQ Section */}
      <div id="faqs">
        <FAQSection />
      </div>

      {/* CTA Section */}
      <div className="bg-black py-[115px]">
        <Container>
          <div className="flex flex-col gap-12 items-center justify-center">
            <div className="w-full lg:w-2/3 text-center">
              <h2 className="text-4xl lg:text-[40px] font-semibold text-white mb-12 font-[family-name:var(--font-space-grotesk)]">
                Stop navigating DeFi. Start talking to it.
              </h2>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleGetStarted}
                  disabled={isLoading}
                  className="bg-[#AD29FF] hover:bg-[#9523DC] text-white text-[16px] rounded-full transition-all disabled:opacity-50 h-12 flex items-center justify-center font-medium"
                  style={{ paddingLeft: '24px', paddingRight: '24px' }}
                >
                  {isConnected && address ? 'Launch app' : 'Get started'}
                </button>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Footer */}
      <Footer isHomePage={true} />

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        refreshOnSuccess={false}
      />
      <WalletConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectWallet}
      />
    </div>
  );
}
