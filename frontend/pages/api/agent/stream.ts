import type { NextApiRequest, NextApiResponse } from 'next';
import getRawBody from 'raw-body';

// ✅ CRITICAL: Disable body parsing for SSE streaming + increase timeout for long-running tools
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false // Disable response size limit for streaming
  },
  maxDuration: 300 // 5 minutes for long-running tools (Vercel serverless function timeout)
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ⏰ CRITICAL: Increase socket timeout to prevent premature closure
  // Default is often 10-30 seconds - we need 5+ minutes for blockchain txs
  if (req.socket) {
    req.socket.setTimeout(5 * 60 * 1000); // 5 minutes
    
  }
  if (res.socket) {
    res.socket.setTimeout(5 * 60 * 1000); // 5 minutes
  }

  // 🚀🚀🚀 DEPLOYMENT VERIFICATION v3.0.0 - OPTIONS + ESP DEBUG LOGS 🚀🚀🚀
  
  // ✅ Handle OPTIONS requests locally (don't forward to agent)
  if (req.method === 'OPTIONS') {
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    return res.status(204).end();
  }

  // 🔥 ESP GATEWAY DEBUG - What is ESP actually sending?
  
  
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Parse body manually since bodyParser is disabled
    const rawBody = await getRawBody(req);
    const bodyStr = rawBody.toString();
    
    const body = JSON.parse(bodyStr);
    
    const { walletAddress, agentSessionId, prompt, tokenId, controls, chainId } = body;

    
    if (!agentSessionId || !prompt) {
      
      return res.status(400).json({ error: 'agentSessionId and prompt required' });
    }

    // Use the actual backend streaming endpoint from environment
    const upstreamUrl = process.env.LIVE_AGENT_ASK_STREAM_URL;
    const INTERNAL_KEY = process.env.API_KEY;

    if (!upstreamUrl || !INTERNAL_KEY) {
      
      return res.status(500).json({ error: 'Server configuration error' });
    }

    
    
    // ✅ Set SSE headers BEFORE making upstream request
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ✅ CRITICAL: Flush headers immediately to establish SSE connection
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // Make request to backend streaming endpoint
    
    // Build the body exactly as specified by backend AI
    const bodyToSend = JSON.stringify({
      agentSessionId,
      prompt,
      tokenId,
      controls,
      walletAddress,
      chainId
    });

    // Filter out client's Content-Type to prevent override
    const clientHeaders = req.headers || {};
    const safeClientHeaders = Object.fromEntries(
      Object.entries(clientHeaders).filter(([k]) => k.toLowerCase() !== 'content-type')
    );

    // Build outbound headers with explicit Content-Type
    const outboundHeaders = {
      ...safeClientHeaders,
      'Content-Type': 'application/json',
      'x-api-key': INTERNAL_KEY
    };

    
    
    
    
    
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: outboundHeaders,
      body: bodyToSend
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: text || 'upstream failed'
      })}\n\n`);
      return res.end();
    }

    
    
    
    // ✅ Stream response verbatim - DO NOT BUFFER
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    // ✅ KEEPALIVE: Send heartbeat every 10s to prevent proxy/browser timeouts
    // SSE comment lines (starting with :) are ignored by clients but keep connection alive
    let lastDataTime = Date.now();
    const HEARTBEAT_INTERVAL = 10000; // 10 seconds
    
    const heartbeatInterval = setInterval(() => {
      const silenceMs = Date.now() - lastDataTime;
      if (silenceMs > HEARTBEAT_INTERVAL - 1000) {
        // Send SSE comment as heartbeat (clients ignore lines starting with :)
        res.write(': heartbeat\n\n');
        
      }
    }, HEARTBEAT_INTERVAL);

    try {
      let chunkCount = 0;
      let lastEventType = 'none';
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        chunkCount++;
        lastDataTime = Date.now(); // Reset heartbeat timer on each chunk

        // Write chunk directly without buffering
        res.write(chunk);

        // Track event types for debugging
        const eventMatch = chunk.match(/data: ({.*?})\n/);
        if (eventMatch) {
          try {
            const event = JSON.parse(eventMatch[1]);
            lastEventType = event.type;
            if (chunkCount <= 10 || event.type === 'generated_image' || event.type === 'done' || event.type === 'ask') {
              
            }
          } catch {}
        }
      }
    } catch (streamError) {
      
    } finally {
      clearInterval(heartbeatInterval); // ✅ Clean up heartbeat
      res.end();
      
    }
  } catch (error) {
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Stream initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } else {
      res.end();
    }
  }
}
