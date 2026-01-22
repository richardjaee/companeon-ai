import type { NextApiRequest, NextApiResponse } from 'next';
import * as Sentry from '@sentry/nextjs';

// ✅ Disable body parsing for SSE streaming
export const config = {
  api: {
    bodyParser: true,  // Keep true for non-streaming endpoints
    responseLimit: false
  }
};




const endpointMap: { [key: string]: string | undefined } = {
  GET_TOKENS: process.env.GET_TOKENS_URL,
  GET_NFTS: process.env.GET_NFTS_URL,

  GET_PRICE_CACHE: process.env.GET_PRICE_CACHE_URL,
  GET_HISTORICAL_PRICES_URL: process.env.GET_HISTORICAL_PRICES_URL,

  REOWN_PROJECT_ID: process.env.REOWN_PROJECT_ID,

  CREATE_AGENT_SESSION_URL: process.env.CREATE_AGENT_SESSION_URL,
  SEND_AGENT_PROMPT_URL: process.env.SEND_AGENT_PROMPT_URL,
  LIVE_AGENT_ASK_STREAM_URL: process.env.LIVE_AGENT_ASK_STREAM_URL,

  GET_AGENT_TOOLS_URL: process.env.GET_AGENT_TOOLS_URL,
  LIST_AGENT_LOGS_URL: process.env.LIST_AGENT_LOGS_URL,

  REGISTER_AGENT_URL: process.env.REGISTER_AGENT_URL,
  GET_AGENT_STATUS_URL: process.env.GET_AGENT_STATUS_URL,
  REGISTER_WALLET_AGENT_URL: process.env.REGISTER_WALLET_AGENT_URL,
  GET_WALLET_NONCE_FOR_ACTION_URL: process.env.GET_WALLET_NONCE_FOR_ACTION_URL,
  VERIFY_WALLET_ACTION_URL: process.env.VERIFY_WALLET_ACTION_URL,
  GET_WALLET_LIMITS_URL: process.env.GET_WALLET_LIMITS_URL
};

interface ProxyRequestBody {
  endpoint: string;
  method: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000;

/**
 * Sleep function to wait between retries
 * @param ms milliseconds to wait
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Perform fetch with retry mechanism
 * @param url URL to fetch
 * @param options fetch options
 * @param maxRetries maximum number of retries
 * @param retryDelay initial delay between retries (will increase exponentially)
 * @returns fetch response
 */
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries: number = MAX_RETRIES, 
  retryDelay: number = INITIAL_RETRY_DELAY
): Promise<Response> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {

      const response = await fetch(url, options);
      
      const shouldRetryStatusCode = 
        response.status === 404 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;
      
      if (shouldRetryStatusCode && attempt < maxRetries) {
        await sleep(retryDelay);
        retryDelay *= 2;
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const isNetworkError = 
        error instanceof Error && 
        (error.message.includes('timeout') || 
         error.message.includes('ECONNRESET') ||
         error.message.includes('failed'));
         
      if (!isNetworkError) {
        throw error;
      }
      
      await sleep(retryDelay);
      
      retryDelay *= 2;
    }
  }
  
  throw lastError;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Validate that body exists and is properly parsed
  if (!req.body || typeof req.body !== 'object') {
    
    Sentry.captureMessage('Invalid request body to proxyEndpoint', {
      level: 'warning',
      extra: {
        contentType: req.headers['content-type'],
        bodyType: typeof req.body
      }
    });
    return res.status(400).json({
      error: 'Invalid request body. Expected JSON with endpoint and method fields.'
    });
  }

  const { endpoint, method, data, params, headers: clientHeaders } = req.body as ProxyRequestBody;
  if (!endpoint || typeof endpoint !== 'string') {
    return res
      .status(400)
      .json({ error: 'Endpoint is required in the request body.' });
  }

  
  let url = endpointMap[endpoint];

  
  
  if (!url) {
    
    
    return res
      .status(400)
      .json({
        error: `Invalid endpoint requested: ${endpoint}`,
        availableEndpoints: Object.keys(endpointMap)
      });
  }

  if (!url.startsWith('http')) {
    return res.status(200).json({ contractAddress: url });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(clientHeaders || {})
  };

  // Use API key for all endpoints
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const actualMethod = method.toUpperCase();

  // Append query parameters for GET requests
  if (actualMethod === 'GET' && params) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    const queryString = queryParams.toString();
    if (queryString) {
      url = `${url}?${queryString}`;
    }
  }

  const fetchOptions: RequestInit = {
    method: actualMethod,
    headers,
  };

  if (actualMethod !== 'GET' && data !== undefined) {
    fetchOptions.body = JSON.stringify(data);
  }

  try {

    const response = await fetchWithRetry(url, fetchOptions);

    // Handle SSE streaming for live agent
    if (endpoint === 'LIVE_AGENT_ASK_STREAM_URL') {
      // ✅ Set all required SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Prevent nginx buffering

      // ✅ CRITICAL: Flush headers immediately to establish SSE connection
      res.flushHeaders();

      // Stream the response
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
          res.end();
        } catch (streamError) {
          
          res.end();
        }
      } else {
        res.status(500).json({ error: 'No response body for stream' });
      }
      return;
    }

    const contentType = response.headers.get('Content-Type') || '';
    let responseData;

    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return res.status(response.status).json(responseData);
  } catch (error) {
    Sentry.captureException(error);

    let errorMessage = 'Request failed after multiple retries. Please try again later.';
    
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorMessage = 'Payment service is currently starting up. All retries have been exhausted. Please refresh the page and try again.';
      } else if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
        errorMessage = 'Payment service is temporarily unavailable. All retries have been exhausted. Please try again in a few moments.';
      } else if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
        errorMessage = 'Network connection issues detected. All retries have been exhausted. Please check your connection and try again.';
      }
    }
    
    return res.status(500).json({ 
      error: 'Payment session creation failed', 
      details: errorMessage
    });
  }
}
