'use client';

import React, { useState } from 'react';
import { useWallet } from '@/context/WalletContext';

interface DisconnectConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const clearLegacySessionStorage = () => {
  try {

    const legacyKeys = [

      'auth_token', 'auth_expiry', 'auth_token_alt', 'auth_expiry_alt',
      'session_expiry_modal_shown', 'companeon_session_naturally_expired',
      'auth_modal_closed', 'companeon_allow_manual_connect',
      
      'confirmedAssets', 'confirmedSections', 'unbagConfirmedAssets', 
      'sections', 'selectedPlan', 'bagSummaryData'
    ];
    
    legacyKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {

      }
    });
  } catch (e) {

  }
};

const DisconnectConfirmModal: React.FC<DisconnectConfirmModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { disconnectWallet } = useWallet();
  
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          setError('Disconnect operation timed out. Please try again.');
        }
      }, 5000);

      await disconnectWallet();

      // Set disconnect flags AFTER disconnectWallet completes
      // These must be set after because disconnectWallet clears storage
      try {
        localStorage.setItem('companeon_prevent_auto_connect', 'true');
        localStorage.setItem('companeon_user_disconnected', 'true');
        sessionStorage.setItem('companeon_prevent_auto_connect', 'true');
        sessionStorage.setItem('companeon_user_disconnected', 'true');
      } catch (err) {
        // Storage errors are non-fatal
      }

      clearLegacySessionStorage();

      if (onComplete) {
        onComplete();
      }

      onClose();

      setIsLoading(false);

    } catch (error: any) {
      setError(error.message || 'Failed to disconnect wallet. Please try again.');

      setIsLoading(false);
    } finally {

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  React.useEffect(() => {
    if (isOpen) {

      setIsLoading(false);
      setError(null);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="mb-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto text-red-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Disconnect wallet</h2>
          <p className="text-gray-600 mb-4">
            Are you sure you want to disconnect your wallet? You will need to reconnect to access your account again.
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg disabled:opacity-75 transition-colors flex justify-center items-center"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Disconnecting...
              </>
            ) : (
              'Yes, disconnect my wallet'
            )}
          </button>
          
          <button
            onClick={onClose}
            disabled={isLoading}
            className="block w-full text-center text-black mt-4 hover:underline cursor-pointer bg-transparent border-0 shadow-none font-normal p-0 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisconnectConfirmModal; 
