/**
 * Detect if MetaMask Flask is installed and being used
 */

export async function isMetaMaskFlask(ethereum: any): Promise<boolean> {
  if (!ethereum) return false;

  try {
    if (!ethereum.isMetaMask) return false;

    // Newer Flask builds expose an explicit flag
    if (ethereum.isMetaMaskFlask) {
      console.log('[detectFlask] ✅ Flask detected via isMetaMaskFlask flag');
      return true;
    }

    const version = ethereum.version;
    if (version && typeof version === 'string') {
      const lowered = version.toLowerCase();
      if (lowered.includes('flask')) {
        console.log('[detectFlask] ✅ Flask detected in version string:', version);
        return true;
      }

      // Some builds omit "flask" but follow semver >= 13.5.0 for Flask-only features
      const majorMinor = parseFloat(version);
      if (!Number.isNaN(majorMinor) && majorMinor >= 13.5) {
        console.log('[detectFlask] ✅ Flask detected via version >= 13.5:', version);
        return true;
      }
    }

    // Try capabilities check ONLY if we have authorized accounts
    // (Don't fail if page isn't authorized yet - rely on other detection methods)
    try {
      const hasPermissions = await supportsAdvancedPermissions(ethereum);
      if (hasPermissions) {
        console.log('[detectFlask] ✅ Flask detected via wallet_getCapabilities');
        return true;
      }
    } catch (e) {
      // Capabilities check failed - that's OK, we have other detection methods
      console.log('[detectFlask] wallet_getCapabilities check skipped (not an error)');
    }

    console.log('[detectFlask] ❌ Flask not detected');
    return false;
  } catch (error) {
    console.error('[detectFlask] Error detecting Flask:', error);
    return false;
  }
}

/**
 * Check if Advanced Permissions (ERC-7715) are supported
 */
export async function supportsAdvancedPermissions(ethereum: any): Promise<boolean> {
  if (!ethereum) return false;

  try {
    // Get current account first - MUST have a connected account
    const accounts = await ethereum.request({ method: 'eth_accounts' });

    // If no accounts connected, can't check capabilities
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0 || !accounts[0]) {
      console.log('[detectFlask] No connected accounts, cannot check capabilities');
      return false;
    }

    // Try to check capabilities with the connected account
    const capabilities = await ethereum.request({
      method: 'wallet_getCapabilities',
      params: [accounts[0]], // Always pass the account as string
    });

    // Check if any chain supports permissions
    if (capabilities) {
      for (const chainId in capabilities) {
        if (capabilities[chainId]?.permissions?.supported) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    // Capability probe not supported; just treat as not available
    console.log('[detectFlask] wallet_getCapabilities error:', error);
    return false;
  }
}

/**
 * Get user-friendly message about Flask requirement
 */
export function getFlaskRequirementMessage(): string {
  return `MetaMask Advanced Permissions (ERC-7715) requires MetaMask Flask v13.5.0+.

🔧 How to install Flask:
1. Visit https://metamask.io/flask/
2. Download and install Flask (can run alongside regular MetaMask)
3. Refresh this page and try again

💡 Tip: Flask is MetaMask's experimental version for testing new features like Advanced Permissions.`;
}
