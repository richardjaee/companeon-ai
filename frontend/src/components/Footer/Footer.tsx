'use client';

import React from 'react';
import Container from '../Layout/Container';
import Link from 'next/link';

interface FooterProps {
  isHomePage?: boolean;
}

export default function Footer({ isHomePage = false }: FooterProps) {
  return (
    <footer className={`${isHomePage ? 'bg-white' : 'bg-[#f2f2f2]'} border-t border-gray-200`}>
      <Container>
        <div className="py-12">
          <div className="flex flex-col items-center">
            <div className="flex items-center mb-10">
              <span className="text-xl font-semibold text-black font-[family-name:var(--font-space-grotesk)]">Companeon</span>
            </div>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-6">
              <button
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-gray-700 hover:text-[#AD29FF] transition-colors bg-transparent border-none cursor-pointer"
              >
                How it works
              </button>
              <button
                onClick={() => document.getElementById('faqs')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-gray-700 hover:text-[#AD29FF] transition-colors bg-transparent border-none cursor-pointer"
              >
                FAQs
              </button>
              <a
                href="https://github.com/richardjaee/companeon-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 hover:text-[#AD29FF] transition-colors"
              >
                GitHub
              </a>
              <Link href="/terms" className="text-gray-700 hover:text-[#AD29FF] transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-700 hover:text-[#AD29FF] transition-colors">
                Privacy
              </Link>
            </div>
          </div>

          <div className="border-t border-gray-300 pt-4 text-center">
            <div className="text-sm text-gray-500">
              2025 Companeon. All rights reserved.
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
