'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { PaperAirplaneIcon, XMarkIcon, Cog6ToothIcon, ClockIcon, PlusIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import AgentSettingsModal, { AgentControls } from './AgentSettingsModal';
import { grantERC7715Permissions, registerWalletAgent, type PermissionProposal } from '@/lib/smartAccount/grantPermissions';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import { useChain } from '@/hooks/useChain';
import { TOKEN_CONTRACTS } from '@/lib/constants/tokens';
import Image from 'next/image';
// Removed execution step components
import { companeonApi } from '@/lib/api/companeon';
import { apiClient } from '@/lib/api/apiClient';

interface ChatMessage {
  id: string; // Unique identifier for React keys
  type: 'user' | 'assistant' | 'system' | 'error' | 'transaction' | 'thinking' | 'tool_call' | 'action' | 'follow_up_suggestions' | 'risk_warning' | 'assistant_stream' | 'todo_list' | 'todo_update';
  message: string;
  timestamp: string;
  isStreaming?: boolean;
  citations?: string[];
  risk_level?: 'safe' | 'low' | 'medium' | 'high' | 'dangerous';
  risk_indicator?: string;
  risk_factors?: string[];
  compliance?: boolean;
  action?: string;
  eip712?: any;
  transactionData?: any;
  requires2FA?: boolean;
  formattedParameters?: Record<string, any>;
  summary?: {
    from_token?: string;
    to_token?: string;
    amount: number;
    estimated_output?: number;
    slippage?: string;
    recipient?: string;
    token?: string;
  // removed legacy id
  };
  params?: {
    operationType: number;
    tokenIn?: string;
    tokenOut?: string;
    amount?: string;
    minAmountOut?: string;
    fee?: number;
    swapRecipient?: string;
    tokenAddress?: string;
    recipient?: string;
  };
  thought?: string;
  tool?: string;
  status?: 'started' | 'completed';
  details?: any;
  suggestions?: any[];
  thinking?: {
    messages: string[];
    isExpanded: boolean;
    isActive: boolean;
    txHashes?: Record<number, string>; // Map tool index to txHash
    thinkingText?: string; // Accumulated thinking_delta text
    toolStates?: Record<string, { status: 'running' | 'completed' | 'error', progress?: string[], thinkingBefore?: string }>; // Track tool states and progress
  };
  simplified_view?: {
    total_value: string;
    number_of_assets: number;
    biggest_holding: { symbol: string; percentage: number };
    simple_breakdown: string[];
  };
  advanced_metrics?: {
    sharpe_ratio: number;
    correlation_matrix: Record<string, number>;
    var_95: number;
    concentration_risk: number;
  };
  personalized_recommendations?: string[];
  txHash?: string; // Transaction hash for completed transactions (legacy - use txHashes for multiple)
  txHashes?: string[]; // Multiple transaction hashes (for multiple transactions in one response)
  imageData?: {
    dataUrl: string;
    prompt: string;
    style?: string;
    service?: string;
    model?: string;
    generatedAt?: string;
  };
  requiresConfirmation?: boolean; // Whether this message requires user confirmation (backend-controlled)
  confirmationQuestion?: string; // Optional specific question to show
}

