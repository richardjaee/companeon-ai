'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

interface CDPAuthProps {
  onSuccess: (address: string) => void;
  onError: (error: string) => void;
}

type AuthMethod = 'email' | 'sms' | 'google';

function CDPAuthContent({ onSuccess, onError }: CDPAuthProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('google');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowType, setFlowType] = useState<'email' | 'sms' | null>(null);
  const [otp, setOtp] = useState('');

  // Check if user is already authenticated (after OAuth redirect)
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        console.log('[CDP] Checking for existing auth session after redirect...');
        const { getCurrentUser } = await import('@coinbase/cdp-core');
        const user = await getCurrentUser();

        console.log('[CDP] getCurrentUser result:', user);

        if (user?.evmAccounts?.[0]) {
          console.log('[CDP] Found existing authenticated user, completing sign-in with address:', user.evmAccounts[0]);
          onSuccess(user.evmAccounts[0]);
        } else if (user) {
          console.log('[CDP] User authenticated but no wallet address found, user:', user);
        } else {
          console.log('[CDP] No authenticated user found');
        }
      } catch (error) {
        console.log('[CDP] Error checking auth session:', error);
      }
    };

    // Check immediately on mount
    checkExistingAuth();

    // Also check when page regains focus (after OAuth redirect)
    const handleFocus = () => {
      console.log('[CDP] Page regained focus, re-checking auth...');
      checkExistingAuth();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [onSuccess]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      console.log('[CDP] Attempting email sign-in for:', email);
      const { signInWithEmail } = await import('@coinbase/cdp-core');
      const result = await signInWithEmail({ email });
      console.log('[CDP] Email sign-in successful, flowId:', result.flowId);
      setFlowId(result.flowId);
      setFlowType('email');
    } catch (error: any) {
      console.error('[CDP] Email sign-in error:', error);
      Sentry.captureException(error);
      onError(error?.message || 'Failed to send verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSMSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setIsSubmitting(true);
    try {
      const { signInWithSms } = await import('@coinbase/cdp-core');
      const result = await signInWithSms({ phoneNumber });
      setFlowId(result.flowId);
      setFlowType('sms');
    } catch (error: any) {
      Sentry.captureException(error);
      onError(error?.message || 'Failed to send SMS code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      console.log('[CDP] Attempting Google OAuth sign-in');
      const { signInWithOAuth, getCurrentUser } = await import('@coinbase/cdp-core');

      await signInWithOAuth('google');
      console.log('[CDP] Google OAuth redirect initiated');
      const user = await getCurrentUser();

      if (user?.evmAccounts?.[0]) {
        console.log('[CDP] Google sign-in successful, address:', user.evmAccounts[0]);
        onSuccess(user.evmAccounts[0]);
      } else {
        throw new Error('No wallet address found');
      }
    } catch (error: any) {
      console.error('[CDP] Google OAuth error:', error);
      Sentry.captureException(error);
      onError(error?.message || 'Google sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowId || !otp || !flowType) return;

    setIsSubmitting(true);
    try {
      const { verifyEmailOTP, verifySmsOTP, getCurrentUser } = await import('@coinbase/cdp-core');

      if (flowType === 'email') {
        await verifyEmailOTP({ flowId, otp });
      } else if (flowType === 'sms') {
        await verifySmsOTP({ flowId, otp });
      }

      const user = await getCurrentUser();

      if (user?.evmAccounts?.[0]) {
        onSuccess(user.evmAccounts[0]);
      } else {
        throw new Error('No wallet address found');
      }
    } catch (error: any) {
      Sentry.captureException(error);
      onError(error?.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP verification screen
  if (flowId && flowType) {
    return (
      <div className="flex flex-col items-center justify-center p-6">
        <h3 className="text-lg font-semibold mb-4">Enter verification code</h3>
        <p className="text-sm text-gray-600 mb-4">
          {flowType === 'email' ? 'Check your email for the code' : 'Check your phone for the SMS code'}
        </p>
        <form onSubmit={handleOtpSubmit} className="w-full max-w-sm">
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 text-center text-lg tracking-widest"
            maxLength={6}
            autoFocus
          />
          <button
            type="submit"
            disabled={isSubmitting || otp.length !== 6}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Verifying...' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFlowId(null);
              setFlowType(null);
              setOtp('');
            }}
            className="w-full mt-2 text-sm text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
        </form>
      </div>
    );
  }

  // Main auth method selection screen
  return (
    <div className="flex flex-col items-center justify-center p-6">
      <h3 className="text-lg font-semibold mb-6">Choose sign-in method</h3>

      {/* Method tabs */}
      <div className="flex gap-2 mb-6 w-full max-w-sm">
        <button
          type="button"
          onClick={() => setAuthMethod('google')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            authMethod === 'google'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => setAuthMethod('email')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            authMethod === 'email'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setAuthMethod('sms')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            authMethod === 'sms'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          SMS
        </button>
      </div>

      {/* Google OAuth */}
      {authMethod === 'google' && (
        <div className="w-full max-w-sm">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              'Signing in...'
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Sign in with your Google account to create a secure wallet
          </p>
        </div>
      )}

      {/* Email form */}
      {authMethod === 'email' && (
        <form onSubmit={handleEmailSubmit} className="w-full max-w-sm">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending code...' : 'Continue'}
          </button>
          <p className="text-xs text-gray-500 mt-3 text-center">
            We'll send you a 6-digit verification code
          </p>
        </form>
      )}

      {/* SMS form */}
      {authMethod === 'sms' && (
        <form onSubmit={handleSMSSubmit} className="w-full max-w-sm">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting || !phoneNumber}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending code...' : 'Continue'}
          </button>
          <p className="text-xs text-gray-500 mt-3 text-center">
            We'll send you a 6-digit SMS verification code
          </p>
        </form>
      )}
    </div>
  );
}

export default function CDPAuth({ onSuccess, onError }: CDPAuthProps) {
  const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initCDP = async () => {
      try {
        const { initialize } = await import('@coinbase/cdp-core');

        if (!projectId) {
          throw new Error('CDP Project ID not configured');
        }

        // Clear any stale CDP sessions from IndexedDB to prevent 401 errors
        try {
          console.log('[CDP] Clearing stale CDP storage...');
          const databases = await window.indexedDB.databases();
          for (const db of databases) {
            if (db.name && (db.name.includes('cdp') || db.name.includes('coinbase'))) {
              console.log('[CDP] Deleting database:', db.name);
              window.indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (storageError) {
          console.log('[CDP] Could not clear storage:', storageError);
        }

        await initialize({
          projectId,
          ethereum: {
            createOnLogin: 'eoa',
          },
        });

        setIsInitialized(true);
      } catch (error: any) {
        console.error('[CDP] Initialization error:', error);
        // Still allow auth to proceed even if init has errors
        setIsInitialized(true);
      }
    };

    initCDP();
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-4 text-red-600">
        CDP configuration error. Please contact support.
      </div>
    );
  }

  if (!isInitialized) {
    return <div className="text-center p-4">Loading...</div>;
  }

  return <CDPAuthContent onSuccess={onSuccess} onError={onError} />;
}
