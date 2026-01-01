/**
 * research.js - Research tools using x402 protocol
 *
 * Implements Coinbase x402 payment protocol for paid API access.
 * https://www.coinbase.com/developer-platform/products/x402
 *
 * Uses ERC-7715 delegation to transfer USDC from user's wallet to x402 provider.
 * 1. pay_x402 - Executes delegated USDC transfer to the x402 provider
 * 2. web_research - Calls Perplexity with the paid access
 */

import { z } from 'zod';
import axios from 'axios';
import { ethers } from 'ethers';
import X402Client, { X402_SERVICES, formatX402ServicesForPrompt } from '../../lib/x402Client.js';
import { DelegationSigner } from '../../lib/delegationSigner.js';
import { getChainConfig, isX402Supported, getRpcUrl } from '../../lib/chainConfig.js';
import { formatGasForOutput, applyGasTierToTx } from './gas.js';

// x402 payment recipient
const X402_PAYTO = process.env.X402_PAYTO || '0xc4a26e163b0f281b455498414d6ab1fce06baf1b';

/**
 * Get x402 cost dynamically from service registry
 */
function getX402Cost(serviceId = 'perplexity-search') {
  const service = X402_SERVICES[serviceId];
  if (!service) {
    return { units: '10000', formatted: '0.01' };
  }
  return {
    units: service.cost,
    formatted: service.costFormatted.replace(' USDC', '')
  };
}

// ERC20 ABI for transfers
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

/**
 * Call Perplexity API for web research
 */
