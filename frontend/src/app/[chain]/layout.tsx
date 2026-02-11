import { notFound } from 'next/navigation';
import { isValidChain } from '@/lib/config';

interface ChainLayoutProps {
  children: React.ReactNode;
  params: {
    chain: string;
  };
}

/**
 * Layout for chain-specific routes
 * Validates chain parameter and provides ChainContext
 */
export default async function ChainLayout({ children, params }: ChainLayoutProps) {
  // Validate chain parameter
  const { chain } = await params;
  if (!isValidChain(chain)) {
    notFound();
  }

  return children;
}

/**
 * Generate static params for both chains
 */
export function generateStaticParams() {
  return [
    { chain: 'mainnet' },
    { chain: 'sepolia' },
  ];
}
