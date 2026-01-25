/**
 * Agent.js - Core ReAct-style agent loop
 * 
 * This is the heart of the agent. It:
 * 1. Takes a user prompt
 * 2. Calls the LLM with available tools
 * 3. If LLM wants to call tools, executes them and loops back
 * 4. If LLM produces a final response, returns it
 * 
 * Features:
 * - Streaming thinking (shows LLM reasoning if available)
 * - Autonomous error recovery (LLM sees errors and tries alternatives)
 * - Tool retries with exponential backoff
 * - Smart error parsing with recovery suggestions
 */

// Note: buildSystemPrompt is passed to the agent constructor

const MAX_TOOL_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const MAX_SAME_ERROR_ATTEMPTS = 3;

/**
 * Parse error messages and provide specific recovery suggestions
 * This helps the LLM understand what went wrong and try a different approach
 */
function getErrorRecoverySuggestion(errorMessage, toolName, args) {
  const err = String(errorMessage).toLowerCase();
  
  // Delegation/permission limit errors - auto-diagnosed by Agent!
  if (err.includes('delegation') || err.includes('Enforcer:') || err.includes('transfer-amount-exceeded') ||
      err.includes('allowance-exceeded') || err.includes('delegation-expired') || 
      err.includes('DelegationError') || err.includes('ERC-7715')) {
    return {
      category: 'DELEGATION_ERROR',
      // diagnose_delegation_error is called automatically by the Agent
      suggestion: `Delegation limit or permission error. The diagnosis has been performed automatically - check the autoDiagnosis field for details. Explain the error to the user clearly: what limit was exceeded, what the current limit is, and what they can do (reduce amount, wait for reset, or grant new permissions).`,
      recoveryAction: 'diagnose_delegation',
      shouldDiagnose: true,
      errorForDiagnosis: errorMessage
    };
  }
  
  // Balance/amount errors
  if (err.includes('exceeds balance') || err.includes('insufficient')) {
    return {
      category: 'INSUFFICIENT_BALANCE',
      suggestion: `The amount is too high. Try: 1) Call get_holdings to check actual balance, 2) Use a smaller amount (try 90% of balance to leave room for fees), 3) Ask user to confirm the exact amount they want to swap.`,
      recoveryAction: 'reduce_amount'
    };
  }
  
  // Overflow errors (Solidity panic 0x11)
  if (err.includes('overflow') || err.includes('panic') || err.includes('0x11')) {
    return {
      category: 'ARITHMETIC_OVERFLOW',
      suggestion: `Arithmetic overflow in contract. Try: 1) Get a fresh quote with get_swap_quote, 2) Use a slightly smaller amount, 3) Try different slippage (e.g., 50 bps instead of 100).`,
      recoveryAction: 'fresh_quote'
    };
  }
  
  // Slippage/price errors
  if (err.includes('slippage') || err.includes('price') || err.includes('too little received')) {
    return {
      category: 'SLIPPAGE_ERROR',
      suggestion: `Price moved or slippage too tight. Try: 1) Get a fresh quote, 2) Increase slippage tolerance (try 100 or 200 bps), 3) Try a smaller amount to reduce price impact.`,
      recoveryAction: 'increase_slippage'
    };
  }
  
  // Gas/execution errors
  if (err.includes('gas') || err.includes('out of gas') || err.includes('revert')) {
    return {
      category: 'EXECUTION_ERROR',
      suggestion: `Transaction execution failed. Try: 1) Get a fresh quote to ensure current prices, 2) Check holdings are still available, 3) Try with simulate=true first to verify.`,
      recoveryAction: 'simulate_first'
    };
  }
  
  // Token not found
  if (err.includes('unknown token') || err.includes('token not found') || err.includes('invalid address')) {
    return {
      category: 'INVALID_TOKEN',
      suggestion: `Token not recognized. Try: 1) Use standard symbols (ETH, USDC, WETH), 2) If user provided an address, verify it's correct, 3) Ask user to clarify which token they mean.`,
      recoveryAction: 'clarify_token'
    };
  }
  
  // API/network errors
  if (err.includes('timeout') || err.includes('network') || err.includes('fetch') || err.includes('rate limit')) {
    return {
      category: 'NETWORK_ERROR',
      suggestion: `Network or API issue. This is temporary. Try: 1) Wait a moment and retry, 2) The tool will auto-retry for transient errors.`,
      recoveryAction: 'retry'
    };
  }
  
  // Permission/auth errors
  if (err.includes('unauthorized') || err.includes('permission') || err.includes('not allowed')) {
    return {
      category: 'PERMISSION_ERROR',
      suggestion: `Permission denied. This may require user action. Explain the error to the user and ask if they want to proceed differently.`,
      recoveryAction: 'ask_user'
    };
  }
  
  // Default fallback
  return {
    category: 'UNKNOWN',
    suggestion: `Tool failed with: "${errorMessage}". Try: 1) Use a different approach, 2) Check inputs are valid, 3) Get fresh data before retrying. If the error persists, explain to the user and ask for guidance.`,
    recoveryAction: 'general_retry'
  };
}

