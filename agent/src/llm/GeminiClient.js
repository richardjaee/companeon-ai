/**
 * GeminiClient.js - LLM client with native function/tool calling
 * 
 * Uses AI Platform API (aiplatform.googleapis.com) with API key
 * This is the same approach the old ExpressModel used
 */

import axios from 'axios';

export class GeminiClient {
  constructor({ apiKey, models, logger }) {
    this.logger = logger;
    this.apiKey = apiKey;
    this.models = models;
    this.currentModelIndex = 0;
    // Use Google AI API (supports thinking) instead of Vertex AI (doesn't)
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  get name() {
    return `gemini:${this.models[this.currentModelIndex] || this.models[0]}`;
  }

  /**
   * Convert our tool schemas to Gemini's function declaration format
   */
  _convertToolsToFunctionDeclarations(tools) {
    if (!tools || !tools.length) return undefined;

    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters?.properties || {},
        required: tool.parameters?.required || []
      }
    }));
  }

  /**
   * Build request body for Gemini API
   */
  _buildRequestBody(messages, tools) {
    const contents = [];
    let systemText = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText = msg.content;
        continue;
      }

      if (msg.role === 'user') {
        // If there's a system prompt, prepend it to the first user message
        const text = contents.length === 0 && systemText
          ? systemText + '\n\n' + msg.content
          : msg.content;
        contents.push({
          role: 'user',
          parts: [{ text }]
        });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          contents.push({
            role: 'model',
            parts: msg.tool_calls.map(tc => ({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
              }
            }))
          });
        } else if (msg.content) {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      } else if (msg.role === 'tool') {
        const toolName = msg.tool_call_id?.split('_')[0] || 'unknown';
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: toolName,
              response: JSON.parse(msg.content)
            }
          }]
        });
      }
    }

    const body = {
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        thinkingConfig: {
          thinkingBudget: 1024, // Token budget for thinking
          includeThoughts: true // Return thought summaries
        }
      }
    };

    // Add tools if provided
    const functionDeclarations = this._convertToolsToFunctionDeclarations(tools);
    if (functionDeclarations && functionDeclarations.length > 0) {
      body.tools = [{ functionDeclarations }];
    }

    return body;
  }

  /**
   * Chat with the model, optionally with tools (non-streaming)
   * @param {Object} params
   * @param {Array} params.messages - Conversation messages
   * @param {Array} params.tools - Tool schemas
   * @param {string} params.toolChoice - 'auto' | 'none' | 'required'
   */
  async chat({ messages, tools, toolChoice = 'auto' }) {
    const body = this._buildRequestBody(messages, tools);

    // Try each model until one works
    let lastError = null;
    for (let i = 0; i < this.models.length; i++) {
      this.currentModelIndex = i;
      const modelName = this.models[i];

      const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      try {
        const response = await axios.post(url, body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        });

        const candidate = response.data?.candidates?.[0];
        if (!candidate) {
          throw new Error('No response candidate from Gemini');
        }

        const parts = candidate.content?.parts || [];
        const functionCalls = parts.filter(p => p.functionCall);
        // Separate thinking parts (thought: true) from regular text
        const thoughtParts = parts.filter(p => p.text && p.thought === true);
        const textParts = parts.filter(p => p.text && p.thought !== true);
        const thinking = thoughtParts.map(p => p.text).join('').trim();
        const content = textParts.map(p => p.text).join('').trim();

        if (functionCalls.length > 0) {
          return {
            thinking: thinking || null,
            content: content || null,
            toolCalls: functionCalls.map((fc, idx) => ({
              id: `${fc.functionCall.name}_${idx}_${Date.now()}`,
              name: fc.functionCall.name,
              args: fc.functionCall.args || {}
            }))
          };
        }

        return {
          thinking: thinking || null,
          content: content || null,
          toolCalls: []
        };

      } catch (error) {
        const errMsg = error.response?.data?.error?.message || error.message;
        this.logger?.warn?.('gemini_model_error', {
          model: modelName,
          error: errMsg,
          status: error.response?.status
        });
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All Gemini models failed');
  }

  /**
   * Chat with streaming support - yields text chunks as they arrive
   * @param {Object} params
   * @param {Array} params.messages - Conversation messages
   * @param {Array} params.tools - Tool schemas
   * @param {Function} params.onChunk - Callback for each text chunk
   */
  async chatStream({ messages, tools, onChunk }) {
    const body = this._buildRequestBody(messages, tools);

    // Try each model until one works
    let lastError = null;
    for (let i = 0; i < this.models.length; i++) {
      this.currentModelIndex = i;
      const modelName = this.models[i];

      // Use streamGenerateContent for streaming
      const url = `${this.baseUrl}/models/${modelName}:streamGenerateContent?key=${encodeURIComponent(this.apiKey)}&alt=sse`;

      try {
        this.logger?.info?.('gemini_stream_starting', { model: modelName });
        
        const response = await axios.post(url, body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 90000,
          responseType: 'stream'
        });

        this.logger?.info?.('gemini_stream_connected', { model: modelName });

        let fullContent = '';
        let fullThinking = '';
        let toolCalls = [];
        let chunkCount = 0;
        
        return new Promise((resolve, reject) => {
          let buffer = '';
          
          // Set timeout for no data
          const streamTimeout = setTimeout(() => {
            this.logger?.warn?.('gemini_stream_timeout', { chunkCount, contentLength: fullContent.length });
            resolve({
              thinking: fullThinking.trim() || null,
              content: fullContent.trim() || null,
              toolCalls
            });
          }, 60000);
          
          response.data.on('data', (chunk) => {
            chunkCount++;
            buffer += chunk.toString();
            
            // Parse SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(jsonStr);
                const parts = data.candidates?.[0]?.content?.parts || [];
                
                for (const part of parts) {
                  if (part.text && part.thought === true) {
                    // This is thinking/reasoning
                    fullThinking += part.text;
                    if (onChunk) {
                      this.logger?.debug?.('gemini_thinking_chunk', { textLength: part.text.length });
                      onChunk({ type: 'thinking', text: part.text });
                    }
                  } else if (part.text) {
                    // Regular content
                    fullContent += part.text;
                    if (onChunk) {
                      this.logger?.debug?.('gemini_chunk_emit', { textLength: part.text.length });
                      onChunk({ type: 'content', text: part.text });
                    }
                  }
                  if (part.functionCall) {
                    toolCalls.push({
                      id: `${part.functionCall.name}_${toolCalls.length}_${Date.now()}`,
                      name: part.functionCall.name,
                      args: part.functionCall.args || {}
                    });
                  }
                }
              } catch (parseErr) {
                // Ignore parse errors for incomplete chunks
              }
            }
          });
          
          response.data.on('end', () => {
            clearTimeout(streamTimeout);
            this.logger?.info?.('gemini_stream_complete', {
              chunkCount,
              contentLength: fullContent.length,
              thinkingLength: fullThinking.length,
              toolCallCount: toolCalls.length
            });
            resolve({
              thinking: fullThinking.trim() || null,
              content: fullContent.trim() || null,
              toolCalls
            });
          });
          
          response.data.on('error', (err) => {
            clearTimeout(streamTimeout);
            this.logger?.error?.('gemini_stream_error_event', { error: err.message });
            reject(err);
          });
        });

      } catch (error) {
        const errMsg = error.response?.data?.error?.message || error.message;
        this.logger?.warn?.('gemini_stream_error', {
          model: modelName,
          error: errMsg,
          status: error.response?.status
        });
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All Gemini models failed for streaming');
  }

  /**
   * Simple text inference without tools
   */
  async infer({ system, user, mime = 'text/plain' }) {
    for (let i = 0; i < this.models.length; i++) {
      const modelName = this.models[i];
      const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

      try {
        const body = {
          contents: [{ role: 'user', parts: [{ text: (system ? system + '\n\n' : '') + user }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            response_mime_type: mime === 'application/json' ? 'application/json' : undefined
          }
        };

        const response = await axios.post(url, body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (error) {
        this.logger?.warn?.('gemini_infer_error', { model: modelName, error: error.message });
        continue;
      }
    }

    throw new Error('All Gemini models failed for inference');
  }
}

/**
 * Factory function to create the LLM client
 */
export function createLLMClient({ logger }) {
  // Prefer Google AI Studio key (supports thinking), fall back to Vertex AI key
  const apiKey = process.env.GOOGLE_AI_STUDIO_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_AI_STUDIO_KEY or GOOGLE_GENAI_API_KEY environment variable required');
  }

  // Models to try - Gemini 2.5 Flash is the best available on Vertex AI
  const modelCandidates = process.env.EXPRESS_MODEL
    || process.env.VERTEX_MODEL_CANDIDATES
    || 'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.5-pro';

  const models = modelCandidates.split(',').map(m => m.trim()).filter(Boolean);

  if (models.length === 0) {
    throw new Error('No Gemini models configured');
  }

  logger?.info?.('Creating LLM client', { models });

  return new GeminiClient({ apiKey, models, logger });
}
