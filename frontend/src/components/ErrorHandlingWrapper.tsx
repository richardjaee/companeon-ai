'use client';

import { useEffect, ReactNode } from 'react';
import { setupGlobalErrorHandling } from '@/lib/errorHandling';

export default function ErrorHandlingWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupGlobalErrorHandling();
  }, []);

  return <>{children}</>;
} 