// Component for thinking content with auto-scroll
function ThinkingContent({
  toolEntries,
  thinkingText,
  isActive
}: {
  toolEntries: [string, { status: 'running' | 'completed' | 'error', progress?: string[], thinkingBefore?: string }][];
  thinkingText?: string;
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // MutationObserver watches actual DOM changes - more reliable than React state deps
  useEffect(() => {
    if (!containerRef.current || !isActive) return;

    const container = containerRef.current;
    let lastScrollHeight = container.scrollHeight;

    const scrollToBottom = () => {
      // Only scroll if content actually grew (prevents bouncing on minor changes)
      if (container.scrollHeight > lastScrollHeight) {
        container.scrollTop = container.scrollHeight;
        lastScrollHeight = container.scrollHeight;
      }
    };

    // Initial scroll
    container.scrollTop = container.scrollHeight;
    lastScrollHeight = container.scrollHeight;

    // Watch for any DOM changes inside the container
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="mt-1 ml-2 space-y-2 max-w-[80%] max-h-[300px] overflow-y-auto pr-2 thinking-scroll-container"
    >
      {toolEntries.map(([toolKey, toolState]) => {
        const isRunning = toolState.status === 'running';
        const isCompleted = toolState.status === 'completed';
        const isError = toolState.status === 'error';
        const hasProgress = toolState.progress && toolState.progress.length > 0;
        const toolName = toolKey.replace(/_\d+$/, '');

        return (
          <div key={toolKey} className="space-y-1">
            {toolState.thinkingBefore && (
              <div className="text-xs text-gray-500 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    p: ({children}) => <p className="mb-2">{children}</p>,
                    strong: ({children}) => <strong className="font-semibold text-gray-700 block mb-0.5">{children}</strong>,
                  }}
                >
                  {toolState.thinkingBefore}
                </ReactMarkdown>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-500">
              {isCompleted ? (
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              ) : isError ? (
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
              ) : isRunning ? (
                <svg className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <div className="w-4 h-4 flex-shrink-0"></div>
              )}
              <span className="font-medium">{toolName}</span>
            </div>

            {hasProgress && (
              <div className="ml-6 space-y-0.5">
                {toolState.progress!.map((progressMsg, progressIdx) => (
                  <div key={progressIdx} className="text-xs text-gray-400 italic">
                    {progressMsg}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {thinkingText && (
        <div className="text-xs text-gray-500 leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              p: ({children}) => <p className="mb-2">{children}</p>,
              strong: ({children}) => <strong className="font-semibold text-gray-700 block mb-0.5">{children}</strong>,
            }}
          >
            {thinkingText}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

interface CompaneonChatInterfaceProps {
  contextData: {
    // no NFT/contract context needed
    totalValue: string;
    assets: Array<{
      symbol: string;
      name: string;
      amount: number;
      value: number;
      tokenAddress: string;
    }>;
    userAddress?: string;
  };
  onBack: () => void;
  persistedMessages?: ChatMessage[];
  onStateChange?: (messages: ChatMessage[], isConnected: boolean) => void;
  autoConnect?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function CompaneonChatInterface({
  contextData,
  onBack,
  persistedMessages = [],
  onStateChange,
  autoConnect = false,
  isExpanded = false,
  onToggleExpand
}: CompaneonChatInterfaceProps) {
  const { ethereum, address, isConnected: walletConnected, signMessage } = useWallet();
  const { config } = useChain();
  const [messages, setMessages] = useState<ChatMessage[]>(persistedMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [agentControls, setAgentControls] = useState<AgentControls>({
    autoTxMode: 'ask',
    x402Mode: 'ask'
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamActiveRef = useRef(false); // Track if there's an active SSE stream
  const [isTyping, setIsTyping] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [respondedMessageIds, setRespondedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const connectionInProgressRef = useRef(false);
  const [walletBalances, setWalletBalances] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasShownConnectionError, setHasShownConnectionError] = useState(false);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [sessionAuthId, setSessionAuthId] = useState<string | null>(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [chatSessions, setChatSessions] = useState<Array<{
    startedAt: number;
    lastTimestamp: number;
    messageCount: number;
    preview: string | null;
  }>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const lastHistoryFetchRef = useRef<number>(0);

  // Generate unique message ID
  const generateMessageId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  const startNewChat = () => {
      
    if (isConnecting || isStreamActiveRef.current) {
      
      return;
    }

    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset session ID to force new session creation
    setAgentSessionId(null);
    lastHistoryFetchRef.current = 0;

    setMessages([]);
    setIsConnected(false);
    setIsConnecting(false);
    connectionInProgressRef.current = false;
    // removed status tracking
    setIsProcessing(false);
    setIsTyping(false);
    setThinkingMessages([]);
    setConnectionError(null);
    setHasShownConnectionError(false);
    setInputMessage('');
    setIsStreamActive(false);
    
    if (onStateChange) {
      onStateChange([], false);
    }
    
    setTimeout(() => {
      if (!isConnecting) {
        const connectionTimeout = setTimeout(() => {
          setIsConnecting(false);
          connectionInProgressRef.current = false;
          setConnectionError('Connection timed out. Please try again.');
        }, 60000); // 60 second overall timeout for x402 flows with multiple transactions
        
        connectToAI().catch((error) => {
          clearTimeout(connectionTimeout);
          setIsConnecting(false);
          connectionInProgressRef.current = false;
          setConnectionError('Failed to connect to AI service. Please try again.');
        }).then(() => {
          clearTimeout(connectionTimeout);
        });
      }
    }, 100);
  };

  // Fetch chat history sessions for the sidebar
  const fetchChatSessions = async () => {
    if (!address) return;

    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/proxyEndpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'CHAT_SESSIONS',
          method: 'GET',
          params: { wallet: address }
        })
      });
      const data = await response.json();
      if (data.sessions) {
        const sorted = [...data.sessions].sort((a, b) => b.startedAt - a.startedAt);
        setChatSessions(sorted);
        lastHistoryFetchRef.current = Date.now();
      }
    } catch (error) {
      console.error('Failed to fetch chat sessions:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Resume a historical chat session
  const resumeSession = async (startedAt: number) => {
    if (!address || isConnecting || isStreamActiveRef.current) return;

    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setShowHistoryPanel(false);
    setIsConnecting(true);
    setMessages([]);

    try {
      // Resume the session via API (creates new agent session with old messages)
      const response = await fetch('/api/proxyEndpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'CHAT_RESUME',
          method: 'POST',
          data: {
            walletAddress: address,
            startedAt,
            chainId: config.chainId
          }
        })
      });

      const data = await response.json();

      if (data.sessionId) {
        setAgentSessionId(data.sessionId);

        // Fetch the historical messages to display
        const historyResponse = await fetch('/api/proxyEndpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'CHAT_SESSION',
            method: 'GET',
            params: { wallet: address, startedAt }
          })
        });
        const historyData = await historyResponse.json();

        if (historyData.messages) {
            // Convert historical messages to ChatMessage format
          const historicalMessages: ChatMessage[] = historyData.messages.map((msg: any, idx: number) => ({
            id: `hist-${msg.timestamp || idx}-${idx}`,
            type: msg.role === 'user' ? 'user' : 'assistant',
            message: msg.content,
            timestamp: toISOTimestamp(msg.timestamp)
          }));

          setMessages(historicalMessages);
        }

        setIsConnected(true);
        setIsConnecting(false);
      } else {
        throw new Error('Failed to resume session');
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      setConnectionError('Failed to load chat history. Please try again.');
      setIsConnecting(false);
    }
  };

  // Safely convert a timestamp (ms, seconds, Firestore Timestamp, or undefined) to ISO string
  const toISOTimestamp = (ts: any): string => {
    if (!ts) return new Date().toISOString();
    if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
    if (typeof ts === 'number') {
      // If timestamp is less than 10 trillion, it's likely in milliseconds already
      // (10 trillion ms = year 2286, 10 billion seconds = year 2286)
      // Timestamps from Date.now() are ~1.7 trillion in 2026
      const date = new Date(ts);
      if (isNaN(date.getTime())) return new Date().toISOString();
      return date.toISOString();
    }
    if (typeof ts === 'string') return ts;
    return new Date().toISOString();
  };

  // Format timestamp for display
  const formatSessionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();

    // Compare actual calendar dates in user's timezone
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const TOKEN_ADDRESSES = {
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    PEPE: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
  };

  const fetchWalletBalances = async () => {
    if (!ethereum || !address || !walletConnected) {
      return {
        ethBalance: 0,
        usdcBalance: 0,
        wbtcBalance: 0,
        pepeBalance: 0
      };
    }

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      
      const ethBalanceWei = await provider.getBalance(address);
      const ethBalance = parseFloat(ethers.formatEther(ethBalanceWei));
      
      const erc20Abi = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ];
      
      let usdcBalance = 0;
      try {
        const usdcContract = new ethers.Contract(TOKEN_ADDRESSES.USDC, erc20Abi, provider);
        const usdcBalanceWei = await usdcContract.balanceOf(address);
        usdcBalance = parseFloat(ethers.formatUnits(usdcBalanceWei, 6));
      } catch (error) {
        }
      
      let wbtcBalance = 0;
      try {
        const wbtcContract = new ethers.Contract(TOKEN_ADDRESSES.WBTC, erc20Abi, provider);
        const wbtcBalanceWei = await wbtcContract.balanceOf(address);
        wbtcBalance = parseFloat(ethers.formatUnits(wbtcBalanceWei, 8));
      } catch (error) {
        }
      
      let pepeBalance = 0;
      try {
        const pepeContract = new ethers.Contract(TOKEN_ADDRESSES.PEPE, erc20Abi, provider);
        const pepeBalanceWei = await pepeContract.balanceOf(address);
        pepeBalance = parseFloat(ethers.formatEther(pepeBalanceWei));
      } catch (error) {
        }

      const balances = {
        ethBalance,
        usdcBalance,
        wbtcBalance,
        pepeBalance
      };

      setWalletBalances(balances);
      return balances;
      
    } catch (error) {
      return {
        ethBalance: 0,
        usdcBalance: 0,
        wbtcBalance: 0,
        pepeBalance: 0
      };
    }
  };

  const refreshAllBalances = async () => {
    if (!ws || !isConnected) return;
    
    const newWalletBalances = await fetchWalletBalances();
    
    const updatedContextData = {
      portfolioData: {
        ethBalance: contextData.assets.find(asset => asset.symbol === 'ETH')?.amount || 0,
        wbtcBalance: contextData.assets.find(asset => asset.symbol === 'WBTC')?.amount || 0,
        usdcBalance: contextData.assets.find(asset => asset.symbol === 'USDC')?.amount || 0,
        ...contextData.assets.reduce((acc, asset) => {
          if (!['ETH', 'WBTC', 'USDC'].includes(asset.symbol)) {
            acc[`${asset.symbol.toLowerCase()}Balance`] = asset.amount;
          }
          return acc;
        }, {} as Record<string, number>)
      },
      
      walletData: newWalletBalances,
      
      userAddress: contextData.userAddress || address
    };

    ws.send(JSON.stringify({
      type: 'set_context',
      ...updatedContextData
    }));

    };

  const WorkflowDisplay = ({ todos, confidence }: { 
    todos: Array<{
      id: string;
      content: string;
      status: 'pending' | 'in_progress' | 'completed';
      priority: 'high' | 'medium' | 'low';
    }>;
    confidence?: number;
  }) => {
    const getStatusIcon = (status: string) => {
      switch(status) {
        case 'completed': return '✓';
        case 'in_progress': return '•';
        case 'failed': return '✗';
        default: return '○';
      }
    };

    const getPriorityColor = (priority: string) => {
      switch(priority) {
        case 'high': return 'text-red-600';
        case 'medium': return 'text-yellow-600';
        case 'low': return 'text-green-600';
        default: return 'text-gray-600';
      }
    };

    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[80%] p-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="workflow-header mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">AI Working...</span>
            </div>
          </div>
          
          <div className="todos space-y-2">
            {todos.map(todo => (
              <div key={todo.id} className={`todo flex items-center gap-2 p-2 rounded bg-white/10 ${todo.status}`}>
                <span className="text-lg">{getStatusIcon(todo.status)}</span>
                <span className="flex-1 text-sm">{todo.content}</span>
                <span className={`text-xs px-2 py-1 rounded-full bg-white/20 ${getPriorityColor(todo.priority)}`}>
                  {todo.priority}
                </span>
              </div>
            ))}
          </div>
          
          {/* Progress indicator */}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/20 rounded-full h-2">
                <div 
                  className="bg-white rounded-full h-2 transition-all duration-500" 
                  style={{ 
                    width: `${(todos.filter(t => t.status === 'completed').length / todos.length) * 100}%` 
                  }}
                />
              </div>
              <span className="text-xs">
                {todos.filter(t => t.status === 'completed').length}/{todos.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StatusIndicator = ({ status, tool }: { status: string; tool?: string }) => {
    if (!status) return null;

    const getToolIcon = (toolName?: string) => {
      switch(toolName) {
        case 'web_search': return '🌐';
        case 'uniswap_quote': return '💱';
        case 'portfolio_analysis': return '📊';
        case 'price_fetch': return '💰';
        case 'wallet_check': return '👛';
        default: return '⚡';
      }
    };

    return (
      <div className="flex justify-start mb-4">
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
            <Image 
              src="/companeon_symbol_square.png"
              alt="Companeon AI"
              width={20}
              height={20}
              className="object-contain"
            />
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 max-w-[80%]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-blue-800 font-medium">{status}</span>
          </div>
        </div>
      </div>
    );
  };

  // Removed inline transaction execution helpers and state

  const authorizeAgentSession = async (walletAddress: string) => {
    try {
      // Step 0: Switch to correct network FIRST (like GrantPermissionsModal does)
      if (ethereum) {
        try {
          const currentChainId = await ethereum.request({ method: 'eth_chainId' });
          const currentChainNumber = parseInt(currentChainId, 16);
          const targetChainId = config.chainId;

          if (currentChainNumber !== targetChainId) {
            
            const targetChainIdHex = '0x' + targetChainId.toString(16);

            try {
              await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: targetChainIdHex }],
              });
              
            } catch (switchError: any) {
              if (switchError.code === 4001) {
                throw new Error(`Please switch to ${config.name} network to continue`);
              }
              
              // Continue anyway - signature should still work
            }
          }
        } catch (networkError: any) {
          
          // Continue anyway - signature should still work
        }
      }

      const nonceResponse = await apiClient.post<{ message: string; nonce?: string }>('GET_WALLET_NONCE_FOR_ACTION_URL', {
        walletAddress,
        action: 'create_agent_session'
      });

      const challenge = nonceResponse?.message;
      if (!challenge) {
        throw new Error('Failed to get wallet verification message');
      }

      if (!signMessage) {
        throw new Error('Wallet signature method unavailable');
      }

      // Show a message while waiting for signature
      
      try {
        const signature = await signMessage(challenge);
        if (!signature) {
          throw new Error('Signature request was cancelled. Please try connecting again.');
        }

        const verificationResponse = await apiClient.post<{ success: boolean; sessionId?: string; message?: string }>('VERIFY_WALLET_ACTION_URL', {
          walletAddress,
          action: 'create_agent_session',
          message: challenge,
          signature
        });

        if (!verificationResponse?.success || !verificationResponse.sessionId) {
          throw new Error(verificationResponse?.message || 'Wallet action verification failed');
        }

        setSessionAuthId(verificationResponse.sessionId);
        return verificationResponse.sessionId;
      } catch (signError: any) {
        // Handle user rejection specifically
        if (signError?.message?.includes('user rejected') ||
            signError?.message?.includes('User rejected') ||
            signError?.message?.includes('User denied') ||
            signError?.code === 4001) {
          throw new Error('Signature request was cancelled. Click "Open AI Assistant" to try again.');
        }
        throw signError;
      }
    } catch (error) {
      
      throw error;
    }
  };

  const createChatSession = async () => {
    try {

      const walletAddress = contextData.userAddress || address;
      const hashedTransactionId = undefined;

      if (!walletAddress) {
        throw new Error('Wallet address is required');
      }

      const walletActionSessionId = await authorizeAgentSession(walletAddress);

      // Create live agent session
      const sessionPayload = {
        endpoint: 'CREATE_AGENT_SESSION_URL',
        method: 'POST',
        data: {
          walletAddress,
          sessionId: walletActionSessionId,
          ...(hashedTransactionId ? { hashedTransactionId } : {}),
          context: 'wallet',
          controls: agentControls,
          chainId: config.chainId,
          // no tokenId in wallet-only context
        }
      };

      // Add timeout to the fetch - use AbortSignal.timeout for better browser compatibility
      const controller = new AbortController();
      let timeoutId: NodeJS.Timeout | null = null;

      // Try to use AbortSignal.timeout if available (modern browsers), fallback to setTimeout
      let timeoutSignal: AbortSignal;
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        timeoutSignal = AbortSignal.timeout(60000); // 60 second timeout for x402 flows
      } else {
        // Fallback for older browsers
        timeoutId = setTimeout(() => controller.abort(), 60000);
        timeoutSignal = controller.signal;
      }

      // Use the timeout signal
      const signalToUse = timeoutSignal;

      let sessionResponse;
      try {
        sessionResponse = await fetch('/api/proxyEndpoint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            // Keep-alive headers to prevent browser timeouts
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=60, max=1000'
          },
          body: JSON.stringify(sessionPayload),
          signal: signalToUse,
          // Prevent browser from aborting on navigation
          keepalive: true
        });
        if (timeoutId) clearTimeout(timeoutId);
      } catch (fetchError: any) {
        if (timeoutId) clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          
          throw new Error('Request timed out. The agent service may be slow or unavailable.');
        }
        
        throw fetchError;
      }


      if (!sessionResponse.ok) {
        let errorData;
        try {
          errorData = await sessionResponse.json();
        } catch (e) {
          const errorText = await sessionResponse.text();
          
          throw new Error(`Failed to create agent session: ${sessionResponse.status} - ${errorText}`);
        }
        
        throw new Error(errorData.error || `Failed to create agent session: ${sessionResponse.status}`);
      }

      const sessionData = await sessionResponse.json();

      const newAgentSessionId = sessionData.sessionId || sessionData.agentSessionId;

      if (!newAgentSessionId) {
        
        throw new Error('No session ID returned from agent session creation');
      }

      
      setAgentSessionId(newAgentSessionId);

      return { sessionId: newAgentSessionId, agentSessionId: newAgentSessionId };
    } catch (error) {
      
      throw error;
    }
  };

  const scrollToBottom = (force: boolean = false) => {
    if (force || !isUserScrolling) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10);
    }
  };

  const MessageWithCitations = ({ message, citations, className = "" }: { 
    message: string; 
    citations?: string[];
    className?: string;
  }) => {
    if (!citations || citations.length === 0) {
      return <>{message}</>;
    }

    const extractDomain = (url: string) => {
      try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
      } catch {
        return 'Source';
      }
    };

    const parts = message.split(/(\[\d+\])/g);
    
    return (
      <>
        {parts.map((part, index) => {
          const match = part.match(/\[(\d+)\]/);
          if (match) {
            const citationNum = parseInt(match[1]);
            const citationIndex = citationNum - 1;
            if (citations[citationIndex]) {
              return (
                <a
                  key={index}
                  href={citations[citationIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="citation-link inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline text-xs align-super mx-0.5"
                  title={extractDomain(citations[citationIndex])}
                >
                  [{citationNum}]
                </a>
              );
            }
            return <span key={index}>{part}</span>;
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  const checkIfUserIsAtBottom = () => {
    if (!chatContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const threshold = 150;
    return scrollTop + clientHeight >= scrollHeight - threshold;
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const isAtBottom = checkIfUserIsAtBottom();
    setIsUserScrolling(!isAtBottom);
  };

  useEffect(() => {
    const wasAtBottom = checkIfUserIsAtBottom();
    if (wasAtBottom || !isUserScrolling) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.isStreaming) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (onStateChange) {
      onStateChange(messages, isConnected);
    }
  }, [messages, isConnected, onStateChange]);

  const connectToAI = async () => {
    if (connectionInProgressRef.current || isConnected) {
      
      return;
    }

    connectionInProgressRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const sessionData = await createChatSession();
      const { sessionId, agentSessionId: sessionAgentId } = sessionData;

      if (!sessionId && !sessionAgentId) {
        throw new Error('No sessionId received from backend');
      }

      // SSE doesn't need a persistent connection like WebSocket
      // Just mark as connected once session is created
      setIsConnected(true);
      setIsConnecting(false);
      connectionInProgressRef.current = false;

      
    } catch (error: any) {
      
      setIsConnecting(false);
      connectionInProgressRef.current = false;
      setIsConnected(false);

      let errorMessage = 'Connection Lost / AI service unavailable';
      if (error.message.includes('transaction ID')) {
        errorMessage = 'This action requires a transaction ID to use the AI assistant.';
      } else if (error.message.includes('Wallet address')) {
        errorMessage = 'Please connect your wallet to use the AI assistant.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setConnectionError(errorMessage);
    }
  };

  // Deprecated WebSocket code removed - now using SSE streaming

  const sendMessage = async (messageText?: string) => {
    const message = messageText || inputMessage.trim();
    if (!message || !isConnected || !agentSessionId) {
      
      return;
    }

    
    // Debounce timeout for ask_delta UI updates (declared at function scope for cleanup)
    let updateTimeout: NodeJS.Timeout | null = null;

    
    setMessages(prev => {
      const newMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'user',
        message: message,
        timestamp: new Date().toISOString(),
        thinking: {
          messages: [] as string[], // Will be populated by tool_call events
          isExpanded: true, // Expanded by default to show thinking
          isActive: true
        }
      };
      
      return [...prev, newMessage];
    });

    setIsStreamActive(true);
    setIsTyping(true);
    lastHistoryFetchRef.current = 0;
    setTimeout(() => scrollToBottom(true), 10);

    if (!messageText) {
      setInputMessage('');
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    try {
      // Use backend's actual required payload format
      const walletAddress = contextData.userAddress || address;
      const streamPayload = {
        walletAddress,
        agentSessionId,
        prompt: message,
        // no tokenId in wallet-only context
        controls: agentControls,
        chainId: config.chainId
      };

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      isStreamActiveRef.current = true; // Mark stream as active

      // Call dedicated streaming endpoint (bodyParser: false, proper SSE)
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamPayload),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body for stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentAssistantMessage = '';
      let currentThinkingMessages: string[] = [];
      let streamingMessageContent = ''; // For accumulating ask_delta events
      let streamingThinkingContent = ''; // For accumulating plan_delta events
      let pendingThinkingText = ''; // Buffer for thinking_delta text to attach to next tool_call

      let turnComplete = false;
      let receivedAsk = false;
      let receivedAskStart = false; // Track if we've already created streaming message
      let currentTxHashes: string[] = []; // Store multiple txHashes to attach to final response
      let currentCitations: string[] = []; // Store citations from web_research to attach to final response
      let currentImageData: any = null; // Store image from generated_image to attach to final response
      let toolCallCounter = 0; // Counter to make tool call keys unique

      // Keep track of last 20 SSE events for debugging
      const eventLog: any[] = [];
      const maxEventLog = 20;

      // Timeout: if neither ask nor done arrives within 5min, close and retry
      let streamTimeout = setTimeout(() => {
        
        reader.cancel();
        abortControllerRef.current?.abort();
      }, 300000);  // 5 minutes to allow time for blockchain transactions

      // CRITICAL: Keep reading until stream closes naturally
      // DO NOT break early on model_response, tool_call, or tool_result
      // These are mid-turn events. Only done/final indicates completion.
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          clearTimeout(streamTimeout); // Clear timeout when stream closes
          isStreamActiveRef.current = false; // Mark stream as no longer active

          // Debug: Log final stream state
          
          // More lenient completion logic:
          // 1. If we received both ask and done events (ideal case)
          // 2. If we received ask but stream closed naturally (fallback)
          // 3. If we have streaming content and stream closed naturally (fallback for missing ask events)
          const hasStreamingContent = streamingMessageContent.trim().length > 0;
          const isComplete = (receivedAsk && turnComplete) || receivedAsk || hasStreamingContent;

          if (!isComplete) {
            
          } else {
            // Stream completed successfully
            
            if (hasStreamingContent && !receivedAsk) {
              // Only create message if ask event didn't already create one
              
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    // Mark thinking as inactive (keep tool list visible!)
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        isActive: false
                      }
                    };
                    // Create NEW assistant message with the assistant response
                    newMessages.push({
                      id: generateMessageId(),
                      type: 'assistant',
                      message: streamingMessageContent,
                      timestamp: new Date().toISOString()
                    });
                  }
                }
                return newMessages;
              });
            } else if (receivedAsk) {
              // Ask event already created the message, just mark thinking as inactive (keep tool list!)
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        isActive: false
                      }
                    };
                  }
                }
                return newMessages;
              });
            }
          }

          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 2);

          if (!chunk || !chunk.startsWith('data:')) continue;

          try {
            const jsonStr = chunk.slice(5).trim();
            if (jsonStr === '[DONE]') {
              continue;
            }

            const event = JSON.parse(jsonStr);

            // Log event for debugging (keep last 20)
            eventLog.push({ type: event.type, timestamp: Date.now(), event });
            if (eventLog.length > maxEventLog) {
              eventLog.shift();
            }

            // Reset timeout on ANY event (backend sends heartbeats to keep alive)
            clearTimeout(streamTimeout);
            const newTimeout = setTimeout(() => {
              
              reader.cancel();
              abortControllerRef.current?.abort();
            }, 300000); // 5 minutes to allow for blockchain transactions and long-running tools
            // Store the new timeout reference
            streamTimeout = newTimeout as any;

            // Handle different event types

            if (event.type === 'thinking') {
              // Agent is processing (per official spec)
              
              setIsTyping(true);

              // Just show "Thinking..." indicator, no text content
            } else if (event.type === 'thinking_delta') {
              // Agent's reasoning process - buffer to attach to next tool_call

              pendingThinkingText += (event.text || '');

              // Show live in the thinking area and auto-expand to show streaming
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        thinkingText: pendingThinkingText
                      }
                    };
                  }
                }
                return newMessages;
              });
            } else if (event.type === 'model_delta') {
              // Streaming JSON plan tokens (DO NOT SHOW - raw JSON)
              // Skip showing raw plan JSON to user
            } else if (event.type === 'model_stream_end') {
              // Model finished generating plan
            } else if (event.type === 'thought') {
              // One-line plan summary (optional, can show as a chip)

              if (event.text) {
                // Legacy support - show thought if provided
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                  if (lastUserMessageIndex !== -1) {
                    const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                    if (newMessages[actualIndex].thinking) {
                      newMessages[actualIndex] = {
                        ...newMessages[actualIndex],
                        thinking: {
                          messages: [event.text],
                          isExpanded: true,
                          isActive: true
                        }
                      };
                    }
                  }
                  return newMessages;
                });
              }
            } else if (event.type === 'model_prompt') {
              
            } else if (event.type === 'model_response') {
              // IMPORTANT: DO NOT CLOSE STREAM - tools and ask will follow!
              
              const textChunk = event.text || '';
              currentAssistantMessage += textChunk;

              // Skip displaying raw JSON plan
              const trimmed = currentAssistantMessage.trim();
              const looksLikeJSON = (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
                                     (trimmed.includes('"plan"') || trimmed.includes('"calls"'));

              if (looksLikeJSON) {
                
              }
            } else if (event.type === 'tool_progress') {
              // Progress updates during long-running tools

              const toolName = event.tool || 'unknown';
              const progressMessage = event.status || '';

              // Add progress message to the most recent tool with this name
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking?.toolStates) {
                    const toolStates = { ...newMessages[actualIndex].thinking!.toolStates };

                    // Find the most recent tool with this name that's still running
                    const toolKeys = Object.keys(toolStates).filter(key =>
                      key.startsWith(toolName + '_') && toolStates[key].status === 'running'
                    );

                    if (toolKeys.length > 0) {
                      // Get the highest numbered tool (most recent)
                      const mostRecentToolKey = toolKeys.sort((a, b) => {
                        const aNum = parseInt(a.split('_').pop() || '0');
                        const bNum = parseInt(b.split('_').pop() || '0');
                        return bNum - aNum;
                      })[0];

                      toolStates[mostRecentToolKey] = {
                        ...toolStates[mostRecentToolKey],
                        progress: [...(toolStates[mostRecentToolKey].progress || []), progressMessage]
                      };
                      newMessages[actualIndex] = {
                        ...newMessages[actualIndex],
                        thinking: {
                          ...newMessages[actualIndex].thinking!,
                          toolStates
                        }
                      };
                    }
                  }
                }
                return newMessages;
              });
            } else if (event.type === 'tool_call') {
              // IMPORTANT: DO NOT CLOSE STREAM - waiting for tool_result then ask!
              
              const toolName = event.tool || 'unknown';

              // Increment counter and create unique key for this tool call
              toolCallCounter++;
              const uniqueToolKey = `${toolName}_${toolCallCounter}`;

              // Initialize tool state as running, attach any buffered thinking text
              const capturedThinking = pendingThinkingText.trim();
              pendingThinkingText = ''; // Clear buffer

              const toolStates = { [uniqueToolKey]: {
                status: 'running' as const,
                progress: [] as string[],
                thinkingBefore: capturedThinking || undefined
              } };

              // Update thinking section with tool state
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    const existingToolStates = newMessages[actualIndex].thinking!.toolStates || {};
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        toolStates: { ...existingToolStates, ...toolStates },
                        thinkingText: '' // Clear live thinking text now that it's attached to tool
                      }
                    };
                  }
                }
                return newMessages;
              });
            } else if (event.type === 'tool_result') {
              
              const toolName = event.tool || 'unknown';

              // Mark tool as completed - find the most recent running tool with this name
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking?.toolStates) {
                    const toolStates = { ...newMessages[actualIndex].thinking!.toolStates };

                    // Find the most recent tool with this name that's still running
                    const toolKeys = Object.keys(toolStates).filter(key =>
                      key.startsWith(toolName + '_') && toolStates[key].status === 'running'
                    );

                    if (toolKeys.length > 0) {
                      // Get the highest numbered tool (most recent)
                      const mostRecentToolKey = toolKeys.sort((a, b) => {
                        const aNum = parseInt(a.split('_').pop() || '0');
                        const bNum = parseInt(b.split('_').pop() || '0');
                        return bNum - aNum;
                      })[0];

                      toolStates[mostRecentToolKey] = {
                        ...toolStates[mostRecentToolKey],
                        status: 'completed'
                      };
                      newMessages[actualIndex] = {
                        ...newMessages[actualIndex],
                        thinking: {
                          ...newMessages[actualIndex].thinking!,
                          toolStates
                          // Don't set isActive: false here - more tools may be coming
                        }
                      };
                    }
                  }
                }
                return newMessages;
              });

              // Store txHash to attach to final response (don't create separate message)
              if (event.output && event.output.txHash) {
                currentTxHashes.push(event.output.txHash);
                
                // Emit event to refresh holdings in the UI
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('companeon-transaction-complete', {
                    detail: { txHash: event.output.txHash }
                  }));
                }
              }

              // Handle x402 payments - refresh limits even without txHash
              if (event.tool === 'pay_x402') {
                
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('companeon-transaction-complete', {
                    detail: { tool: 'pay_x402', output: event.output }
                  }));
                }
              }

              // Handle web_research tool results - store citations to attach to final message
              if (event.tool === 'web_research' && event.output) {
                
                // Store citations to attach to the final LLM response
                if (event.output.citations && Array.isArray(event.output.citations)) {
                  currentCitations = event.output.citations;
                  
                }
              }

              // Note: generate_image now emits via 'generated_image' event to avoid LLM token overflow
            } else if (event.type === 'tool_error') {
              // Tool execution error
              
              const toolName = event.tool || 'unknown';

              // Mark tool as error - find the most recent running tool with this name
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking?.toolStates) {
                    const toolStates = { ...newMessages[actualIndex].thinking!.toolStates };

                    // Find the most recent tool with this name that's still running
                    const toolKeys = Object.keys(toolStates).filter(key =>
                      key.startsWith(toolName + '_') && toolStates[key].status === 'running'
                    );

                    if (toolKeys.length > 0) {
                      // Get the highest numbered tool (most recent)
                      const mostRecentToolKey = toolKeys.sort((a, b) => {
                        const aNum = parseInt(a.split('_').pop() || '0');
                        const bNum = parseInt(b.split('_').pop() || '0');
                        return bNum - aNum;
                      })[0];

                      toolStates[mostRecentToolKey] = {
                        ...toolStates[mostRecentToolKey],
                        status: 'error'
                      };
                      newMessages[actualIndex] = {
                        ...newMessages[actualIndex],
                        thinking: {
                          ...newMessages[actualIndex].thinking!,
                          toolStates
                          // Don't set isActive: false here - more tools may be coming
                        }
                      };
                    }
                  }
                }
                return newMessages;
              });
            } else if (event.type === 'tx_message') {
              // Transaction notification (e.g., x402 payment)
              
              // Store txHash for final message button
              currentTxHashes.push(event.txHash);
              
              // Emit event to refresh holdings in the UI
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('companeon-transaction-complete', {
                  detail: { txHash: event.txHash }
                }));
              }
            } else if (event.type === 'followup_resolved') {
              // User input was clarified/normalized
              
              // Hidden - don't show "Interpreted as" message to user
              // if (event.normalized) {
              // setMessages(prev => [...prev, {
              // type: 'system',
              // message: `Interpreted as: ${event.normalized}`,
              // timestamp: new Date().toISOString()
              // }]);
              // }
            } else if (event.type === 'ask_start') {
              // Assistant is starting to respond - just mark that we're ready
              // Don't create empty message yet - wait for first ask_delta to avoid blank flash

              // Guard: Prevent duplicate
              if (receivedAsk || receivedAskStart) {
                
                continue;
              }

              receivedAskStart = true;
              streamingMessageContent = ''; // Reset for new message
              setIsTyping(true);

              // Stop the thinking indicator
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        isActive: false
                      }
                    };
                  }
                }
                return newMessages;
              });
            } else if (event.type === 'ask_retract') {
              // Backend discovered tool calls after streaming started - discard streamed content
              streamingMessageContent = '';
              receivedAskStart = false;

              // Remove any streaming message from UI
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.type === 'assistant' && lastMsg.isStreaming) {
                  newMessages.pop();
                }
                return newMessages;
              });
            } else if (event.type === 'ask_delta') {
              // Real-time streaming: Append chunks immediately as they arrive
              const token = event.text || '';
              streamingMessageContent += token;

              // Debounce UI updates for performance (~60fps)
              if (updateTimeout) {
                clearTimeout(updateTimeout);
              }

              updateTimeout = setTimeout(() => {
                // Update streaming message (create on first chunk if doesn't exist)
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];

                  if (lastMsg && lastMsg.type === 'assistant' && lastMsg.isStreaming) {
                    // Update existing streaming message
                    newMessages[newMessages.length - 1] = {
                      ...lastMsg,
                      message: streamingMessageContent
                    };
                  } else {
                    // Create streaming message on first chunk (no blank flash!)
                    newMessages.push({
                      id: generateMessageId(),
                      type: 'assistant',
                      message: streamingMessageContent,
                      timestamp: new Date().toISOString(),
                      isStreaming: true
                    });
                  }

                  return newMessages;
                });

                // Auto-scroll to show new content
                scrollToBottom(true);
              }, 16); // ~60fps
            } else if (event.type === 'ask') {
              // Final message - clear any pending debounced updates
              if (updateTimeout) {
                clearTimeout(updateTimeout);
                updateTimeout = null;
              }

              
              
              receivedAsk = true; // Mark that we got the final response
              // IMPORTANT: Prefer streamingMessageContent if we have it (from ask_delta)
              // Only use event.message if we didn't get any streaming chunks
              const finalMessage = streamingMessageContent || event.message;

              // Check if backend is requesting confirmation (flexible field names)
              const requiresConfirmation = event.requiresConfirmation || event.requires_confirmation || event.needsConfirmation || event.needs_confirmation || false;
              const confirmationQuestion = event.confirmationQuestion || event.confirmation_question || null;

              // Capture values before async setMessages to avoid closure issues
              // Deduplicate txHashes (tool_result and tx_message both add them)
              const capturedTxHashes = [...new Set(currentTxHashes)];
              const capturedCitations = [...currentCitations];
              const capturedImageData = currentImageData ? { ...currentImageData } : null;
              const capturedRequiresConfirmation = requiresConfirmation;
              const capturedConfirmationQuestion = confirmationQuestion;

              
              // Update or create message
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];

                // Check if we already have a streaming message
                if (lastMsg && lastMsg.type === 'assistant' && lastMsg.isStreaming) {
                  // Finalize the streaming message
                  const { isStreaming, ...msgWithoutStreaming } = lastMsg;
                  const finalMsg: any = {
                    ...msgWithoutStreaming,
                    message: finalMessage
                  };

                  // Explicitly add optional properties using captured values
                  if (capturedTxHashes.length > 0) {
                    finalMsg.txHashes = capturedTxHashes;
                    // Backward compatibility: also set txHash to first one
                    if (capturedTxHashes.length === 1) finalMsg.txHash = capturedTxHashes[0];
                  }
                  if (capturedCitations.length > 0) finalMsg.citations = capturedCitations;
                  if (capturedImageData) finalMsg.imageData = capturedImageData;
                  if (capturedRequiresConfirmation) finalMsg.requiresConfirmation = true;
                  if (capturedConfirmationQuestion) finalMsg.confirmationQuestion = capturedConfirmationQuestion;

                  newMessages[newMessages.length - 1] = finalMsg;
                } else {
                  // No streaming, add complete message directly
                  const newMsg: any = {
                    id: generateMessageId(),
                    type: 'assistant',
                    message: finalMessage,
                    timestamp: new Date().toISOString()
                  };

                  // Explicitly add optional properties using captured values
                  if (capturedTxHashes.length > 0) {
                    newMsg.txHashes = capturedTxHashes;
                    // Backward compatibility: also set txHash to first one
                    if (capturedTxHashes.length === 1) newMsg.txHash = capturedTxHashes[0];
                  }
                  if (capturedCitations.length > 0) newMsg.citations = capturedCitations;
                  if (capturedImageData) newMsg.imageData = capturedImageData;
                  if (capturedRequiresConfirmation) newMsg.requiresConfirmation = true;
                  if (capturedConfirmationQuestion) newMsg.confirmationQuestion = capturedConfirmationQuestion;

                  newMessages.push(newMsg);
                }

                return newMessages;
              });

              // Stop thinking indicator if still active
              setMessages(prev => {
                const newMessages = [...prev];
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        isActive: false
                      }
                    };
                  }
                }
                return newMessages;
              });

              streamingMessageContent = ''; // Reset for next message
              pendingThinkingText = ''; // Reset thinking buffer
              currentCitations = []; // Reset citations for next message
              currentImageData = null; // Reset image data for next message
              currentTxHashes = []; // Reset txHashes for next message
              setIsTyping(false);

              
            } else if (event.type === 'error') {
              // Handle error events from the agent

              setIsTyping(false);
              setIsStreamActive(false);
            } else if (event.type === 'heartbeat') {
              // Keep-alive ping - ignore in UI
              
            } else if (event.type === 'generated_image') {
              // Image generated - store to attach to final LLM response

              currentImageData = {
                dataUrl: event.imageUrl,
                prompt: event.prompt,
                style: event.style,
                service: event.service,
                model: event.model,
                generatedAt: event.generatedAt
              };

              
            } else if (event.type === 'permission_update_request') {
              
              // Handle permission update asynchronously (no UI message - agent already explained it)
              (async () => {
                try {
                  const proposal: PermissionProposal = event.proposal;

                  if (!ethereum || !address) {
                    throw new Error('Wallet not connected');
                  }

                  // Step 1: Grant ERC-7715 permissions via MetaMask
                  const result = await grantERC7715Permissions(
                    ethereum,
                    address,
                    proposal.scopes
                  );

                  // Step 2: Register with backend (include scopes so backend can track limits)
                  await registerWalletAgent(
                    address,
                    result.smartAccountAddress,
                    result.permissionsContext,
                    result.delegationManager,
                    proposal.expirationTimestamp,
                    proposal.scopes // Must match what was sent to MetaMask
                  );

                  // Step 3: Send success message to chat
                  await sendMessage('Permissions updated successfully!');

                } catch (error: any) {
                  
                  // Send error message to chat
                  await sendMessage(`Permission update failed: ${error.message || 'Unknown error'}`);
                }
              })();
            } else if (event.type === 'done') {
              
              // Clear any pending debounced updates and flush final state
              if (updateTimeout) {
                clearTimeout(updateTimeout);
                updateTimeout = null;
              }

              turnComplete = true;

              // Mark any streaming message as complete
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.isStreaming) {
                  // Create new object without mutation
                  const { isStreaming, ...msgWithoutStreaming } = lastMsg;
                  newMessages[newMessages.length - 1] = msgWithoutStreaming;
                }

                // Stop thinking indicator
                const lastUserMessageIndex = [...newMessages].reverse().findIndex(msg => msg.type === 'user');
                if (lastUserMessageIndex !== -1) {
                  const actualIndex = newMessages.length - 1 - lastUserMessageIndex;
                  if (newMessages[actualIndex].thinking) {
                    // Create new object for thinking update
                    newMessages[actualIndex] = {
                      ...newMessages[actualIndex],
                      thinking: {
                        ...newMessages[actualIndex].thinking!,
                        isActive: false
                      }
                    };
                  }
                }

                return newMessages;
              });

              // Reset streaming state for next message
              streamingMessageContent = '';
              streamingThinkingContent = '';
              pendingThinkingText = '';
              currentAssistantMessage = '';
              // DON'T clear currentThinkingMessages - buffered events might still reference it
              setIsTyping(false);
              setIsStreamActive(false);

              
            } else if (event.type === 'final') {
              
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg && lastMsg.isStreaming) {
                  // Create new object without mutation
                  const { isStreaming, ...msgWithoutStreaming } = lastMsg;
                  newMessages[newMessages.length - 1] = msgWithoutStreaming;
                }
                return newMessages;
              });
            }

          } catch (parseError) {
            
          }
        }
      }

      setIsTyping(false);
      setIsStreamActive(false);

    } catch (error: any) {
      
      // Clean up any pending debounced updates
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      isStreamActiveRef.current = false; // Mark stream as no longer active

      if (error.name === 'AbortError') {
        
        return;
      }

      setIsTyping(false);
      setIsStreamActive(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    sendMessage(suggestionText);
  };

  const stopStream = () => {
    
    // Abort the ongoing fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    isStreamActiveRef.current = false; // Mark stream as no longer active
    setIsStreamActive(false);
    setIsProcessing(false);
    setIsTyping(false);
    // removed status tracking

    setMessages(prev => {
      const updatedMessages = [...prev];
      const lastUserMessageIndex = [...updatedMessages].reverse().findIndex(msg => msg.type === 'user');
      if (lastUserMessageIndex !== -1) {
        const actualIndex = updatedMessages.length - 1 - lastUserMessageIndex;
        if (updatedMessages[actualIndex].thinking) {
          // Create new object without mutation
          updatedMessages[actualIndex] = {
            ...updatedMessages[actualIndex],
            thinking: {
              ...updatedMessages[actualIndex].thinking!,
              isActive: false
            }
          };
        }
      }

      // Mark any streaming message as complete
      const lastMsg = updatedMessages[updatedMessages.length - 1];
      if (lastMsg && lastMsg.isStreaming) {
        // Create new object without mutation
        const { isStreaming, ...msgWithoutStreaming } = lastMsg;
        updatedMessages[updatedMessages.length - 1] = msgWithoutStreaming;
      }

      return updatedMessages;
    });

    setMessages(prev => [...prev, {
      id: generateMessageId(),
      type: 'system',
      message: '⏹️ Generation stopped by user',
      timestamp: new Date().toISOString()
    }]);
  };

  const handleTransactionExecute = (modalType: 'swap' | 'withdraw' | 'deposit', transactionData: any) => {
    // Swap, withdraw, and deposit functionality removed
    return;
  };

  // Removed execution step context and handlers

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (!autoConnect) {
      return () => {
        // Only abort if there's no active stream
        if (abortControllerRef.current && !isStreamActiveRef.current) {
          
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        } else if (isStreamActiveRef.current) {
          
        }
      };
    }

    let mounted = true;
    const connect = async () => {
      // Don't auto-retry if there's a connection error - user must manually retry
      if (mounted && !isConnecting && !isConnected && !agentSessionId && !connectionError) {
        await connectToAI();
      }
    };

    connect();

    return () => {
      mounted = false;
      // Only abort if there's no active stream
      if (abortControllerRef.current && !isStreamActiveRef.current) {
        
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      } else if (isStreamActiveRef.current) {
        
      }
    };
  }, [autoConnect, isConnecting, isConnected, agentSessionId, connectionError]);

  // Removed ExecutionStepMessage component

  return (
    <>
      {/* All messages now appear in chronological order in chat history */}
      
      <div className="bg-white rounded-[8px] p-6 w-full flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <h2 className="text-xl font-medium">AI Companeon</h2>
        <div className="flex items-center gap-2">

          {isConnected && (
            <>
              {/* History button */}
              <button
                onClick={() => {
                  setShowHistoryPanel(!showHistoryPanel);
                  if (!showHistoryPanel && lastHistoryFetchRef.current === 0) {
                    fetchChatSessions();
                  }
                }}
                className={`text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors ${showHistoryPanel ? 'bg-gray-100 text-gray-600' : ''}`}
                title="Chat history"
              >
                <ClockIcon className="h-5 w-5" />
              </button>

              {/* New chat button */}
              <button
                onClick={startNewChat}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="Start new chat"
              >
                <PlusIcon className="h-5 w-5" />
              </button>

              {/* Expand/Collapse button */}
              {onToggleExpand && (
                <button
                  onClick={onToggleExpand}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  title={isExpanded ? "Collapse chat" : "Expand chat"}
                >
                  {isExpanded ? (
                    <ArrowsPointingInIcon className="h-5 w-5" />
                  ) : (
                    <ArrowsPointingOutIcon className="h-5 w-5" />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat History Panel */}
      {showHistoryPanel && (
        <div className="absolute top-16 right-6 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Chat History</span>
            <button
              onClick={() => setShowHistoryPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-64">
            {isLoadingHistory ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Loading...
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No previous chats
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {chatSessions.map((session, idx) => (
                  <button
                    key={session.startedAt}
                    onClick={() => resumeSession(session.startedAt)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-xs text-gray-400 mb-1">
                      {formatSessionDate(session.startedAt)}
                    </div>
                    <div className="text-sm text-gray-700 truncate">
                      {session.preview || 'Chat session'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {session.messageCount} messages
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-hide"
      >
        {!isConnected && !isConnecting && messages.length === 0 && (
          <div className="text-center py-8 mx-auto w-[320px] min-w-[320px] max-w-[320px]">
            <div className="text-gray-600 mb-2">Welcome to your AI Companeon!</div>
            <div className="text-sm text-gray-500 mb-6">
              I can analyze your portfolio, find market opportunities, and provide investment insights.
            </div>
            <button
              onClick={connectToAI}
              className="px-4 py-2 text-sm bg-[#AD29FF] text-white rounded-[4px] hover:bg-[#9220E6]"
            >
              Connect to AI
            </button>
          </div>
        )}
        
        {isConnecting && (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#AD29FF]"></div>
              <div className="text-gray-600">Waiting for wallet signature...</div>
              <div className="text-sm text-gray-500">Please check your wallet to sign the request</div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={msg.id}>
            <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
              {/* Avatar for assistant messages */}
              {msg.type !== 'user' && (
                <div className="flex-shrink-0 mr-3">
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                    <Image
                      src="/companeon_symbol_square.png"
                      alt="Companeon AI"
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  </div>
                </div>
              )}
              
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.type === 'user'
                    ? 'bg-[#AD29FF] text-white'
                    : msg.type === 'error'
                    ? 'bg-red-100 text-red-800'
                    : msg.type === 'system'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : msg.type === 'transaction'
                    ? 'bg-gray-50 text-gray-800 border border-gray-200'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="text-sm">
                  {msg.type === 'user' ? (
                    <div className="whitespace-pre-wrap break-words">
                      {msg.message}
                    </div>
                  ) : msg.type === 'system' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{msg.message}</span>
                    </div>
                  ) : msg.type === 'action' ? (
                    <div>
                      <div className="font-medium">{msg.message}</div>
                      {msg.details?.steps && (
                        <div className="mt-2 text-xs">
                          <div className="font-medium mb-1">Progress:</div>
                          <ul className="list-disc list-inside space-y-0.5">
                            {msg.details.steps.map((step: string, stepIndex: number) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : msg.type === 'risk_warning' ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Risk Level: {msg.risk_level?.toUpperCase()}
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            {msg.message}
                          </div>
                          {msg.risk_factors && msg.risk_factors.length > 0 && (
                            <ul className="mt-2 list-disc list-inside text-sm text-red-600">
                              {msg.risk_factors.map((factor, i) => (
                                <li key={i}>{factor}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (msg.type === 'todo_list' || msg.type === 'todo_update') ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">Processing Steps:</h4>
                      <div className="space-y-2">
                        {msg.details && msg.details.map((todo: any) => (
                          <div key={todo.id} className="flex items-center gap-2">
                            {todo.status === 'completed' ? (
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : todo.status === 'in_progress' ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                            ) : todo.status === 'failed' ? (
                              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                            )}
                            <span className={`text-sm ${
                              todo.status === 'completed' ? 'text-green-700' :
                              todo.status === 'failed' ? 'text-red-700' :
                              todo.status === 'in_progress' ? 'text-blue-700' :
                              'text-gray-600'
                            }`}>
                              {todo.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : msg.type === 'transaction' ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <div className="font-semibold text-gray-900">{msg.message}</div>
                      </div>
                      {msg.transactionData?.txHash && (
                        <button
                          onClick={() => window.open(`https://basescan.org/tx/${msg.transactionData.txHash}`, '_blank')}
                          className="w-full h-[42px] px-6 bg-white border-2 border-[#AD29FF] text-[#AD29FF] rounded-[42px] hover:bg-gray-50 transition-colors font-bold text-sm"
                        >
                          View on Basescan
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none break-words">
                      {/* Show adaptive content if available */}
                      {msg.simplified_view && (
                        <div className="simplified-portfolio-view bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <h3 className="text-lg font-bold mb-3 text-green-800">Portfolio Summary</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="font-medium">Total Value:</span>
                              <span className="text-xl font-bold text-green-600">{msg.simplified_view.total_value}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Number of Assets:</span>
                              <span>{msg.simplified_view.number_of_assets}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Biggest Holding:</span>
                              <span>{msg.simplified_view.biggest_holding.symbol} ({msg.simplified_view.biggest_holding.percentage}%)</span>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <h4 className="font-medium mb-2">Asset Breakdown:</h4>
                            <div className="space-y-1">
                              {msg.simplified_view.simple_breakdown.map((item, idx) => (
                                <div key={idx} className="text-sm bg-white px-2 py-1 rounded">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {msg.advanced_metrics && (
                        <div className="advanced-metrics bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <h3 className="text-lg font-bold mb-3 text-blue-800">Advanced Analytics</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Sharpe Ratio:</span>
                              <span className="ml-2 text-blue-600">{msg.advanced_metrics.sharpe_ratio.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="font-medium">VaR (95%):</span>
                              <span className="ml-2 text-blue-600">${msg.advanced_metrics.var_95.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="font-medium">Concentration Risk:</span>
                              <span className="ml-2 text-blue-600">{(msg.advanced_metrics.concentration_risk * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                          
                          {Object.keys(msg.advanced_metrics.correlation_matrix).length > 0 && (
                            <div className="mt-3">
                              <h4 className="font-medium mb-2">Asset Correlations:</h4>
                              <div className="text-sm space-y-1">
                                {Object.entries(msg.advanced_metrics.correlation_matrix).map(([pair, correlation]) => (
                                  <div key={pair} className="flex justify-between bg-white px-2 py-1 rounded">
                                    <span>{pair}:</span>
                                    <span className={correlation > 0.7 ? 'text-red-600' : correlation > 0.3 ? 'text-yellow-600' : 'text-green-600'}>
                                      {correlation.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {msg.personalized_recommendations && msg.personalized_recommendations.length > 0 && (
                        <div className="recommendations bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                          <h3 className="text-lg font-bold mb-3 text-purple-800">Personalized Recommendations</h3>
                          <ul className="space-y-2">
                            {msg.personalized_recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-purple-600 mt-1">•</span>
                                <span className="text-sm">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Render message content */}
                      {msg.citations && msg.citations.length > 0 ? (
                          <div>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                                em: ({node, ...props}) => <em className="italic" {...props} />,
                                del: ({node, children, ...props}) => <>{children}</>, // Disable strikethrough (backend uses ~ for "approximately")
                                ul: ({node, children, ...props}) => <ul className="mb-2" {...props}>{children}</ul>,
                                ol: ({node, children, ...props}) => <ol className="mb-2" {...props}>{children}</ol>,
                                li: ({node, children, ...props}) => (
                                  <li className="mb-1 ml-4" {...props}>{children}</li>
                                ),
                                p: ({node, children, ...props}) => {
                                  const processedChildren = React.Children.map(children, (child) => {
                                    if (typeof child === 'string') {
                                      const parts = child.split(/(\[\d+\])/g);
                                      return parts.map((part, index) => {
                                        const match = part.match(/\[(\d+)\]/);
                                        if (match && msg.citations) {
                                          const citationNum = parseInt(match[1]);
                                          const citationIndex = citationNum - 1;
                                          if (msg.citations[citationIndex]) {
                                            return (
                                              <a
                                                key={index}
                                                href={msg.citations[citationIndex]}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="citation-link inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline text-xs align-super mx-0.5"
                                                title={(() => {
                                                  try {
                                                    return new URL(msg.citations![citationIndex]).hostname.replace('www.', '');
                                                  } catch {
                                                    return 'Source';
                                                  }
                                                })()}
                                              >
                                                [{citationNum}]
                                              </a>
                                            );
                                          }
                                        }
                                        return part;
                                      });
                                    }
                                    return child;
                                  });
                                  return <p className="mb-2 last:mb-0 whitespace-pre-line" {...props}>{processedChildren}</p>;
                                },
                                code: ({node, ...props}) => <code className="bg-gray-200 px-1 rounded text-xs" {...props} />,
                              }}
                            >
                              {(() => {
                                let processedMessage = msg.message;
                                // Remove image URLs from message if we have imageData to display
                                if (msg.imageData?.dataUrl && !msg.isStreaming) {
                                  processedMessage = processedMessage
                                    .replace(msg.imageData.dataUrl, '')
                                    .replace(/\n{3,}/g, '\n\n')
                                    .trim();
                                }
                                return processedMessage;
                              })()}
                            </ReactMarkdown>
                            {/* Optional: Show sources at the bottom */}
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-500 font-medium mb-2">Sources:</div>
                              <div className="space-y-1">
                                {msg.citations.map((url, index) => {
                                  const domain = (() => {
                                    try {
                                      return new URL(url).hostname.replace('www.', '');
                                    } catch {
                                      return 'Source';
                                    }
                                  })();
                                  return (
                                    <div key={index} className="text-xs">
                                      <span className="text-gray-400">[{index + 1}]</span>{' '}
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                      >
                                        {domain}
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                              em: ({node, ...props}) => <em className="italic" {...props} />,
                              del: ({node, children, ...props}) => <>{children}</>, // Disable strikethrough (backend uses ~ for "approximately")
                              ul: ({node, children, ...props}) => <ul className="mb-2" {...props}>{children}</ul>,
                              ol: ({node, children, ...props}) => <ol className="mb-2" {...props}>{children}</ol>,
                              li: ({node, children, ...props}) => (
                                <li className="mb-1 ml-4" {...props}>{children}</li>
                              ),
                              p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-line break-words" {...props} />,
                              code: ({node, ...props}) => <code className="bg-gray-200 px-1 rounded text-xs break-all" {...props} />,
                            }}
                          >
                            {(() => {
                              let processedMessage = msg.message;
                              // Remove image URLs from message if we have imageData to display
                              if (msg.imageData?.dataUrl && !msg.isStreaming) {
                                processedMessage = processedMessage
                                  .replace(msg.imageData.dataUrl, '')
                                  .replace(/\n{3,}/g, '\n\n')
                                  .trim();
                              }
                              return processedMessage;
                            })()}
                          </ReactMarkdown>
                        )
                      }
                      {msg.isStreaming && (
                        <span className="inline-block ml-1 w-0.5 h-4 bg-[#AD29FF] animate-pulse opacity-70"></span>
                      )}

                      {/* Confirmation question with CTA buttons - backend-controlled */}
                      {msg.type === 'assistant' && !msg.isStreaming && msg.requiresConfirmation && (() => {
                        const hasResponded = respondedMessageIds.has(msg.id);

                        // Use custom question if provided by backend, otherwise extract from message
                        let questionText = msg.confirmationQuestion;

                        if (!questionText) {
                          // Fallback: Try to extract question from message (for backward compatibility)
                          const questionPatterns = [
                            /Do you want me to proceed/i,
                            /Should I proceed/i,
                            /Would you like me to/i,
                            /Do you want to proceed/i,
                            /Shall I proceed/i,
                            /May I proceed/i
                          ];

                          const sentences = msg.message.split(/(?<=[.!?])\s+/);
                          const questionSentence = sentences.find(s =>
                            s.includes('?') && questionPatterns.some(p => p.test(s))
                          );

                          questionText = questionSentence || "Would you like to proceed?";
                        }

                        return (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="font-bold text-sm mb-3 text-gray-900">
                              {questionText}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (hasResponded) return;
                                  // Mark this message as responded
                                  setRespondedMessageIds(prev => new Set(prev).add(msg.id));
                                  // Send "no" response
                                  sendMessage("Not now, thanks");
                                }}
                                disabled={hasResponded}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                                  hasResponded
                                    ? 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                Not now
                              </button>
                              <button
                                onClick={() => {
                                  if (hasResponded) return;
                                  // Mark this message as responded
                                  setRespondedMessageIds(prev => new Set(prev).add(msg.id));
                                  // Send "yes" response
                                  sendMessage("Yes, please proceed");
                                }}
                                disabled={hasResponded}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                                  hasResponded
                                    ? 'text-gray-400 bg-gray-200 cursor-not-allowed'
                                    : 'text-white bg-[#AD29FF] hover:bg-[#9d24e6]'
                                }`}
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Generated image display with download button */}
                      {msg.type === 'assistant' && msg.imageData && (
                        <div className="mt-3 space-y-2">
                          <div className="relative">
                            <img
                              src={msg.imageData.dataUrl}
                              alt={msg.imageData.prompt}
                              className="w-full h-auto rounded-lg"
                            />
                          </div>

                          {/* Image metadata */}
                          <div className="text-xs text-gray-500 space-y-1">
                            {msg.imageData.service && (
                              <div>Service: {msg.imageData.service}</div>
                            )}
                            {msg.imageData.style && (
                              <div>Style: {msg.imageData.style}</div>
                            )}
                            {msg.imageData.model && (
                              <div>Model: {msg.imageData.model}</div>
                            )}
                          </div>

                          {/* Download button */}
                          <button
                            onClick={async () => {
                              try {
                                const imageUrl = msg.imageData!.dataUrl;

                                // If it's a data URL (base64), use direct download
                                if (imageUrl.startsWith('data:')) {
                                  const link = document.createElement('a');
                                  link.href = imageUrl;
                                  link.download = `generated-${Date.now()}.png`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                } else {
                                  // If it's an HTTP URL, fetch and download to handle CORS
                                  const response = await fetch(imageUrl);
                                  const blob = await response.blob();
                                  const blobUrl = URL.createObjectURL(blob);

                                  const link = document.createElement('a');
                                  link.href = blobUrl;
                                  link.download = `generated-${Date.now()}.png`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);

                                  // Clean up blob URL
                                  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                }
                              } catch (error) {
                                
                                alert('Failed to download image. Please try again.');
                              }
                            }}
                            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-[4px] border border-purple-400 text-purple-600 hover:bg-purple-50 transition-all text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Image
                          </button>

                          {/* Transaction buttons (support multiple txHashes) */}
                          {(() => {
                            // Get txHashes from events
                            let txHashesRaw = (msg as any).txHashes || ((msg as any).txHash ? [(msg as any).txHash] : []);

                            // ALWAYS extract from message text and merge (handles historical + new transactions)
                            const txHashPattern = /0x[a-fA-F0-9]{64}/g;
                            const matches = msg.message.match(txHashPattern);
                            if (matches) {
                              txHashesRaw = [...txHashesRaw, ...matches];
                            }

                            // Deduplicate - removes duplicates from events + text + tool_result + tx_message
                            const txHashesArray = [...new Set(txHashesRaw)];
                            if (txHashesArray.length === 0) return null;

                            const chainId = config.chainId;

                            const getExplorerInfo = (txHash: string, chainId: number) => {
                              switch (chainId) {
                                case 1: return { url: `https://etherscan.io/tx/${txHash}`, name: 'Etherscan' };
                                case 11155111: return { url: `https://sepolia.etherscan.io/tx/${txHash}`, name: 'Sepolia Etherscan' };
                                case 8453: return { url: `https://basescan.org/tx/${txHash}`, name: 'Basescan' };
                                case 84532: return { url: `https://sepolia.basescan.org/tx/${txHash}`, name: 'Base Sepolia' };
                                case 137: return { url: `https://polygonscan.com/tx/${txHash}`, name: 'Polygonscan' };
                                case 42161: return { url: `https://arbiscan.io/tx/${txHash}`, name: 'Arbiscan' };
                                case 10: return { url: `https://optimistic.etherscan.io/tx/${txHash}`, name: 'Optimism Etherscan' };
                                default: return { url: `https://etherscan.io/tx/${txHash}`, name: 'Block Explorer' };
                              }
                            };

                            return (
                              <div className="space-y-2">
                                {txHashesArray.map((txHash: string, idx: number) => {
                                  const explorer = getExplorerInfo(txHash, chainId);
                                  return (
                                    <a
                                      key={txHash}
                                      href={explorer.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-[4px] border border-purple-400 text-purple-600 hover:bg-purple-50 transition-all text-sm font-medium"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      View on {explorer.name}{txHashesArray.length > 1 ? ` (${idx + 1}/${txHashesArray.length})` : ''}
                                    </a>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Transaction buttons for non-image messages (support multiple txHashes) */}
                      {msg.type === 'assistant' && !msg.imageData && (() => {
                        // Get txHashes from events
                        let txHashesRaw = (msg as any).txHashes || ((msg as any).txHash ? [(msg as any).txHash] : []);

                        // ALWAYS extract from message text and merge (handles historical + new transactions)
                        const txHashPattern = /0x[a-fA-F0-9]{64}/g;
                        const matches = msg.message.match(txHashPattern);
                        if (matches) {
                          txHashesRaw = [...txHashesRaw, ...matches];
                        }

                        // Deduplicate - removes duplicates from events + text + tool_result + tx_message
                        const txHashesArray = [...new Set(txHashesRaw)];
                        if (txHashesArray.length === 0) return null;

                        const chainId = config.chainId;

                        const getExplorerInfo = (txHash: string, chainId: number) => {
                          switch (chainId) {
                            case 1: return { url: `https://etherscan.io/tx/${txHash}`, name: 'Etherscan' };
                            case 11155111: return { url: `https://sepolia.etherscan.io/tx/${txHash}`, name: 'Sepolia Etherscan' };
                            case 8453: return { url: `https://basescan.org/tx/${txHash}`, name: 'Basescan' };
                            case 84532: return { url: `https://sepolia.basescan.org/tx/${txHash}`, name: 'Base Sepolia' };
                            case 137: return { url: `https://polygonscan.com/tx/${txHash}`, name: 'Polygonscan' };
                            case 42161: return { url: `https://arbiscan.io/tx/${txHash}`, name: 'Arbiscan' };
                            case 10: return { url: `https://optimistic.etherscan.io/tx/${txHash}`, name: 'Optimism Etherscan' };
                            default: return { url: `https://etherscan.io/tx/${txHash}`, name: 'Block Explorer' };
                          }
                        };

                        return (
                          <div className="mt-3 space-y-2">
                            {txHashesArray.map((txHash: string, idx: number) => {
                              const explorer = getExplorerInfo(txHash, chainId);
                              return (
                                <a
                                  key={txHash}
                                  href={explorer.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-[4px] border border-purple-400 text-purple-600 hover:bg-purple-50 transition-all text-sm font-medium"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  View on {explorer.name}{txHashesArray.length > 1 ? ` (${idx + 1}/${txHashesArray.length})` : ''}
                                </a>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="text-xs mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            {/* Thinking display - collapsed shows tools only, expanded shows full thinking */}
            {msg.type === 'user' && msg.thinking && (
              <div className="mb-2 ml-12">
                {(() => {
                  const toolCount = msg.thinking.toolStates ? Object.keys(msg.thinking.toolStates).length : 0;
                  const toolEntries = msg.thinking.toolStates ? Object.entries(msg.thinking.toolStates) : [];

                  return (
                    <>
                      {/* Header button */}
                      <button
                        onClick={() => {
                          setMessages(prev => {
                            const updatedMessages = [...prev];
                            if (updatedMessages[index].thinking) {
                              updatedMessages[index] = {
                                ...updatedMessages[index],
                                thinking: {
                                  ...updatedMessages[index].thinking!,
                                  isExpanded: !updatedMessages[index].thinking!.isExpanded
                                }
                              };
                            }
                            return updatedMessages;
                          });
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5 group"
                      >
                        {msg.thinking.isActive && (
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                        <span>
                          {msg.thinking.isActive
                            ? 'Thinking...'
                            : `Thought${toolCount > 0 ? ` (${toolCount} tool${toolCount !== 1 ? 's' : ''})` : ''}`}
                        </span>
                        <svg
                          className={`w-3 h-3 transition-transform ${msg.thinking.isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Thinking content */}
                      {(msg.thinking.thinkingText || toolEntries.length > 0) && (
                        <ThinkingContent
                          toolEntries={toolEntries}
                          thinkingText={msg.thinking.thinkingText}
                          isActive={msg.thinking.isActive}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            
            {/* Follow-up suggestions */}
            {msg.type === 'follow_up_suggestions' && msg.suggestions && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[80%]">
                  <div className="text-xs text-gray-500 mb-2">{msg.message}</div>
                  <div className="flex flex-wrap gap-2">
                    {msg.suggestions.map((suggestion, suggestionIndex) => (
                      <button
                        key={suggestionIndex}
                        onClick={() => handleSuggestionClick(suggestion.text)}
                        className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors border"
                      >
                        {suggestion.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {isConnected && messages.length <= 1 && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-2">Try asking:</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => sendMessage("Analyze my portfolio allocation")}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
            >
              Analyze my holdings
            </button>
            <button
              onClick={() => sendMessage("What's the market outlook for my assets?")}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
            >
              Market outlook
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t pt-4">
        <div className="flex gap-2 items-center">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              isConnected
                ? "Ask about your portfolio..."
                : "Ask me anything"
            }
            disabled={!isConnected}
            rows={1}
            className="flex-1 px-3 text-sm border border-gray-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#AD29FF] disabled:bg-gray-100 resize-none overflow-hidden min-h-[42px] max-h-[200px]"
            style={{ height: 'auto', lineHeight: '26px', paddingTop: '8px', paddingBottom: '8px' }}
          />
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-[4px] transition-colors"
            title="Agent Settings"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
          {isStreamActive ? (
            <button
              onClick={stopStream}
              className="px-4 py-2 bg-red-500 text-white rounded-[4px] hover:bg-red-600 transition-colors"
              title="Stop generation"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              disabled={!inputMessage.trim() || !isConnected}
              className="px-4 py-2 bg-[#AD29FF] text-white rounded-[4px] hover:bg-[#9220E6] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Agent Settings Modal */}
      <AgentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        controls={agentControls}
        onSave={(newControls) => {
          setAgentControls(newControls);
          
        }}
      />

      </div>
    </>
  );
}
