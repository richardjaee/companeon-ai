/**
 * Centralized storage keys for the application
 * This prevents duplication and typos when referencing localStorage/sessionStorage
 */

export const STORAGE_KEYS = {
  WALLET: {
    CHOICE: 'walletChoice',
    IS_CONNECTED: 'wallet_is_connected',
    ADDRESS: 'wallet_current_address',

  },
  AUTH: {
    TOKEN: 'auth_token',
    EXPIRY: 'auth_expiry',
    SESSION_IN_PROGRESS: 'auth_in_progress',
    DECLINED: 'auth_declined',
    CURRENT_WALLET: 'auth_current_wallet'
  },
  NAVIGATION: {
    LAST_PATH: 'last_known_path',
    REDIRECT_PENDING: 'redirect_pending'
  },
  LEGACY: {

    PREVENT_AUTO_CONNECT: 'companeon_prevent_auto_connect',
    USER_DISCONNECTED: 'companeon_user_disconnected',
    CURRENT_AUTH_ADDRESS: 'current_auth_address',
    AUTH_CONNECTING_WALLET: 'auth_connecting_wallet',
    AUTH_SIGNING_IN_PROGRESS: 'auth_signing_in_progress'
  }
};

/**
 * Helper functions for storage operations
 */

/**
 * Set a value in both localStorage and sessionStorage for resilience
 */
export function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch (e) {
  }
}

/**
 * Get a value from localStorage, falling back to sessionStorage
 */
export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

/**
 * Remove a value from both localStorage and sessionStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch (e) {
  }
}

/**
 * Clear all wallet-related storage items
 */
export function clearWalletStorage(): void {
  try {

    Object.values(STORAGE_KEYS.WALLET).forEach(removeStorageItem);
    
    Object.values(STORAGE_KEYS.LEGACY).forEach(removeStorageItem);
    
    removeStorageItem('current_wallet_type');
    removeStorageItem('last_reconnect_attempt');
  } catch (e) {
  }
} 
