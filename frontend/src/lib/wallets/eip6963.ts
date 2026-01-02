/* Minimal EIP-6963 provider discovery utilities.
 * See: https://eips.ethereum.org/EIPS/eip-6963
 */

export type EIP1193Provider = any;

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns?: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

let cache: Map<string, EIP6963ProviderDetail> | null = null;

function ensureCache() {
  if (!cache) cache = new Map();
}

/**
 * Start a short-lived discovery round and return announced providers.
 * Uses a small timeout to avoid blocking UI. Safe to call multiple times.
 */
export async function requestEIP6963Providers(timeoutMs = 300): Promise<EIP6963ProviderDetail[]> {
  if (typeof window === 'undefined') return [];

  ensureCache();

  return await new Promise<EIP6963ProviderDetail[]>((resolve) => {
    const seen = new Set<string>();

    const onAnnounce = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail as EIP6963ProviderDetail;
        if (!detail || !detail.info || !detail.provider) return;
        const key = detail.info.uuid || `${detail.info.rdns ?? ''}:${detail.info.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          cache!.set(key, detail);
        }
      } catch (_) {
        // ignore
      }
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);

    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch (_) {
      // ignore
    }

    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
      resolve(Array.from(cache!.values()));
    }, Math.max(50, timeoutMs));
  });
}

/** Return the latest discovered providers without triggering a new request. */
export function getCachedEIP6963Providers(): EIP6963ProviderDetail[] {
  if (!cache) return [];
  return Array.from(cache.values());
}

/** Try to find a provider by a wallet id we use in UI. */
export function findProviderByWalletId(id: string, providers?: EIP6963ProviderDetail[]): EIP1193Provider | null {
  const list = providers ?? getCachedEIP6963Providers();
  const idLc = id.toLowerCase();

  const matches = (info: EIP6963ProviderInfo) => {
    const rdns = (info.rdns || '').toLowerCase();
    const name = (info.name || '').toLowerCase();
    switch (idLc) {
      case 'metamask':
        return rdns.includes('metamask') || name.includes('metamask');
      case 'coinbase':
        return rdns.includes('coinbase') || name.includes('coinbase');
      case 'brave':
        return rdns.includes('brave') || name.includes('brave');
      case 'rabby':
        return rdns.includes('rabby') || name.includes('rabby');
      default:
        return name.includes(idLc) || rdns.includes(idLc);
    }
  };

  const found = list.find((d) => matches(d.info));
  return found ? found.provider : null;
}

