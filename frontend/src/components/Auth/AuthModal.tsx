'use client';

import { useEffect } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCancel?: () => void;
  refreshOnSuccess?: boolean;
  isSessionRefresh?: boolean;
}

const AuthModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onCancel,
  refreshOnSuccess = true,
  isSessionRefresh = false
}: AuthModalProps) => {
  
  useEffect(() => {
    if (isOpen) {

        onClose();
        
        if (onSuccess) {
          onSuccess();
        }
        
        if (refreshOnSuccess) {
          setTimeout(() => {
          const path = window.location.pathname;
          
            if (path === '/dashboard' || path.startsWith('/dashboard/')) {
              window.location.reload();
            }

            else if (path === '/' || path === '/session-expired') {
              window.location.href = '/dashboard';
            }

            else {
              window.location.reload();
          }
        }, 100);
      }
    }
  }, [isOpen, onClose, onSuccess, refreshOnSuccess]);

  return null;
};

export default AuthModal;
