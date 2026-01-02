/**
 * x402 Protocol Client
 * 
 * Implements the Coinbase x402 payment protocol for HTTP micropayments.
 * https://www.coinbase.com/developer-platform/products/x402
 * 
 * Flow:
 * 1. Client requests resource
 * 2. Server returns HTTP 402 with payment requirements
 * 3. Client signs payment authorization
 * 4. Client retries with X-PAYMENT header
 * 5. Server verifies via facilitator and returns resource
 */

import { ethers } from 'ethers';
import axios from 'axios';
import { getChainConfig, isX402Supported, getX402Network, CHAIN_ID } from './chainConfig.js';

// x402 protocol constants
const X402_VERSION = '2.0.0';

// Get chain-specific x402 config
// x402 is chain-agnostic - works on Ethereum, Base, Polygon, etc.
function getX402Config() {
  const config = getChainConfig();
  return {
    chainId: config.chainId,
    usdcAddress: config.tokens.USDC,
    // x402 network in EIP-155 format (e.g., 'eip155:1' for Ethereum, 'eip155:8453' for Base)
    paymentNetwork: config.x402Network,
    supported: config.x402Supported
  };
}

// Payment scheme for EVM exact amount
const PAYMENT_SCHEME = 'exact';

/**
 * Creates an x402 payment header for EVM chains
 * Works on any chain with x402 support (Ethereum, Base, Polygon, etc.)
 */
export async function createX402PaymentHeader(signer, paymentRequirements) {
  const { 
    payTo, 
    maxAmountRequired, 
    asset, 
    extra 
  } = paymentRequirements;

  const x402Config = getX402Config();
  const signerAddress = await signer.getAddress();
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  // Create the payment payload according to x402 spec
  const paymentPayload = {
    x402Version: X402_VERSION,
    scheme: PAYMENT_SCHEME,
    network: x402Config.paymentNetwork, // e.g., 'eip155:1' or 'eip155:8453'
    payload: {
      signature: '', // Will be filled
      authorization: {
        from: signerAddress,
        to: payTo,
        value: maxAmountRequired,
        validAfter: Math.floor(Date.now() / 1000) - 60,
        validBefore: deadline,
        nonce: extra?.nonce || ethers.hexlify(ethers.randomBytes(32))
      }
    }
  };

  // Sign the authorization using EIP-3009 transferWithAuthorization
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: x402Config.chainId, // Chain-specific (1 for Ethereum, 8453 for Base)
    verifyingContract: asset || x402Config.usdcAddress
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  const value = {
    from: paymentPayload.payload.authorization.from,
    to: paymentPayload.payload.authorization.to,
    value: paymentPayload.payload.authorization.value,
    validAfter: paymentPayload.payload.authorization.validAfter,
    validBefore: paymentPayload.payload.authorization.validBefore,
    nonce: paymentPayload.payload.authorization.nonce
  };

  const signature = await signer.signTypedData(domain, types, value);
  paymentPayload.payload.signature = signature;

  // Base64 encode the payment header
  return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
}

/**
 * Parse x402 payment requirements from 402 response
 */
export function parseX402Requirements(response) {
  const data = response.data;
  const x402Config = getX402Config();
  
  if (!data || !data.accepts || !Array.isArray(data.accepts)) {
    throw new Error('Invalid x402 response: missing accepts array');
  }

  // Find a payment option we support (current chain + USDC)
  const supported = data.accepts.find(req => 
    req.network === x402Config.paymentNetwork && 
    req.asset?.toLowerCase() === x402Config.usdcAddress.toLowerCase()
  );

  if (!supported) {
    // Try any option on our network
    const networkOption = data.accepts.find(req => req.network === x402Config.paymentNetwork);
    if (networkOption) return networkOption;
    
    // Return first option as fallback
    return data.accepts[0];
  }

  return supported;
}

/**
 * X402 Client - makes requests to x402-enabled endpoints
 */
export class X402Client {
  constructor({ signer, logger }) {
    this.signer = signer;
    this.logger = logger;
    this.axios = axios.create({
      timeout: 30000,
      validateStatus: (status) => status < 500 // Allow 4xx for x402 handling
    });
  }

