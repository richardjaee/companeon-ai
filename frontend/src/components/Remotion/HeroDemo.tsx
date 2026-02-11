import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';

const PURPLE = '#AD29FF';
const SCENE_DURATION = 150;
const NUM_SCENES = 4;

interface SceneConfig {
  userMessage: string;
  thinkingText: string;
  tools: string[];
  resultTitle: string;
  resultLines: string[];
  successText?: string;
}

const SCENES: SceneConfig[] = [
  {
    userMessage: 'Transfer 10 dollars of ETH to vitalik.eth',
    thinkingText:
      'Checking ETH price and preparing your transfer.',
    tools: [
      'get_prices',
      'envio_check_recipient',
      'estimate_gas_cost',
      'preview_transfer',
    ],
    resultTitle: 'Transfer Summary',
    resultLines: [
      'Amount: 0.0028 ETH (~$10.00)',
      'To: vitalik.eth',
      'Gas: ~$0.25 (standard)',
    ],
    successText: 'Transfer sent successfully',
  },
  {
    userMessage: 'Swap 100 USDC to ETH',
    thinkingText:
      'Finding the best swap route and estimating gas.',
    tools: ['get_prices', 'find_swap_route', 'estimate_gas_cost', 'preview_swap'],
    resultTitle: 'Swap Summary',
    resultLines: [
      'From: 100 USDC',
      'To: ~0.0284 ETH ($100.00)',
      'Route: Uniswap V4',
      'Gas: ~$0.18',
    ],
    successText: 'Swap executed successfully',
  },
  {
    userMessage: "What's my portfolio worth?",
    thinkingText:
      'Checking your token balances and latest prices.',
    tools: ['get_balances', 'get_prices'],
    resultTitle: 'Portfolio Summary',
    resultLines: [
      'Total Value: $4,287.52',
      'ETH: 1.24 ($3,847.52)',
      'USDC: 440.00 ($440.00)',
    ],
  },
  {
    userMessage: 'Stake 2 ETH on Lido',
    thinkingText:
      'Checking staking rates and preparing your stake.',
    tools: ['get_staking_rates', 'approve_stake', 'execute_stake'],
    resultTitle: 'Staking Summary',
    resultLines: [
      'Amount: 2 ETH',
      'Receive: ~1.98 stETH',
      'Protocol: Lido',
      'APR: 3.2%',
    ],
    successText: 'Staking completed successfully',
  },
];

// --- Components ---

const CompaneonAvatar: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: 'white',
      border: '1.5px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}
  >
    <img
      src="/companeon_symbol_square.png"
      style={{
        width: size * 0.65,
        height: size * 0.65,
        objectFit: 'contain',
      }}
    />
  </div>
);

const ToolSpinnerIcon: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: '2px solid #e5e7eb',
        borderTopColor: PURPLE,
        transform: `rotate(${(frame * 12) % 360}deg)`,
        flexShrink: 0,
      }}
    />
  );
};

const ToolCheckIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="7" fill="#22c55e" />
    <path
      d="M4 7l2 2 4-4"
      stroke="white"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ThinkingDot: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: '#3b82f6',
        opacity: 0.4 + 0.6 * Math.sin(frame * 0.15),
        flexShrink: 0,
      }}
    />
  );
};

// --- Main ---