export class Agent {
  constructor({ llm, tools, logger, maxIterations = 10, usePrompts }) {
    this.llm = llm;
    this.tools = tools;
    this.logger = logger;
    this.maxIterations = maxIterations;
    this.usePrompts = usePrompts; // Function to build system prompts
  }

  /**
   * Run the agent loop
   * @param {Object} params
   * @param {string} params.prompt - User's message
   * @param {Object} params.context - Session context (wallet, memory, etc.)
   * @param {Function} params.onEvent - SSE event emitter
   * @returns {Promise<{response: string, toolResults: Array}>}
   */
  async run({ prompt, context = {}, onEvent }) {
    const emit = (event) => {
      if (onEvent) {
        try { onEvent(event); } catch (e) {
          this.logger?.warn?.('event_emit_failed', { error: e.message });
        }
      }
    };

    // Build conversation messages using the appropriate prompt builder
    const systemPrompt = this.usePrompts(this.tools.getSchemas(), context);
    
    // DEBUG: Log if memory highlights contain pending swaps
    this.logger?.info?.('system_prompt_built', {
      hasPendingInContext: !!(context?.memoryFacts?.pendingSwaps?.length || context?.memoryFacts?.pendingSwapIntent),
      promptIncludesPending: systemPrompt.includes('PENDING SWAP'),
      promptLength: systemPrompt.length
    });
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add chat history if present
    if (Array.isArray(context.chatHistory)) {
      for (const msg of context.chatHistory.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: prompt });

    const toolResults = [];
    let finalResponse = null;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    
    // Track error recovery attempts to prevent infinite loops
    const errorAttempts = new Map(); // Maps error category to attempt count

    let justProcessedTools = false; // Track if we just finished tool execution
    
    // Track recent tool calls to prevent redundant calls
    // Uses "toolName:argsHash" to allow same tool with DIFFERENT args (e.g., quotes on different chains)
    const recentToolCalls = []; // Array of "toolName:argsHash" strings
    const MAX_IDENTICAL_CALLS = 2; // Allow max 2 of IDENTICAL calls (same tool + same args)
    
    // Track write operations (tx tools) - block IDENTICAL calls only (same tool + same args)
    // This allows multi-swaps (UNI→ETH, USDC→ETH) but blocks duplicate calls (UNI→ETH twice)
    const executedWriteOps = new Map(); // Maps "toolName:argsHash" to true
    const WRITE_TOOLS = ['execute_swap', 'transfer_funds', 'pay_x402']; // Tools that modify state

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      emit({ type: 'thinking', iteration });
      this.logger?.info?.('agent_iteration', { iteration, messageCount: messages.length });

      try {
        let response;
        
        // Try streaming for all responses - gives real-time output
        // If tool calls appear, we'll retract and continue
        if (this.llm.chatStream) {
          this.logger?.info?.('attempting_stream_response', { iteration });

          try {
            // Stream chunks in real-time (optimistic - assume final response)
            let collectedContent = '';
            let streamStarted = false;

            response = await this.llm.chatStream({
              messages,
              tools: this.tools.getSchemas(),
              onChunk: (chunk) => {
                collectedContent += chunk;
                // Emit ask_start on first chunk
                if (!streamStarted) {
                  emit({ type: 'ask_start' });
                  streamStarted = true;
                }
                // Emit chunk immediately for real-time streaming
                emit({ type: 'ask_delta', text: chunk });
              }
            });

            // Check if this was actually the final response
            if (!response.toolCalls || response.toolCalls.length === 0) {
              // FINAL RESPONSE - emit the complete message
              finalResponse = response.content || collectedContent;
              emit({ type: 'ask', message: finalResponse });
              break;
            }

            // HAS TOOL CALLS - we streamed prematurely, tell frontend to discard
            // Emit a retract event so frontend knows this wasn't the final response
            if (streamStarted) {
              emit({ type: 'ask_retract' });
              this.logger?.info?.('retracted_premature_stream', { length: collectedContent.length });
            }

            // Also emit as thinking for context
            if (collectedContent.trim()) {
              emit({ type: 'thinking_delta', text: collectedContent.trim() });
            }

            this.logger?.info?.('stream_produced_tool_calls', { count: response.toolCalls.length });
            // Fall through to tool handling below
            
          } catch (streamErr) {
            this.logger?.warn?.('stream_fallback_to_regular', { error: streamErr.message });
            // Fall back to regular non-streaming call
            response = await this.llm.chat({
              messages,
              tools: this.tools.getSchemas(),
              toolChoice: 'auto'
            });
          }
        } else {
          // Regular non-streaming call (first iteration or streaming not available)
          response = await this.llm.chat({
            messages,
            tools: this.tools.getSchemas(),
            toolChoice: 'auto'
          });
        }
        
        justProcessedTools = false; // Reset flag

        // Reset error counter on successful LLM call
        consecutiveErrors = 0;

        // Check if model wants to call tools
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Modern agent approach: Don't emit plan_delta
          // The tool_call events are enough - frontend shows spinners for those
          // This avoids the issue of "thinking" text mixing with responses
          // (Cursor, Claude Code, etc. do it this way)
          
          // Still add any LLM content to messages for context (but don't emit)
          const contentText = response.content?.trim();
          if (contentText) {
            messages.push({ role: 'assistant', content: contentText });
          }

          for (const toolCall of response.toolCalls) {
            const { name, args, id } = toolCall;

            // Check for IDENTICAL redundant calls (same tool + same args)
            // This allows same tool with different args (e.g., get_aggregated_quote for different chains)
            const argsHash = JSON.stringify(args || {});
            const callKey = `${name}:${argsHash}`;
            const identicalCallCount = recentToolCalls.slice(-5).filter(t => t === callKey).length;
            if (identicalCallCount >= MAX_IDENTICAL_CALLS) {
              this.logger?.warn?.('skipping_identical_tool', { tool: name, args, identicalCount: identicalCallCount });
              // Skip this tool call and tell the LLM to proceed
              messages.push({
                role: 'tool',
                tool_call_id: id,
                content: JSON.stringify({
                  skipped: true,
                  reason: `Tool ${name} was already called with these exact arguments. Use the previous result and proceed.`
                })
              });
              continue;
            }
            
            // Block IDENTICAL write operations (same tool + same args)
            // This allows multi-swaps (UNI→ETH, USDC→ETH) but blocks duplicate calls
            if (WRITE_TOOLS.includes(name)) {
              // Create a hash of the args to identify identical calls
              const argsHash = JSON.stringify(args || {});
              const opKey = `${name}:${argsHash}`;
              
              if (executedWriteOps.has(opKey)) {
                this.logger?.warn?.('blocking_duplicate_write_op', { tool: name, args, alreadyExecuted: true });
                
                // Generate specific guidance based on which tool was duplicated
                let nextStepGuidance;
                if (name === 'pay_x402') {
                  const serviceId = args?.serviceId || 'perplexity-search';
                  const nextToolMap = {
                    'perplexity-search': 'web_research',
                    'image-generation': 'generate_image',
                    'onchain-analytics': 'onchain_analytics'
                  };
                  const nextTool = nextToolMap[serviceId] || 'web_research';
                  nextStepGuidance = `Payment was already completed successfully. DO NOT pay again. Call ${nextTool} now to fulfill the user's request.`;
                } else if (name === 'transfer_funds') {
                  nextStepGuidance = 'Transfer was already completed successfully. Tell the user the transfer is done.';
                } else if (name === 'execute_swap') {
                  nextStepGuidance = 'Swap was already completed successfully. Tell the user the swap is done.';
                } else {
                  nextStepGuidance = 'This operation was already completed. Proceed with the next step.';
                }
                
                // Must add both assistant tool_calls AND tool response for proper format
                messages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
                });
                messages.push({
                  role: 'tool',
                  tool_call_id: id,
                  content: JSON.stringify({ 
                    BLOCKED: true,
                    alreadyExecuted: true,
                    message: `⛔ DUPLICATE BLOCKED: ${name} was already executed with these exact parameters this turn.`,
                    nextStep: nextStepGuidance
                  })
                });
                
                // Emit tool_error so frontend knows
                emit({ type: 'tool_error', tool: name, error: 'Duplicate call blocked' });
                continue;
              }
              
              // Mark this operation as executed BEFORE running it
              // This prevents the second parallel call from passing the check
              // (The for loop iterates synchronously, so this will be set before
              // the next iteration checks for duplicates)
              executedWriteOps.set(opKey, true);
              this.logger?.info?.('write_op_registered', { tool: name, opKey });
            }
            
            recentToolCalls.push(callKey);
            
            emit({ type: 'tool_call', tool: name, input: args });
            this.logger?.info?.('tool_call', { tool: name, args });

            // Execute tool with retry logic
            const { result, error, retriesUsed } = await this._executeToolWithRetry(
              name, args, context, emit
            );

            if (error) {
              // Tool failed after retries - analyze error and provide smart recovery guidance
              const recovery = getErrorRecoverySuggestion(error, name, args);
              
              // Track recovery attempts for this error category
              const attemptCount = (errorAttempts.get(recovery.category) || 0) + 1;
              errorAttempts.set(recovery.category, attemptCount);
              
              const isMaxAttempts = attemptCount >= MAX_SAME_ERROR_ATTEMPTS;
              
              emit({ 
                type: 'tool_error', 
                tool: name, 
                error, 
                retriesUsed,
                recovery: {
                  category: recovery.category,
                  attempt: attemptCount,
                  maxAttempts: MAX_SAME_ERROR_ATTEMPTS,
                  willRetry: !isMaxAttempts
                }
              });
              
              this.logger?.warn?.('tool_error', { 
                tool: name, 
                error, 
                retriesUsed, 
                recoveryCategory: recovery.category,
                recoveryAttempt: attemptCount 
              });
              
              toolResults.push({ tool: name, ok: false, error, recovery: recovery.category });

              // For delegation errors, AUTOMATICALLY call diagnose_delegation_error
              // Don't wait for LLM to figure it out - just do it
              if (recovery.category === 'DELEGATION_ERROR' && this.tools.has('diagnose_delegation_error')) {
                this.logger?.info?.('auto_diagnosing_delegation_error', { tool: name, error });
                
                try {
                  // Generate a unique ID for the auto-diagnosis call
                  const diagnosisId = `auto_diagnosis_${Date.now()}`;
                  const diagnosisArgs = {
                    errorMessage: error,
                    walletAddress: context?.walletAddress
                  };
                  
                  // Emit tool_call BEFORE executing so frontend can render it
                  emit({ 
                    type: 'tool_call', 
                    tool: 'diagnose_delegation_error', 
                    args: diagnosisArgs,
                    id: diagnosisId
                  });
                  
                  const diagnosisResult = await this.tools.execute('diagnose_delegation_error', diagnosisArgs, { ...context, emit });
                  
                  // Add the ORIGINAL tool call and its error response
                  // Only add 1 tool_call because the LLM only made 1 call
                  // The diagnosis is added as context in the tool response, not as a separate tool call
                  messages.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      { id, type: 'function', function: { name, arguments: JSON.stringify(args) } }
                    ]
                  });
                  messages.push({
                    role: 'tool',
                    tool_call_id: id,
                    content: JSON.stringify({ 
                      error, 
                      autoRecovered: false,
                      // Include diagnosis in the tool response so LLM can explain it
                      autoDiagnosis: diagnosisResult,
                      // Tell LLM not to call diagnose_delegation_error again!
                      instructions: 'DIAGNOSIS ALREADY DONE - Do NOT call diagnose_delegation_error again. The autoDiagnosis field above contains the full analysis. Simply explain the diagnosis results to the user in natural language.'
                    })
                  });
                  
                  // Emit tool_result so frontend can show the diagnosis output
                  emit({ type: 'tool_result', tool: 'diagnose_delegation_error', output: diagnosisResult, id: diagnosisId });
                  
                  // Continue the loop to let LLM explain the diagnosis
                  continue;
                } catch (diagnosisError) {
                  this.logger?.error?.('auto_diagnosis_failed', { error: diagnosisError.message });
                  // Fall through to normal error handling
                }
              }

              messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
              });
              
              // Build recovery guidance for the LLM
              let recoveryMessage;
              if (isMaxAttempts) {
                recoveryMessage = `Error: ${error}\n\nYou've tried ${attemptCount} times to recover from this ${recovery.category} error. Stop retrying and explain the issue to the user. Ask if they want to try a completely different approach or provide different inputs.`;
              } else {
                recoveryMessage = `Error: ${error}\n\nError type: ${recovery.category}\nRecovery attempt: ${attemptCount}/${MAX_SAME_ERROR_ATTEMPTS}\n\n${recovery.suggestion}\n\nIMPORTANT: Do NOT give up. Try the suggested recovery approach. You have ${MAX_SAME_ERROR_ATTEMPTS - attemptCount} more attempts before escalating to the user.`;
              }
              
              messages.push({
                role: 'tool',
                tool_call_id: id,
                content: JSON.stringify({ 
                  error,
                  errorCategory: recovery.category,
                  recoveryAttempt: attemptCount,
                  maxAttempts: MAX_SAME_ERROR_ATTEMPTS,
                  recoveryGuidance: recoveryMessage
                })
              });
              
              // Emit recovery event for frontend
              if (!isMaxAttempts) {
                emit({ type: 'recovery_attempt', category: recovery.category, attempt: attemptCount });
              }
            } else {
              // Tool succeeded - reset error tracking since we made progress
              errorAttempts.clear();
              
              emit({ type: 'tool_result', tool: name, output: result });
              this.logger?.info?.('tool_result', { tool: name, success: true });
              
              toolResults.push({ tool: name, ok: true, output: result });

              // Auto-save important tool results to memory for follow-up context (async for Firestore)
              await this._saveToolResultToMemory(name, result, args, context);
              
              // Write operations are now marked BEFORE execution (see above)
              // to prevent parallel duplicate calls from both passing the check

              // Emit tx_message for any tool that produces an on-chain transaction
              if (result?.txHash) {
                emit({ 
                  type: 'tx_message', 
                  txHash: result.txHash,
                  blockNumber: result.blockNumber,
                  message: this._buildTxMessage(name, result, args)
                });
              }

              messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }]
              });
              messages.push({
                role: 'tool',
                tool_call_id: id,
                content: JSON.stringify(result)
              });
            }
          }
          
          // Mark that we just processed tools - next iteration should try streaming
          justProcessedTools = true;
          
          // Continue the loop to let LLM process tool results
          continue;
        }

        // Model produced a final text response (when we didn't use streaming)
        if (response.content) {
          finalResponse = response.content;
          
          // Stream the response word by word for UX
          emit({ type: 'ask_start' });
          
          // Split by whitespace but keep the whitespace for proper formatting
          const chunks = finalResponse.split(/(\s+)/);
          for (const chunk of chunks) {
            if (chunk) {
              emit({ type: 'ask_delta', text: chunk });
              // Small delay between chunks for visual effect (optional)
              // await new Promise(r => setTimeout(r, 10));
            }
          }
          
          emit({ type: 'ask', message: finalResponse });
          break;
        }

        // No tool calls and no content - ask model to respond
        this.logger?.warn?.('empty_response', { iteration });
        messages.push({
          role: 'user',
          content: 'Please provide a response to the user based on the information gathered.'
        });

      } catch (llmError) {
        consecutiveErrors++;
        this.logger?.error?.('llm_error', { 
          iteration, 
          error: llmError.message,
          consecutiveErrors 
        });
        
        // Emit error but try to recover
        emit({ type: 'error', message: `LLM error: ${llmError.message}` });

        // If too many consecutive errors, bail out
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          this.logger?.error?.('max_consecutive_errors', { consecutiveErrors });
          finalResponse = "I'm having trouble processing that request. Could you try again in a moment?";
          emit({ type: 'ask_start' });
          emit({ type: 'ask', message: finalResponse });
          break;
        }

        // Try to recover by simplifying the request
        messages.push({
          role: 'user',
          content: 'There was an error. Please try a simpler approach or provide a direct response based on what you know.'
        });
        
        // Short delay before retry
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    // If we hit max iterations without a response
    if (!finalResponse) {
      finalResponse = "I've gathered some information but need more details to help you. What would you like to know?";
      emit({ type: 'ask_start' });
      emit({ type: 'ask', message: finalResponse });
    }

    emit({ type: 'done', result: { plan: 'completed', toolResults } });

    return {
      response: finalResponse,
      toolResults,
      messages
    };
  }

  /**
   * Save important tool results to session memory for follow-up context
   * This enables the LLM to remember swap quotes, holdings, etc.
   * Now async to support Firestore persistence
   */
  async _saveToolResultToMemory(toolName, result, args, context) {
    const remember = context?.remember;
    if (!remember || typeof remember !== 'function') return;

    try {
      // Save swap quote as pending intent
      // Track MULTIPLE pending swaps (for "swap all holdings to ETH" scenarios)
      if (toolName === 'get_swap_quote' && result && !result.error) {
        const newSwap = {
          fromToken: result.fromToken,
          toToken: result.toToken,
          amountIn: result.amountIn,
          amountInWei: result.amountInWei,
          amountOut: result.amountOut,
          minOut: result.minOut,
          minOutWei: result.minOutWei,
          slippageBps: result.slippageBps,
          feeTier: result.poolFeeTier,
          timestamp: Date.now()
        };
        
        // Get existing pending swaps or initialize array
        const existingSwaps = context?.memoryFacts?.pendingSwaps || [];
        
        // Check if this is a fresh set of quotes (new turn) or adding to existing
        // If the last swap was more than 30 seconds ago, start fresh
        const lastSwapTime = existingSwaps[existingSwaps.length - 1]?.timestamp || 0;
        const isNewBatch = Date.now() - lastSwapTime > 30000;
        
        if (isNewBatch) {
          await remember('pendingSwaps', [newSwap]);
        } else {
          await remember('pendingSwaps', [...existingSwaps, newSwap]);
        }
        
        // Also keep single pendingSwapIntent for backwards compatibility
        await remember('pendingSwapIntent', newSwap);
        
        this.logger?.info?.('saved_pending_swap', { 
          fromToken: result.fromToken, 
          toToken: result.toToken,
          totalPending: isNewBatch ? 1 : existingSwaps.length + 1
        });
      }

      // Save holdings snapshot
      if (toolName === 'get_holdings' && result?.holdings) {
        await remember('lastHoldings', result.holdings);
      }

      // Save price lookup
      if (toolName === 'get_prices' && result?.prices) {
        await remember('lastPriceLookup', {
          symbols: Object.keys(result.prices),
          convert: result.convert,
          timestamp: Date.now()
        });
      }

      // Save market sentiment
      if (toolName === 'get_market_sentiment' && result?.value != null) {
        await remember('lastMarketSentiment', {
          value: result.value,
          classification: result.classification,
          timestamp: Date.now()
        });
      }

      // Clear pending swaps after execution (remove the executed one)
      if (toolName === 'execute_swap' && result?.success) {
        const existingSwaps = context?.memoryFacts?.pendingSwaps || [];
        // Remove the executed swap from pending list
        const remainingSwaps = existingSwaps.filter(s => 
          s.fromToken !== result.fromToken || s.amountIn !== result.amountIn
        );
        await remember('pendingSwaps', remainingSwaps.length > 0 ? remainingSwaps : null);
        await remember('pendingSwapIntent', remainingSwaps[0] || null);
        
        await remember('lastExecutedSwap', {
          txHash: result.txHash,
          fromToken: result.fromToken,
          toToken: result.toToken,
          amountIn: result.amountIn,
          timestamp: Date.now()
        });
        
        // Check if this swap was for x402 (swapped to USDC to pay for research)
        // The x402PendingQuery flag tells us user wanted research but needed USDC first
        if (result.toToken === 'USDC' && context?.memoryFacts?.x402PendingQuery) {
          this.logger?.info?.('x402_swap_complete', { 
            query: context.memoryFacts.x402PendingQuery,
            note: 'User swapped to USDC for x402, should auto-proceed with research'
          });
          // Keep the x402PendingQuery so LLM knows to call web_research next
        }
      }

      // Track x402 payment results
      if (toolName === 'pay_x402' && result && result.success) {
        await remember('x402Payment', {
          status: 'PAID',
          txHash: result.txHash,
          service: result.service,
          cost: result.cost,
          timestamp: Date.now()
        });
        this.logger?.info?.('x402_payment_remembered', { txHash: result.txHash });
      }
      
      // Track successful x402 payment
      if (toolName === 'pay_x402' && result?.success) {
        await remember('x402PaymentComplete', {
          txHash: result.txHash,
          service: result.service,
          timestamp: Date.now()
        });
      }

      // Save pending transfer when simulating (for follow-up modifications)
      if (toolName === 'transfer_funds' && result?.simulation === true) {
        const pendingTransfer = {
          recipient: result.recipient,
          token: result.token,
          tokenAddress: result.tokenAddress,
          amount: result.amount,
          amountWei: result.amountWei,
          chain: result.chain,
          gasTier: result.gas?.tier || 'standard',
          gasCostEth: result.gas?.costEth,
          gasCostUsd: result.gas?.costUsd,
          timestamp: Date.now()
        };
        await remember('pendingTransfer', pendingTransfer);
        this.logger?.info?.('saved_pending_transfer', { 
          recipient: result.recipient?.slice(0, 10),
          token: result.token,
          amount: result.amount
        });
      }

      // Clear pending transfer after successful execution
      if (toolName === 'transfer_funds' && result?.success === true) {
        await remember('pendingTransfer', null);
        await remember('lastExecutedTransfer', {
          txHash: result.txHash,
          recipient: result.recipient,
          token: result.token,
          amount: result.amount,
          timestamp: Date.now()
        });
      }

      // Track payout for x402 - save block number to force fresh balance read
      if (toolName === 'transfer_funds' && result?.success && result?.token === 'USDC') {
        await remember('lastPayoutBlock', result.blockNumber);
        this.logger?.info?.('x402_funding_remembered', { 
          recipient: result.recipient, 
          amount: result.amount,
          blockNumber: result.blockNumber
        });
      }
      
      // Save recipient security check result for follow-ups
      if (toolName === 'check_recipient' && result && !result.error) {
        await remember('lastRecipientCheck', {
          recipient: result.recipient,
          riskLevel: result.riskLevel,
          previouslyInteracted: result.checks?.previousInteractions !== 'No - first time sending to this address',
          timestamp: Date.now()
        });
      }

      // Clear x402 pending query after successful research
      if (toolName === 'web_research' && result?.answer) {
        await remember('x402PendingQuery', null);
        await remember('lastResearch', {
          query: args.query,
          timestamp: Date.now()
        });
      }

    } catch (e) {
      this.logger?.warn?.('memory_save_failed', { tool: toolName, error: e.message });
    }
  }

  /**
   * Build a message for on-chain transaction confirmations
   * Generic - works for any tool that produces a txHash
   */
  _buildTxMessage(toolName, result, args) {
    // Try to build a descriptive message based on available data
    const amount = result.amount || result.amountIn || args.amount;
    const token = result.token || result.fromToken || args.token || args.tokenSymbol;
    const toToken = result.toToken;
    const recipient = result.recipient;
    
    // Build message based on what data is available
    if (toolName === 'execute_swap' && amount && token && toToken) {
      const amountOut = result.amountOut ? ` for ${result.amountOut} ${toToken}` : ` to ${toToken}`;
      return `Swapped ${amount} ${token}${amountOut}`;
    }
    
    if (toolName === 'transfer_funds' && amount && token) {
      const to = recipient ? ` to ${recipient.slice(0, 6)}...${recipient.slice(-4)}` : '';
      return `Sent ${amount} ${token}${to}`;
    }
    
    if (toolName === 'web_research' && result.x402Protocol) {
      return `x402 payment: ${result.x402Protocol.cost || '0.01 USDC'}`;
    }
    
    // Generic fallback for any other transaction
    if (amount && token) {
      return `${toolName}: ${amount} ${token}`;
    }
    
    return `Transaction completed`;
  }

  /**
   * Execute a tool with retry logic for transient errors
   */
  async _executeToolWithRetry(name, args, context, emit) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
      try {
        // Pass emit function to tool via context for streaming progress
        const contextWithEmit = { ...context, emit };
        const result = await this.tools.execute(name, args, contextWithEmit);
        return { result, error: null, retriesUsed: attempt };
      } catch (err) {
        lastError = err?.message || String(err);
        
        // Check if this is a transient error worth retrying
        const isTransient = this._isTransientError(lastError);
        
        if (isTransient && attempt < MAX_TOOL_RETRIES) {
          this.logger?.info?.('tool_retry', { tool: name, attempt: attempt + 1, error: lastError });
          emit({ type: 'tool_retry', tool: name, attempt: attempt + 1 });
          
          // Exponential backoff
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * Math.pow(2, attempt)));
          continue;
        }
        
        // Non-transient error or max retries reached
        break;
      }
    }
    
    return { result: null, error: lastError, retriesUsed: MAX_TOOL_RETRIES };
  }

  /**
   * Check if an error is transient and worth retrying
   */
  _isTransientError(errorMsg) {
    const transientPatterns = [
      /timeout/i,
      /ETIMEDOUT/i,
      /ECONNRESET/i,
      /ECONNREFUSED/i,
      /rate limit/i,
      /429/,
      /503/,
      /502/,
      /504/,
      /network/i,
      /temporary/i
    ];
    
    return transientPatterns.some(pattern => pattern.test(errorMsg));
  }
}
