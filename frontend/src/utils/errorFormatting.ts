/**
 * Utility function to format and sanitize error messages for display in modals
 */
export const formatErrorMessage = (error: any): string => {
  if (!error) return 'An error occurred. Please try again.';
  
  const sanitizeAndTruncateError = (message: string, maxLength = 150): string => {
    if (!message) return 'An error occurred. Please try again.';
    
    let sanitized = message
      .replace(/0x[a-fA-F0-9]{40,}/g, '0x[ADDRESS]')  // Wallet addresses
      .replace(/0x[a-fA-F0-9]{64,}/g, '0x[HASH]')     // Transaction hashes and keys
      .replace(/[a-fA-F0-9]{64,}/g, '[HASH]')         // Hex strings without 0x
      .replace(/chrome-extension:\/\/[a-zA-Z0-9]+/g, '[EXTENSION]'); // Extension URLs
    
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }
    
    return sanitized;
  };
  
  if (typeof error === 'object' && error.error === 'Too many requests' && error.retryAfter) {
    return `Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`;
  }
  
  if (typeof error.message === 'string' && 
      error.message.trim().startsWith('{') && 
      error.message.trim().endsWith('}')) {
    try {
      const parsedError = JSON.parse(error.message);
      
      if (parsedError.error === 'Too many requests' && parsedError.retryAfter) {
        return `Rate limit exceeded. Please try again in ${parsedError.retryAfter} seconds.`;
      } else if (parsedError.error) {
        return sanitizeAndTruncateError(parsedError.error);
      }
    } catch (jsonError) {
      return sanitizeAndTruncateError(error.message);
    }
  }
  
  const userRejectionPhrases = [
    'user denied', 'user rejected', 'rejected', 'denied', 
    'cancelled', 'canceled', 'signature was rejected'
  ];
  
  if (typeof error === 'string' && userRejectionPhrases.some(phrase => 
    error.toLowerCase().includes(phrase))) {
    return 'Request was declined. Please try again.';
  }
  
  if (typeof error === 'object' && error?.code === 4001) {
    return 'Request was declined. Please try again.';
  }
  
  if ((error?.code === -32603 && error?.message === 'EthAppNftNotSupported') ||
      (typeof error === 'string' && error.includes('EthAppNftNotSupported')) ||
      (error?.message && typeof error.message === 'string' && error.message.includes('EthAppNftNotSupported'))) {
    return 'Ledger hardware wallets currently don\'t support NFT approvals. Please temporarily use a software wallet (like MetaMask without Ledger) to complete this transaction, or enable "blind signing" in your Ledger Ethereum app settings.';
  }
  
  if (typeof error === 'string' && error.toLowerCase().includes('ledger')) {
    if (error.toLowerCase().includes('device locked')) {
      return 'Ledger device is locked. Please unlock your device and try again.';
    }
    if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('disconnected')) {
      return 'Ledger device not found. Please connect your device and try again.';
    }
    return 'Ledger error occurred. Please check your device and try again.';
  }
  
  if (typeof error === 'string') {
    return sanitizeAndTruncateError(error);
  }
  
  if (error?.message) {
    return sanitizeAndTruncateError(error.message);
  }
  
  return 'An error occurred. Please try again.';
};

/**
 * Error display component CSS classes for consistent styling
 */
export const errorDisplayClasses = {
  container: "mb-6 bg-red-50 border border-red-200 rounded-lg max-w-full",
  content: "px-4 py-3 flex items-start",
  icon: "h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5",
  text: "text-red-700 break-words overflow-wrap-anywhere text-sm leading-relaxed"
};