export const HeroDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneIndex = Math.floor(frame / SCENE_DURATION) % NUM_SCENES;
  const localFrame = frame % SCENE_DURATION;
  const scene = SCENES[sceneIndex];

  // 3D card flip transition
  const entrySpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 12,
  });
  const exitProgress = interpolate(localFrame, [138, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isEntering = localFrame < 12;
  const isExiting = localFrame >= 138;

  let cardRotateY = 0;
  let cardScale = 1;
  let cardOpacity = 1;

  if (isEntering) {
    cardRotateY = interpolate(entrySpring, [0, 1], [-20, 0]);
    cardScale = interpolate(entrySpring, [0, 1], [0.88, 1]);
    cardOpacity = entrySpring;
  } else if (isExiting) {
    cardRotateY = interpolate(exitProgress, [0, 1], [0, 20]);
    cardScale = interpolate(exitProgress, [0, 1], [1, 0.88]);
    cardOpacity = 1 - exitProgress;
  }

  // Subtle float during hold
  const floatY = Math.sin(localFrame * 0.03) * 1.5;
  const floatRotateX = Math.sin(localFrame * 0.02) * 0.3;

  // Content timeline
  const USER_TYPE_START = 10;
  const USER_CPS = 2;
  const userChars = Math.floor(Math.max(0, localFrame - USER_TYPE_START) * USER_CPS);
  const userTyped = scene.userMessage.slice(
    0,
    Math.min(userChars, scene.userMessage.length)
  );
  const USER_SENT = USER_TYPE_START + Math.ceil(scene.userMessage.length / USER_CPS) + 2;
  const showUserBubble = localFrame >= USER_SENT;
  const showTyping = localFrame >= USER_TYPE_START && !showUserBubble;

  const THINK_START = USER_SENT + 3;
  const THINK_CPS = 3;
  const thinkChars = Math.floor(Math.max(0, localFrame - THINK_START) * THINK_CPS);
  const thinkTyped = scene.thinkingText.slice(
    0,
    Math.min(thinkChars, scene.thinkingText.length)
  );
  const showThinking = localFrame >= THINK_START;
  const THINK_END = THINK_START + Math.ceil(scene.thinkingText.length / THINK_CPS);

  const TOOL_START = THINK_END + 2;
  const TOOL_GAP = 7;
  const toolStates = scene.tools.map((_tool, i) => {
    const appear = TOOL_START + i * TOOL_GAP;
    const complete = appear + TOOL_GAP - 2;
    if (localFrame < appear) return 'hidden' as const;
    if (localFrame < complete) return 'loading' as const;
    return 'done' as const;
  });
  const allToolsDone = toolStates.every((s) => s === 'done');
  const TOOLS_END = TOOL_START + scene.tools.length * TOOL_GAP;

  const RESULT_START = TOOLS_END + 3;
  const resultProgress = spring({
    frame: Math.max(0, localFrame - RESULT_START),
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const showResult = localFrame >= RESULT_START;

  const SUCCESS_START = RESULT_START + 18;
  const successProgress = spring({
    frame: Math.max(0, localFrame - SUCCESS_START),
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const showSuccess = !!scene.successText && localFrame >= SUCCESS_START;

  return (
    <AbsoluteFill style={{ background: '#0a0a0a' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: '1200px',
        }}
      >
        <div
          style={{
            width: 920,
            height: 510,
            background: 'white',
            borderRadius: 10,
            boxShadow: '0 20px 80px rgba(0,0,0,0.4)',
            transform: `rotateY(${cardRotateY}deg) scale(${cardScale}) translateY(${floatY}px) rotateX(${floatRotateX}deg)`,
            opacity: cardOpacity,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CompaneonAvatar size={26} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>
                AI Companeon
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#9ca3af"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#9ca3af"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </div>
          </div>

          {/* Chat area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '12px 16px',
              gap: 10,
              overflow: 'hidden',
            }}
          >
            {/* User typing preview */}
            {showTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '8px 14px',
                    borderRadius: '14px 14px 4px 14px',
                    backgroundColor: '#f3f4f6',
                    fontSize: 14,
                    color: '#111',
                  }}
                >
                  {userTyped}
                  <span
                    style={{
                      opacity: localFrame % 16 < 10 ? 1 : 0,
                      color: '#9ca3af',
                    }}
                  >
                    |
                  </span>
                </div>
              </div>
            )}

            {/* User sent bubble */}
            {showUserBubble && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '8px 14px',
                    borderRadius: '14px 14px 4px 14px',
                    backgroundColor: PURPLE,
                    color: 'white',
                    fontSize: 14,
                    boxShadow: `0 2px 8px ${PURPLE}30`,
                  }}
                >
                  {scene.userMessage}
                </div>
              </div>
            )}

            {/* Thinking + Tools */}
            {showThinking && (
              <div style={{ marginLeft: 2 }}>
                {/* Thinking indicator - hide once first tool appears */}
                {toolStates[0] !== 'loading' && toolStates[0] !== 'done' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <ThinkingDot />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      Thinking...
                    </span>
                  </div>
                )}

                {/* Thinking text - stays visible throughout */}
                {thinkTyped && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                      marginBottom: 6,
                      marginLeft: 4,
                      maxWidth: '85%',
                    }}
                  >
                    {scene.thinkingText}
                  </div>
                )}

                {/* Tool calls */}
                <div
                  style={{
                    marginLeft: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {scene.tools.map((tool, i) => {
                    if (toolStates[i] === 'hidden') return null;
                    return (
                      <div
                        key={tool}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: '#6b7280',
                        }}
                      >
                        {toolStates[i] === 'loading' ? (
                          <ToolSpinnerIcon />
                        ) : (
                          <ToolCheckIcon />
                        )}
                        <span
                          style={{
                            fontFamily: 'ui-monospace, monospace',
                          }}
                        >
                          {tool}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Result card */}
            {showResult && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  opacity: resultProgress,
                  transform: `translateY(${(1 - resultProgress) * 10}px)`,
                }}
              >
                <CompaneonAvatar size={24} />
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    overflow: 'hidden',
                    maxWidth: '75%',
                  }}
                >
                  <div style={{ padding: '12px 14px' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#111',
                        marginBottom: 8,
                      }}
                    >
                      {scene.resultTitle}
                    </div>
                    {scene.resultLines.map((line, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 13,
                          color: '#4b5563',
                          lineHeight: 1.6,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>

                  {/* Success */}
                  {showSuccess && scene.successText && (
                    <div
                      style={{
                        borderTop: '1px solid #e5e7eb',
                        padding: '10px 14px',
                        opacity: successProgress,
                        transform: `translateY(${(1 - successProgress) * 5}px)`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          style={{ flexShrink: 0 }}
                        >
                          <circle cx="7" cy="7" r="7" fill="#22c55e" />
                          <path
                            d="M4 7l2 2 4-4"
                            stroke="white"
                            strokeWidth="1.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#111',
                          }}
                        >
                          {scene.successText}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 28,
                          paddingLeft: 14,
                          paddingRight: 14,
                          border: `2px solid ${PURPLE}`,
                          borderRadius: 28,
                          color: PURPLE,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        View on Etherscan
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div
            style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              borderTop: '1px solid #e5e7eb',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                fontSize: 13,
                color: '#9ca3af',
              }}
            >
              Ask about your portfolio...
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: PURPLE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 3v10M4 7l4-4 4 4"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
