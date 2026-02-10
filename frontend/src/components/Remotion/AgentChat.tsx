import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { AbsoluteFill } from 'remotion';

const PURPLE = '#AD29FF';

const ToolSpinner: React.FC = () => {
  const frame = useCurrentFrame();
  const rotation = (frame * 12) % 360;

  return (
    <svg
      style={{ width: 16, height: 16, color: '#9ca3af', transform: `rotate(${rotation}deg)`, flexShrink: 0 }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

const ToolCheckmark: React.FC = () => (
  <svg style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const CompaneonAvatar: React.FC = () => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: 'white',
      border: '2px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}
  >
    <img
      src="/companeon_symbol_square.png"
      style={{ width: 20, height: 20, objectFit: 'contain' }}
    />
  </div>
);

const USER_MESSAGE = 'Transfer 10 dollars of ETH to vitalik.eth';

// Thinking text that streams in character by character
const THINKING_LINES = [
  'I need to transfer $10 worth of ETH to vitalik.eth.',
  'Let me get the current ETH price, check the recipient,',
  'estimate gas costs, and preview the transfer.',
];

// Tool calls with real names from the agent
const TOOLS = [
  { name: 'get_prices', thinkingBefore: '' },
  { name: 'envio_check_recipient', thinkingBefore: '' },
  { name: 'estimate_gas_cost', thinkingBefore: '' },
  { name: 'preview_transfer', thinkingBefore: '' },
];

const ASSISTANT_LINES = [
  'Transfer Summary',
  '',
  'Amount: 0.0028 ETH (~$10.00)',
  'To: vitalik.eth',
  'Gas: ~$0.25 (standard)',
];

const CHARS_PER_FRAME = 2;

function streamText(full: string, startFrame: number, currentFrame: number): string {
  if (currentFrame < startFrame) return '';
  const chars = Math.floor((currentFrame - startFrame) * CHARS_PER_FRAME);
  return full.slice(0, Math.min(chars, full.length));
}

function streamDone(full: string, startFrame: number, currentFrame: number): boolean {
  return currentFrame >= startFrame + Math.ceil(full.length / CHARS_PER_FRAME);
}

function streamEnd(full: string, startFrame: number): number {
  return startFrame + Math.ceil(full.length / CHARS_PER_FRAME);
}

export const AgentChat: React.FC = () => {
  const frame = useCurrentFrame();
  const containerOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Timeline:
  // 0-15:   Container fades in
  // 20-55:  User types message
  // 60:     User bubble appears
  // 65:     Thinking indicator + thinking text streams
  // ~120:   Tool calls appear sequentially (spinner -> checkmark)
  // ~200:   Assistant message streams in
  // ~280:   Confirmation buttons
  // 310:    Confirm clicked
  // 330:    Transaction success
  // 420-450: Hold then loop

  // User typing
  const typingProgress = interpolate(frame, [20, 55], [0, USER_MESSAGE.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const typedText = USER_MESSAGE.slice(0, Math.floor(typingProgress));
  const showUserBubble = frame >= 60;
  const showTyping = frame >= 20 && !showUserBubble;

  // Thinking section (attached to user message in real UI)
  const showThinking = frame >= 65;
  const thinkingFullText = THINKING_LINES.join(' ');
  const THINKING_START = 68;
  const thinkingText = streamText(thinkingFullText, THINKING_START, frame);
  const thinkingDone = streamDone(thinkingFullText, THINKING_START, frame);
  const thinkingEndFrame = streamEnd(thinkingFullText, THINKING_START);

  // Tool calls appear after thinking text, staggered
  const TOOL_GAP = 18;
  const TOOL_SPIN_DURATION = 20;
  const firstToolStart = thinkingEndFrame + 5;

  const toolStates = TOOLS.map((_, i) => {
    const appear = firstToolStart + i * TOOL_GAP;
    const done = appear + TOOL_SPIN_DURATION;
    return {
      visible: frame >= appear,
      completed: frame >= done,
    };
  });

  const allToolsDone = toolStates.every(t => t.completed);
  const lastToolDoneFrame = firstToolStart + (TOOLS.length - 1) * TOOL_GAP + TOOL_SPIN_DURATION;

  // Thinking is active while tools are running
  const thinkingActive = showThinking && !allToolsDone;

  // Assistant message streams in after all tools complete
  const assistantText = ASSISTANT_LINES.join('\n');
  const ASSISTANT_START = lastToolDoneFrame + 10;
  const assistantStreamed = streamText(assistantText, ASSISTANT_START, frame);
  const showAssistant = frame >= ASSISTANT_START;
  const assistantEndFrame = streamEnd(assistantText, ASSISTANT_START);

  // Confirmation buttons
  const BUTTONS_START = assistantEndFrame + 10;
  const showButtons = frame >= BUTTONS_START;
  const buttonOpacity = interpolate(frame, [BUTTONS_START, BUTTONS_START + 15], [0, 1], { extrapolateRight: 'clamp' });
  const CONFIRM_FRAME = BUTTONS_START + 30;
  const confirmClicked = frame >= CONFIRM_FRAME;

  // Transaction success
  const SUCCESS_FRAME = CONFIRM_FRAME + 15;
  const showSuccess = frame >= SUCCESS_FRAME;
  const successOpacity = interpolate(frame, [SUCCESS_FRAME, SUCCESS_FRAME + 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div
        style={{
          position: 'absolute',
          inset: 10,
          backgroundColor: 'white',
          borderRadius: 8,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: containerOpacity,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 500, color: '#000' }}>AI Companeon</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 18, height: 18, color: '#9ca3af' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div style={{ width: 18, height: 18, color: '#9ca3af' }}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
          </div>
        </div>

        {/* Chat body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Typing in input */}
          {showTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '80%',
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: '#f3f4f6',
                  color: '#000',
                  fontSize: 13,
                }}
              >
                {typedText}
                <span style={{ opacity: (frame % 20 < 10) ? 1 : 0, color: '#9ca3af' }}>|</span>
              </div>
            </div>
          )}

          {/* User message bubble */}
          {showUserBubble && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '80%',
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: PURPLE,
                  color: 'white',
                  fontSize: 13,
                }}
              >
                {USER_MESSAGE}
              </div>
            </div>
          )}

          {/* Thinking section (below user message, matching ThinkingContent) */}
          {showThinking && (
            <div style={{ marginLeft: 2 }}>
              {/* Thinking indicator */}
              {thinkingActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      opacity: 0.4 + 0.6 * Math.sin(frame * 0.15),
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Thinking...</span>
                </div>
              )}

              {/* Thinking text (matches thinking_delta rendering: text-xs text-gray-500 leading-relaxed) */}
              {thinkingText && (
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, marginBottom: 6, marginLeft: 8, maxWidth: '85%' }}>
                  {thinkingText}
                </div>
              )}

              {/* Tool calls (matches ThinkingContent: flex items-center gap-2 text-xs text-gray-500) */}
              <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {TOOLS.map((tool, i) => {
                  if (!toolStates[i].visible) return null;
                  return (
                    <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6b7280' }}>
                      {toolStates[i].completed ? <ToolCheckmark /> : <ToolSpinner />}
                      <span style={{ fontWeight: 500 }}>{tool.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assistant message */}
          {showAssistant && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ flexShrink: 0, marginRight: 10 }}>
                <CompaneonAvatar />
              </div>
              <div
                style={{
                  maxWidth: '80%',
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: '#f3f4f6',
                  color: '#1f2937',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ wordBreak: 'break-word' }}>
                  {assistantStreamed}
                </div>

                {/* Confirmation buttons */}
                {showButtons && !showSuccess && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb', opacity: buttonOpacity }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#111827' }}>
                      Ready to send?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          padding: '5px 10px',
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#374151',
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          textAlign: 'center',
                        }}
                      >
                        Not now
                      </div>
                      <div
                        style={{
                          flex: 1,
                          padding: '5px 10px',
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'white',
                          backgroundColor: confirmClicked ? '#9d24e6' : PURPLE,
                          borderRadius: 4,
                          textAlign: 'center',
                          transform: confirmClicked ? 'scale(0.97)' : 'scale(1)',
                        }}
                      >
                        Confirm
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transaction success */}
          {showSuccess && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', opacity: successOpacity }}>
              <div style={{ flexShrink: 0, marginRight: 10 }}>
                <CompaneonAvatar />
              </div>
              <div
                style={{
                  maxWidth: '80%',
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg style={{ width: 18, height: 18, color: '#22c55e' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                    Transfer sent successfully
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 36,
                    border: `2px solid ${PURPLE}`,
                    borderRadius: 36,
                    color: PURPLE,
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'white',
                  }}
                >
                  View on Basescan
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                minHeight: 36,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: 13,
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '24px',
              }}
            >
              Ask about your portfolio...
            </div>
            <div
              style={{
                padding: '6px 14px',
                backgroundColor: PURPLE,
                color: 'white',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
