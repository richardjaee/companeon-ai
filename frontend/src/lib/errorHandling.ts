import * as Sentry from '@sentry/nextjs';

export function setupGlobalErrorHandling() {
  if (typeof window !== 'undefined') {

    window.addEventListener('error', (event) => {
      Sentry.captureException(event.error);
      return false;
    });

    window.addEventListener('unhandledrejection', (event) => {
      Sentry.captureException(event.reason);
    });
  }
} 