  /**
   * Make an x402 request with automatic payment handling
   */
  async request(url, options = {}) {
    const { method = 'GET', data, headers = {} } = options;

    this.logger?.info?.('x402_request_start', { url, method });

    // First request - may return 402
    const firstResponse = await this.axios({
      method,
      url,
      data,
      headers: {
        ...headers,
        'Accept': 'application/json'
      }
    });

    // If not 402, return response directly
    if (firstResponse.status !== 402) {
      return {
        success: true,
        data: firstResponse.data,
        paid: false
      };
    }

    this.logger?.info?.('x402_payment_required', { 
      url, 
      x402Version: firstResponse.data?.x402Version 
    });

    // Parse payment requirements
    const paymentReqs = parseX402Requirements(firstResponse);
    
    this.logger?.info?.('x402_payment_details', {
      payTo: paymentReqs.payTo,
      amount: paymentReqs.maxAmountRequired,
      asset: paymentReqs.asset,
      network: paymentReqs.network
    });

    // Create and sign payment header
    const paymentHeader = await createX402PaymentHeader(this.signer, paymentReqs);

    // Retry with payment
    const secondResponse = await this.axios({
      method,
      url,
      data,
      headers: {
        ...headers,
        'Accept': 'application/json',
        'X-PAYMENT': paymentHeader
      }
    });

    if (secondResponse.status >= 400) {
      this.logger?.error?.('x402_payment_failed', {
        status: secondResponse.status,
        data: secondResponse.data
      });
      throw new Error(`x402 payment failed: ${secondResponse.status}`);
    }

    // Parse payment response
    const paymentResponse = secondResponse.headers['x-payment-response'];
    let settledAmount = null;
    if (paymentResponse) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentResponse, 'base64').toString());
        settledAmount = decoded.settledAmount;
        this.logger?.info?.('x402_payment_settled', { settledAmount, txHash: decoded.txHash });
      } catch (e) {
        this.logger?.warn?.('x402_response_parse_error', { error: e.message });
      }
    }

    return {
      success: true,
      data: secondResponse.data,
      paid: true,
      paymentDetails: {
        payTo: paymentReqs.payTo,
        amount: paymentReqs.maxAmountRequired,
        asset: paymentReqs.asset,
        network: paymentReqs.network,
        settledAmount
      }
    };
  }

  /**
   * Check if signer has sufficient USDC for x402 payment
   */
  async checkBalance(requiredAmount = '10000') {
    const provider = this.signer.provider;
    const signerAddress = await this.signer.getAddress();

    const usdc = new ethers.Contract(
      USDC_ADDRESS,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );

    const balance = await usdc.balanceOf(signerAddress);
    const required = BigInt(requiredAmount);

    return {
      signerAddress,
      balance: ethers.formatUnits(balance, 6),
      balanceRaw: balance.toString(),
      required: ethers.formatUnits(required, 6),
      hasSufficient: balance >= required,
      shortfall: balance >= required ? '0' : ethers.formatUnits(required - balance, 6)
    };
  }
}

/**
 * X402 Service Registry - catalog of available x402-enabled services
 * Services work on any chain with x402 support
 */
export function getX402Services() {
  const x402Config = getX402Config();
  return {
    // Web research via Perplexity
    'perplexity-search': {
      name: 'Perplexity AI Web Search',
      description: 'Real-time web search powered by Perplexity AI. Great for news, research, current events.',
      provider: 'Perplexity AI',
      endpoint: null, // Internal - we wrap Perplexity API
      cost: '1000', // 0.001 USDC
      costFormatted: '0.001 USDC',
      network: x402Config.paymentNetwork,
      category: 'research',
      internal: true
    },
    
    // On-chain analytics
    'onchain-analytics': {
      name: 'On-Chain Analytics',
      description: 'Whale tracking, wallet analysis, token holder distribution, smart money movements.',
      provider: 'Internal Analytics',
      endpoint: null, // Internal - we can use Etherscan/Dune APIs
      cost: '1000', // 0.001 USDC
      costFormatted: '0.001 USDC',
      network: x402Config.paymentNetwork,
      category: 'analytics',
      internal: true
    },
    
    // AI Image generation via Google Vertex AI Imagen
    'image-generation': {
      name: 'AI Image Generation',
      description: 'Generate high-quality images from text prompts using Google Imagen 3.',
      provider: 'Google Imagen 3',
      endpoint: null, // Internal - we use Gemini 2.0 Flash with image output
      cost: '2000', // 0.002 USDC (slightly more expensive for image gen)
      costFormatted: '0.002 USDC',
      network: x402Config.paymentNetwork,
      category: 'creative',
      internal: true
    }
  };
}

// Export for backwards compatibility
export const X402_SERVICES = getX402Services();

/**
 * Get list of available x402 services for LLM context
 */
export function getX402ServiceList() {
  return Object.entries(X402_SERVICES)
    .map(([id, service]) => ({
      id,
      ...service
    }));
}

/**
 * Format x402 services for prompt
 */
export function formatX402ServicesForPrompt() {
  const services = getX402ServiceList();
  
  return services
    .map(s => `• ${s.name} (${s.costFormatted}) - ${s.description}`)
    .join('\n');
}

export default X402Client;