async function callPerplexity(query, logger, emit) {
  const apiKey = process.env.PPLX_API_KEY;
  if (!apiKey) {
    throw new Error('PPLX_API_KEY not configured');
  }

  const currentDate = new Date().toISOString().split('T')[0];

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      // Use sonar-pro for more reliable citations
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: `You are a helpful research assistant. Today's date is ${currentDate}. Provide concise, factual answers with relevant data. Always cite your sources.`
        },
        {
          role: 'user',
          content: `As of ${currentDate}: ${query}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.2,
      // Request both citations and related questions for richer responses
      return_citations: true,
      return_related_questions: false
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  // Log the FULL response structure to debug citation issues
  // Using info level so it shows in production logs
  logger?.info?.('perplexity_response_structure', { 
    hasCitations: !!response.data.citations,
    citationCount: response.data.citations?.length || 0,
    responseKeys: Object.keys(response.data || {}),
    model: response.data.model,
    // Log first few citations if they exist
    citationsSample: response.data.citations?.slice(0, 3) || 'none'
  });

  // Citations can be in different places depending on the model/response
  let citations = response.data.citations || [];
  
  // Some responses have citations embedded in the message
  const message = response.data.choices?.[0]?.message;
  if (citations.length === 0 && message?.citations) {
    citations = message.citations;
    logger?.info?.('perplexity_citations_from_message', { count: citations.length });
  }
  
  // Log final citation state
  logger?.info?.('perplexity_final_citations', { 
    count: citations.length,
    sample: citations.slice(0, 2)
  });

  return {
    answer: message?.content || '',
    citations: citations,
    model: response.data.model
  };
}

/**
 * Generate image using Google Vertex AI Imagen
 * 
 * Uses the default Cloud Run service account for authentication.
 * This avoids the API key limitation of the Gemini API.
 * 
 * Reference: https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
 */
async function generateImage(prompt, logger, emit) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT env var required for image generation');
  }
  const location = 'us-central1';
  const model = 'imagen-3.0-generate-001';
  
  // Get access token from metadata server (works on Cloud Run)
  let accessToken;
  try {
    const tokenResponse = await axios.get(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        timeout: 5000
      }
    );
    accessToken = tokenResponse.data.access_token;
  } catch (e) {
    logger?.error?.('metadata_token_failed', { error: e.message });
    throw new Error('Failed to get Google Cloud credentials. Make sure the service is running on Cloud Run.');
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

  logger?.info?.('imagen_generate_start', { prompt: prompt.substring(0, 100), model, projectId });

  // Start a keepalive interval to prevent proxy/frontend timeouts
  // Image generation can take 10-20 seconds
  let keepaliveInterval;
  if (emit) {
    keepaliveInterval = setInterval(() => {
      emit({ type: 'heartbeat', ts: Date.now(), status: 'generating_image' });
    }, 2000); // Every 2 seconds during image generation
  }

  try {
    const response = await axios.post(
      url,
      {
        instances: [
          {
            prompt: prompt
          }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          safetySetting: 'block_some',
          personGeneration: 'allow_adult'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    // Clear keepalive once done
    if (keepaliveInterval) clearInterval(keepaliveInterval);

    const predictions = response.data?.predictions;
    if (!predictions || predictions.length === 0) {
      throw new Error('No predictions in response');
    }

    const imageData = predictions[0]?.bytesBase64Encoded;
    if (!imageData) {
      throw new Error('No image data in response');
    }

    logger?.info?.('imagen_generate_success', { 
      imageSize: imageData.length,
      model 
    });

    return {
      base64: imageData,
      mimeType: 'image/png',
      model: 'Imagen 3'
    };
    
  } catch (error) {
    // Clear keepalive on error
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    
    const errorMsg = error.response?.data?.error?.message || error.message;
    const errorStatus = error.response?.status;
    
    logger?.error?.('imagen_api_error', { 
      status: errorStatus, 
      error: errorMsg,
      model,
      responseData: JSON.stringify(error.response?.data || {}).substring(0, 500)
    });
    
    if (errorStatus === 403) {
      throw new Error('Vertex AI API not enabled or service account lacks permissions. Enable the Vertex AI API in Google Cloud Console.');
    } else if (errorStatus === 404) {
      throw new Error('Imagen model not available in this region.');
    } else {
      throw new Error(`Image generation failed: ${errorMsg}`);
    }
  }
}

/**
 * Get RPC provider
 */
function getProvider(chainId = null) {
  const rpcUrl = getRpcUrl(chainId);
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get USDC address for current chain
 */
function getUsdcAddressForChain(chainId = null) {
  const config = getChainConfig(chainId);
  return config.tokens.USDC;
}

export const researchTools = [
  {
    name: 'get_x402_quote',
    description: `⚠️ CALL THIS FIRST before any x402 service! Gets a quote with gas estimate.

This tool:
1. Calls estimate_gas_cost internally (visible in output)
2. Returns formatted offer to show user
3. Includes service cost + gas estimate

Available services:
- perplexity-search: Web research (0.001 USDC)
- onchain-analytics: Whale/wallet analysis (0.001 USDC)  
- image-generation: AI image generation (0.002 USDC)

The response includes a "showToUser" field - display that to the user!`,
    parameters: z.object({
      query: z.string().describe('The search query or image prompt to show in the offer'),
      serviceId: z.string().default('perplexity-search').optional().describe('Which x402 service (perplexity-search, onchain-analytics, or image-generation)'),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Wallet address')
    }),
    tags: ['free', 'read', 'x402'],
    handler: async ({ query, serviceId = 'perplexity-search', walletAddress }, context) => {
      const chainId = context?.chainId;
      const emit = context?.emit;
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      
      // Get x402 cost for the service
      const x402Cost = getX402Cost(serviceId);
      const X402_COST_FORMATTED = x402Cost.formatted;
      
      // Get service info
      const serviceInfo = X402_SERVICES[serviceId] || X402_SERVICES['perplexity-search'];
      const serviceName = serviceInfo?.name || 'Perplexity AI web search';
      
      // Provider names for each service
      const providerMap = {
        'perplexity-search': 'Perplexity AI',
        'onchain-analytics': 'On-Chain Analytics Engine',
        'image-generation': 'Google Imagen 3'
      };
      const providerName = providerMap[serviceId] || 'Third Party';
      
      // EMIT gas estimation as a visible sub-tool call!
      if (emit) {
        emit({ 
          type: 'tool_call', 
          tool: 'estimate_gas_cost', 
          input: { transactionType: 'erc20Transfer', gasTier: 'standard' }
        });
      }
      
      // Get gas estimate
      const gasEstimate = await formatGasForOutput('erc20Transfer', 'standard', chainId);
      
      // Emit gas result
      if (emit) {
        emit({ 
          type: 'tool_result', 
          tool: 'estimate_gas_cost', 
          output: gasEstimate 
        });
      }
      
      // Check USDC balance if wallet provided
      let balanceInfo = '';
      if (address) {
        try {
          const provider = getProvider(chainId);
          const USDC_ADDRESS = getUsdcAddressForChain(chainId);
          const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
          const balance = await usdc.balanceOf(address);
          const balanceFormatted = ethers.formatUnits(balance, 6);
          balanceInfo = `\n**Your USDC balance:** ${balanceFormatted} USDC`;
        } catch (e) {
          // Ignore balance check errors
        }
      }
      
      return {
        status: 'QUOTE_READY',
        service: serviceId,
        serviceName: serviceName,
        provider: providerName,
        query: query,
        gasEstimation: {
          tool: 'estimate_gas_cost',
          transactionType: 'erc20Transfer',
          result: gasEstimate.formatted,
          rawData: gasEstimate
        },
        costs: {
          serviceFee: X402_COST_FORMATTED + ' USDC',
          estimatedGas: gasEstimate.formatted
        },
        // THIS IS WHAT THE LLM SHOULD SHOW TO THE USER!
        showToUser: `I can help with that using x402 ${serviceName}.

**Query:** ${query}
**Service:** ${serviceName}
**Provider:** ${providerName}

**Costs:**
- Service fee: ${X402_COST_FORMATTED} USDC
- Estimated gas: ${gasEstimate.allTiers?.standard?.costUsd || gasEstimate.formatted} (Standard, ${gasEstimate.allTiers?.standard?.time || '30s-1min'})
  - Slow: ${gasEstimate.allTiers?.slow?.costUsd || '<$0.01'} (${gasEstimate.allTiers?.slow?.time || '1-5 min'})
  - Fast: ${gasEstimate.allTiers?.fast?.costUsd || '<$0.01'} (${gasEstimate.allTiers?.fast?.time || '<30s'})
${balanceInfo}
**Settlement:** Instant via delegation

Would you like to proceed? (You can also modify the query above)`,
        nextStep: 'If user confirms, call pay_x402 ONCE (not twice!) with simulate=false. If user modifies query, call get_x402_quote again with new query.',
        WARNING: 'DO NOT call pay_x402 multiple times - only ONE call is needed for payment!'
      };
    }
  },
  
  {
    name: 'list_x402_services',
    description: 'List all available x402-enabled services and their costs.',
    parameters: z.object({}),
    tags: ['free', 'read', 'x402'],
    handler: async (_, context) => {
      const services = Object.entries(X402_SERVICES).map(([id, service]) => ({
        id,
        name: service.name,
        description: service.description,
        cost: service.costFormatted,
        network: service.network,
        category: service.category
      }));
      
      return {
        x402Protocol: {
          version: '2.0.0',
          description: 'Coinbase x402 - HTTP micropayments via 402 Payment Required'
        },
        services,
        paymentMethod: 'USDC via ERC-7715 delegation (paid directly from your wallet)',
        note: 'Your wallet must have USDC and delegation permissions for USDC transfers.'
      };
    }
  },
  
  {
    name: 'pay_x402',
    description: `Pay for x402 service access using delegation.

CRITICAL: Call this tool EXACTLY ONCE per service request! NEVER call pay_x402 twice!

Uses ERC-7715 delegation to transfer USDC directly from your wallet to the x402 provider.
No need to fund any signer wallet - payment comes straight from your wallet!

PREREQUISITES:
- Wallet must have sufficient USDC
- Delegation must include ERC-20 (USDC) transfer permission

Set simulate=true to get a quote with gas estimate first.
After payment succeeds, call web_research/generate_image to use the paid service.`,
    parameters: z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Wallet address'),
      serviceId: z.string().default('perplexity-search').describe('Which x402 service to pay for'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard').optional().describe('Gas speed tier'),
      simulate: z.boolean().default(true).optional().describe('If true, return quote with gas estimate. If false, execute payment.')
    }),
    tags: ['tx', 'write', 'x402', 'delegation'],
    handler: async ({ walletAddress, serviceId = 'perplexity-search', gasTier = 'standard', simulate = true }, context) => {
      const logger = context?.logger;
      const chainId = context?.chainId;
      const emit = context?.emit;
      
      // Check x402 support
      if (!isX402Supported(chainId)) {
        throw new Error(`x402 is not supported on this chain. Please switch to Base or Ethereum mainnet.`);
      }
      
      // Get x402 cost
      const x402Cost = getX402Cost(serviceId);
      const X402_COST_UNITS = x402Cost.units;
      const X402_COST_FORMATTED = x402Cost.formatted;
      
      // Check x402Mode
      const x402Mode = context?.memoryFacts?.x402Mode || 'off';
      if (x402Mode === 'off') {
        return {
          error: 'x402 services disabled',
          x402Mode: 'off',
          suggestion: 'Enable x402Mode ("ask" or "auto") to use paid services.'
        };
      }
      
      // Get wallet address
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress required for x402 payment - connect your wallet first');
      }
      
      const provider = getProvider(chainId);
      const USDC_ADDRESS = getUsdcAddressForChain(chainId);
      
      // Check wallet USDC balance
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const walletBalance = await usdc.balanceOf(address);
      const requiredAmount = BigInt(X402_COST_UNITS);
      
      if (walletBalance < requiredAmount) {
        const walletBalanceFormatted = ethers.formatUnits(walletBalance, 6);
        return {
          error: 'Insufficient USDC in wallet',
          status: 'NEEDS_USDC',
          walletBalance: walletBalanceFormatted + ' USDC',
          required: X402_COST_FORMATTED + ' USDC',
          suggestion: 'Swap some ETH to USDC first, or transfer USDC to your wallet.'
        };
      }
      
      // Get gas estimate
      const gasEstimate = await formatGasForOutput('erc20Transfer', gasTier, chainId);
      
      // If simulate mode, return quote with gas estimate
      // Include a pre-formatted offer for the LLM to present to user!
      if (simulate) {
        return {
          simulation: true,
          status: 'QUOTE',
          service: serviceId,
          serviceName: 'Perplexity AI web search',
          cost: X402_COST_FORMATTED + ' USDC',
          walletBalance: ethers.formatUnits(walletBalance, 6) + ' USDC',
          recipient: X402_PAYTO,
          gas: {
            tier: gasTier,
            tierName: gasEstimate.gasTierName,
            estimatedCost: gasEstimate.formatted,
            allTiers: gasEstimate.allTiers
          },
          // Pre-formatted offer for LLM to show user - SHOW THIS VERBATIM!
          userOffer: `I can search for that using x402 web research.

**Query:** [INSERT YOUR SEARCH QUERY HERE - user can modify this!]
**Service:** Perplexity AI web search

**Costs:**
- Service fee: ${X402_COST_FORMATTED} USDC
- Estimated gas: ${gasEstimate.formatted}

**Settlement:** Instant via delegation

Would you like to proceed? (You can modify the query above)`,
          instructions: 'SHOW the userOffer to the user with your search query filled in. Wait for confirmation before calling pay_x402 simulate=false.'
        };
      }
      
      // No progress events - user doesn't want them
      
      // Create delegation signer
      const delegationSigner = new DelegationSigner({
        walletAddress: address,
        provider,
        logger
      });
      
      // Encode USDC transfer call
      const usdcInterface = new ethers.Interface(ERC20_ABI);
      const transferData = usdcInterface.encodeFunctionData('transfer', [X402_PAYTO, requiredAmount]);
      
      logger?.info?.('pay_x402_via_delegation', {
        from: address,
        to: X402_PAYTO,
        amount: X402_COST_FORMATTED,
        service: serviceId
      });
      
      try {
        // Execute via delegation - USDC contract call with transfer data
        // Pass tokenAddress to use the ERC-20 specific permissionsContext
        const receipt = await delegationSigner.sendTransactionWithDelegation({
          to: USDC_ADDRESS,      // Call USDC contract
          data: transferData,    // transfer(x402Provider, amount)
          value: 0n              // No ETH
        }, { tokenAddress: USDC_ADDRESS });
        
        const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown';
        const effectiveGasPrice = receipt.effectiveGasPrice 
          ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei'
          : 'unknown';
        
        logger?.info?.('pay_x402_success', {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed
        });
        
        // Determine next tool based on service
        const nextToolMap = {
          'perplexity-search': 'web_research',
          'onchain-analytics': 'onchain_analytics',
          'image-generation': 'generate_image'
        };
        const nextTool = nextToolMap[serviceId] || 'web_research';
        
        // Return with EXPLICIT instructions - put the critical instruction FIRST
        return {
          // Put the critical instruction at the top so LLM sees it first
          IMPORTANT: `PAYMENT COMPLETE. DO NOT call pay_x402 again. Your next action is to call ${nextTool}.`,
          nextStep: {
            action: 'CALL_TOOL',
            tool: nextTool,
            instruction: serviceId === 'image-generation' 
              ? `Call generate_image with the user's image prompt`
              : serviceId === 'onchain-analytics'
                ? `Call onchain_analytics with the user's analysis request`
                : `Call web_research with the user's query`
          },
          paymentReceipt: {
            success: true,
            status: 'PAID',
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            service: serviceId,
            cost: X402_COST_FORMATTED + ' USDC',
            from: address,
            to: X402_PAYTO
          }
        };
        
      } catch (paymentError) {
        logger?.error?.('pay_x402_delegation_failed', { error: paymentError.message });
        
        // Re-throw as DelegationError for automatic diagnosis by Agent.js
        // This ensures x402 errors get the same auto-diagnosis as transfers!
        const delegationError = new Error(paymentError.message);
        delegationError.name = 'DelegationError';
        delegationError.originalError = paymentError.message;
        
        // Include context for better diagnosis
        delegationError.context = {
          tool: 'pay_x402',
          tokenAddress: USDC_ADDRESS,
          amount: X402_COST_FORMATTED,
          service: serviceId
        };
        
        throw delegationError;
      }
    }
  },
  
  // FREE web search - no x402 payment needed
  {
    name: 'browse_web',
    description: `Search the web using Perplexity AI. FREE to use!

Use this for:
- Real-time web search and current events
- Crypto market news and analysis  
- Technical research and explanations
- Any topic requiring up-to-date information
- "Browse the internet for...", "Search for...", "What's happening with..."

The response includes a "showToUser" field with the answer AND sources - display that directly to the user!`,
    parameters: z.object({
      query: z.string().min(5).max(500).describe('The search query - be specific for better results')
    }),
    tags: ['free', 'research', 'web'],
    handler: async ({ query }, context) => {
      const logger = context?.logger;
      const emit = context?.emit;
      
      logger?.info?.('browse_web_start', { query });

      try {
        const result = await callPerplexity(query, logger, emit);
        
        // Format citations for display
        const citations = result.citations || [];
        let sourcesSection = '';
        if (citations.length > 0) {
          sourcesSection = '\n\n**Sources:**\n' + citations.map((url, i) => `${i + 1}. ${url}`).join('\n');
        } else {
          sourcesSection = '\n\n*(No source citations available for this query)*';
        }
        
        logger?.info?.('browse_web_result', { 
          answerLength: result.answer?.length, 
          citationCount: citations.length,
          hasSources: citations.length > 0,
          showToUserLength: (result.answer + sourcesSection).length
        });
        
        return {
          service: 'Perplexity AI',
          query,
          answer: result.answer,
          citations: citations,
          model: result.model,
          searchDate: new Date().toISOString(),
          // Pre-formatted output for LLM to display
          showToUser: `${result.answer}${sourcesSection}`
        };
        
      } catch (researchError) {
        logger?.error?.('browse_web_failed', { error: researchError.message });
        throw new Error(`Web search failed: ${researchError.message}`);
      }
    }
  },

  // PAID version (x402) - disabled for now
  /*
  {
    name: 'web_research',
    description: `Call Perplexity AI for web research. REQUIRES x402 payment first!

PREREQUISITE: Call pay_x402 BEFORE this tool to pay for access.

GOOD FOR:
- Real-time web search and current events
- Crypto market news and analysis  
- Technical research and explanations
- Any topic requiring up-to-date information`,
    parameters: z.object({
      query: z.string().min(5).max(500).describe('The research question - be specific for better results')
    }),
    tags: ['paid', 'x402', 'research'],
    handler: async ({ query }, context) => {
      const logger = context?.logger;
      const emit = context?.emit;
      
      // Check x402Mode
      const x402Mode = context?.memoryFacts?.x402Mode || 'off';
      if (x402Mode === 'off') {
        return {
          error: 'x402 services disabled',
          x402Mode: 'off',
          suggestion: 'Enable x402Mode ("ask" or "auto") to use paid research services.',
          freeAlternatives: ['get_prices', 'get_market_sentiment', 'get_holdings']
        };
      }

      logger?.info?.('web_research_start', { query, x402Mode });

      try {
        const result = await callPerplexity(query, logger, emit);
        logger?.info?.('web_research_success', { answerLength: result.answer?.length });
        
        return {
          service: 'Perplexity AI',
          query,
          answer: result.answer,
          citations: result.citations || [],
          model: result.model,
          searchDate: new Date().toISOString()
        };
        
      } catch (researchError) {
        logger?.error?.('web_research_failed', { error: researchError.message });
        throw new Error(`Research failed: ${researchError.message}`);
      }
    }
  },
  */
  
  {
    name: 'onchain_analytics',
    description: `Premium on-chain analytics. REQUIRES x402 payment first!

PREREQUISITE: Call pay_x402(serviceId="onchain-analytics") BEFORE this tool.

GOOD FOR:
- Whale wallet tracking and analysis
- Token holder distribution
- Smart money movements
- Wallet portfolio analysis
- Transaction history insights`,
    parameters: z.object({
      analysisType: z.enum(['whale_tracking', 'holder_distribution', 'wallet_analysis', 'smart_money']).describe('Type of analysis'),
      target: z.string().describe('Token symbol/address or wallet address to analyze'),
      timeframe: z.enum(['24h', '7d', '30d']).default('7d').optional().describe('Timeframe for analysis')
    }),
    tags: ['paid', 'x402', 'analytics'],
    handler: async ({ analysisType, target, timeframe = '7d' }, context) => {
      const logger = context?.logger;
      
      // Check x402Mode
      const x402Mode = context?.memoryFacts?.x402Mode || 'off';
      if (x402Mode === 'off') {
        return {
          error: 'x402 services disabled',
          x402Mode: 'off',
          suggestion: 'Enable x402Mode ("ask" or "auto") to use paid analytics services.'
        };
      }
      
      logger?.info?.('onchain_analytics_start', { analysisType, target, timeframe, x402Mode });
      
      // For now, return mock data - in production this would call Etherscan/Dune APIs
      // This demonstrates the x402 payment flow
      const mockAnalytics = {
        whale_tracking: {
          summary: `Top whale movements for ${target} in the last ${timeframe}`,
          topHolders: [
            { rank: 1, address: '0x1234...5678', balance: '5,000,000', percentOfSupply: '5.00%' },
            { rank: 2, address: '0xabcd...efgh', balance: '3,200,000', percentOfSupply: '3.20%' },
            { rank: 3, address: '0x9876...5432', balance: '2,100,000', percentOfSupply: '2.10%' }
          ],
          recentMoves: [
            { type: 'accumulation', amount: '+500,000', wallet: '0x1234...5678', time: '2h ago' },
            { type: 'distribution', amount: '-200,000', wallet: '0xabcd...efgh', time: '6h ago' }
          ]
        },
        holder_distribution: {
          summary: `Token holder distribution for ${target}`,
          distribution: {
            whales: { count: 45, percentHeld: '62%' },
            dolphins: { count: 1200, percentHeld: '25%' },
            fish: { count: 50000, percentHeld: '13%' }
          },
          trend: 'Slight accumulation by whales over past 7 days'
        },
        wallet_analysis: {
          summary: `Wallet analysis for ${target}`,
          holdings: [
            { token: 'ETH', balance: '125.5', valueUsd: '$371,000' },
            { token: 'USDC', balance: '50,000', valueUsd: '$50,000' }
          ],
          activity: 'High activity - 45 transactions in last 7 days',
          label: 'Likely smart money / early DeFi adopter'
        },
        smart_money: {
          summary: `Smart money movements for ${target} (${timeframe})`,
          netFlow: '+$2.5M net inflow from smart money wallets',
          topBuyers: ['Jump Trading', 'Wintermute', 'Alameda-linked'],
          sentiment: 'Bullish accumulation pattern detected'
        }
      };
      
      const result = mockAnalytics[analysisType] || mockAnalytics.whale_tracking;
      
      logger?.info?.('onchain_analytics_success', { analysisType, target });
      
      return {
        service: 'On-Chain Analytics',
        analysisType,
        target,
        timeframe,
        ...result,
        disclaimer: 'Data is for informational purposes only. Not financial advice.',
        generatedAt: new Date().toISOString()
      };
    }
  },
  
  {
    name: 'generate_image',
    description: `Generate AI images using Gemini Nano Banana. REQUIRES x402 payment first!

PREREQUISITE: Call pay_x402(serviceId="image-generation") BEFORE this tool.

Uses Google's Gemini 2.0 Flash with native image generation capabilities.

GOOD FOR:
- Creating unique artwork from text descriptions
- Visualizing concepts and ideas
- Generating illustrations for projects  
- Creating custom graphics

Returns base64 encoded image that can be displayed inline.`,
    parameters: z.object({
      prompt: z.string().min(5).max(1000).describe('Description of the image to generate. Be specific and detailed for best results.'),
      style: z.enum(['photorealistic', 'artistic', 'illustration', 'abstract']).optional().describe('Style of image to generate')
    }),
    tags: ['paid', 'x402', 'image', 'creative'],
    handler: async ({ prompt, style }, context) => {
      const logger = context?.logger;
      
      // Check x402Mode
      const x402Mode = context?.memoryFacts?.x402Mode || 'off';
      if (x402Mode === 'off') {
        return {
          error: 'x402 services disabled',
          x402Mode: 'off',
          suggestion: 'Enable x402Mode ("ask" or "auto") to use paid image generation.'
        };
      }
      
      // Enhance prompt with style if provided
      let enhancedPrompt = prompt;
      if (style) {
        const styleGuides = {
          photorealistic: 'photorealistic, high detail, professional photography, 4K',
          artistic: 'artistic, painterly, creative interpretation, fine art style',
          illustration: 'digital illustration, clean lines, vibrant colors, graphic design',
          abstract: 'abstract art, geometric shapes, bold colors, modern design'
        };
        enhancedPrompt = `${prompt}. Style: ${styleGuides[style] || style}`;
      }
      
      logger?.info?.('generate_image_start', { promptLength: prompt.length, style, x402Mode });
      
      const emit = context?.emit;
      
      try {
        const result = await generateImage(enhancedPrompt, logger, emit);
        
        logger?.info?.('generate_image_success', { model: result.model, imageSize: result.base64?.length });
        
        // Store image and get URL (base64 is too large for SSE - would kill the connection)
        const { storeImage } = await import('../../index.js');
        const imageId = storeImage(result.base64, result.mimeType);
        
        // Get base URL from environment
        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:8080';
        const imageUrl = `${baseUrl}/images/${imageId}`;
        
        logger?.info?.('image_stored', { imageId, imageUrl });
        
        // Emit lightweight event with URL (not base64!)
        if (emit) {
          emit({
            type: 'generated_image',
            imageUrl: imageUrl,
            imageId: imageId,
            prompt: prompt,
            model: result.model,
            mimeType: result.mimeType
          });
        }
        
        // Return summary to LLM
        return {
          success: true,
          service: 'Google Imagen 3',
          prompt: prompt,
          style: style || 'default',
          model: result.model,
          imageUrl: imageUrl,
          generatedAt: new Date().toISOString(),
          message: `Image generated successfully! View it at: ${imageUrl}`,
          displayInstructions: 'The image URL is valid for 10 minutes. Frontend should render it using an <img> tag.'
        };
        
      } catch (genError) {
        logger?.error?.('generate_image_failed', { error: genError.message });
        throw new Error(`Image generation failed: ${genError.message}`);
      }
    }
  },
  
  {
    name: 'request_x402_refund',
    description: `Request a refund for a failed x402 payment.`,
    parameters: z.object({
      txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).describe('The x402 payment transaction hash'),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe('Your wallet address')
    }),
    tags: ['free', 'x402', 'refund'],
    handler: async ({ txHash, walletAddress }, context) => {
      const effectiveWalletAddress = walletAddress ?? context?.walletAddress ?? context?.memoryFacts?.walletAddress;
      const logger = context?.logger;
      const chainId = context?.chainId;
      
      const USDC_ADDRESS = getUsdcAddressForChain(chainId);
      const x402Cost = getX402Cost('perplexity-search');
      const X402_COST_UNITS = x402Cost.units;
      const X402_COST_FORMATTED = x402Cost.formatted;
      
      logger?.info?.('x402_refund_request', { txHash, walletAddress: effectiveWalletAddress?.slice(0, 10) });
      
      const provider = getProvider(chainId);
      
      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
          return { error: 'Transaction not found', txHash };
        }
        
        // For delegation transactions, the target is the DelegationManager
        // We need to check if USDC was transferred to X402_PAYTO
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
          return { error: 'Transaction receipt not found', txHash };
        }
        
        // Look for Transfer event in logs
        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        const transferLog = receipt.logs.find(log => 
          log.topics[0] === transferTopic && 
          log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()
        );
        
        if (!transferLog) {
          return { error: 'No USDC transfer found in transaction', txHash };
        }
        
        // Decode the transfer
        const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
        const decoded = iface.parseLog({ topics: transferLog.topics, data: transferLog.data });
        
        if (decoded.args.to.toLowerCase() !== X402_PAYTO.toLowerCase()) {
          return { error: 'Not an x402 payment transaction', txHash };
        }
        
        const payer = decoded.args.from;
        const amount = decoded.args.value;
        
        // Verify it's the correct user's payment
        if (effectiveWalletAddress && payer.toLowerCase() !== effectiveWalletAddress.toLowerCase()) {
          return {
            error: 'Payment was not from your wallet',
            txHash,
            expectedWallet: effectiveWalletAddress,
            actualPayer: payer
          };
        }
        
        // Process refund
        const x402Wallet = new ethers.Wallet(process.env.X402_REFUND_KEY || process.env.GAS_SPONSOR_KEY, provider);
        const usdcWithX402Wallet = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, x402Wallet);
        
        const x402Balance = await usdcWithX402Wallet.balanceOf(await x402Wallet.getAddress());
        if (x402Balance < amount) {
          return {
            error: 'Refund wallet has insufficient USDC',
            txHash,
            suggestion: 'Contact support for manual refund'
          };
        }
        
        const refundTx = await usdcWithX402Wallet.transfer(payer, amount);
        await refundTx.wait();
        
        logger?.info?.('x402_refund_success', { refundTxHash: refundTx.hash, to: payer });
        
        return {
          success: true,
          status: 'REFUNDED',
          originalPayment: txHash,
          refundTx: refundTx.hash,
          refundedTo: payer,
          refundAmount: ethers.formatUnits(amount, 6) + ' USDC',
          message: 'x402 payment has been refunded'
        };
        
      } catch (error) {
        logger?.error?.('x402_refund_error', { error: error.message, txHash });
        return {
          error: `Refund failed: ${error.message}`,
          txHash
        };
      }
    }
  }
];

export { formatX402ServicesForPrompt };
