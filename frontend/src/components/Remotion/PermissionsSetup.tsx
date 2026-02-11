import React from 'react';
import { useCurrentFrame } from 'remotion';
import { AbsoluteFill } from 'remotion';

const PURPLE = '#AD29FF';

const AssetCheckmark: React.FC = () => (
  <div
    style={{
      width: 20,
      height: 20,
      backgroundColor: '#22c55e',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

const TokenRow: React.FC<{
  symbol: string;
  name: string;
  logo?: string;
  iconLetter?: string;
  iconBg?: string;
  selected: boolean;
  checked: boolean;
}> = ({ symbol, name, logo, iconLetter, iconBg, selected, checked }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      backgroundColor: '#f9fafb',
      borderRadius: 4,
      boxShadow: selected ? `0 0 0 2px ${PURPLE}` : 'none',
    }}
  >
    {logo ? (
      <img
        src={logo}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
        }}
      />
    ) : (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          backgroundColor: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: 'white',
          flexShrink: 0,
        }}
      >
        {iconLetter}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#000' }}>{symbol}</div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{name}</div>
    </div>
    {checked && <AssetCheckmark />}
  </div>
);

const Cursor: React.FC<{ visible: boolean }> = ({ visible }) => {
  const frame = useCurrentFrame();
  if (!visible) return null;
  const blink = (frame % 20) < 12;
  return <span style={{ color: '#000', opacity: blink ? 1 : 0 }}>|</span>;
};

const FloatingInput: React.FC<{
  label: string;
  value: string;
  showCursor?: boolean;
  suffix?: string;
}> = ({ label, value, showCursor = false, suffix }) => (
  <div style={{ position: 'relative' }}>
    <div
      style={{
        height: 40,
        paddingLeft: 10,
        paddingRight: suffix ? 90 : 10,
        paddingTop: value ? 16 : 0,
        paddingBottom: value ? 4 : 0,
        border: '1px solid #d1d5db',
        borderRadius: 4,
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        fontSize: 13,
        lineHeight: '13px',
        color: value ? '#000' : '#9ca3af',
      }}
    >
      {value ? (
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 4,
            fontSize: 10,
            color: '#6b7280',
            lineHeight: '12px',
          }}
        >
          {label}
        </div>
      ) : null}
      <span style={{ fontSize: 13 }}>
        {value || label}
        <Cursor visible={showCursor} />
      </span>
    </div>
    {suffix && value && (
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 11,
          color: '#000',
        }}
      >
        {suffix}
      </div>
    )}
  </div>
);

const FRAMES_PER_CHAR = 3;

function typeText(full: string, startFrame: number, currentFrame: number): string {
  if (currentFrame < startFrame) return '';
  const charIndex = Math.floor((currentFrame - startFrame) / FRAMES_PER_CHAR);
  return full.slice(0, Math.min(charIndex + 1, full.length));
}

function typeDone(full: string, startFrame: number, currentFrame: number): boolean {
  return currentFrame >= startFrame + full.length * FRAMES_PER_CHAR;
}

function typeEnd(full: string, startFrame: number): number {
  return startFrame + full.length * FRAMES_PER_CHAR;
}

export const PermissionsSetup: React.FC = () => {
  const frame = useCurrentFrame();

  // ETH phase: type into 4 fields sequentially
  const ETH_LIMIT_START = 20;
  const ETH_LIMIT_TEXT = '0.1';
  const ETH_FREQ_START = typeEnd(ETH_LIMIT_TEXT, ETH_LIMIT_START) + 4;
  const ETH_FREQ_TEXT = 'Daily';
  const ETH_START_START = typeEnd(ETH_FREQ_TEXT, ETH_FREQ_START) + 4;
  const ETH_START_TEXT = '02/09/2026';
  const ETH_END_START = typeEnd(ETH_START_TEXT, ETH_START_START) + 4;
  const ETH_END_TEXT = '03/09/2026';
  const ETH_DONE_FRAME = typeEnd(ETH_END_TEXT, ETH_END_START) + 6;

  // USDC phase: switch selection, clear fields, type new values
  const USDC_SWITCH_FRAME = ETH_DONE_FRAME + 6;
  const USDC_LIMIT_START = USDC_SWITCH_FRAME + 6;
  const USDC_LIMIT_TEXT = '50';
  const USDC_FREQ_START = typeEnd(USDC_LIMIT_TEXT, USDC_LIMIT_START) + 4;
  const USDC_FREQ_TEXT = 'Daily';
  const USDC_START_START = typeEnd(USDC_FREQ_TEXT, USDC_FREQ_START) + 4;
  const USDC_START_TEXT = '02/09/2026';
  const USDC_END_START = typeEnd(USDC_START_TEXT, USDC_START_START) + 4;
  const USDC_END_TEXT = '03/09/2026';
  const USDC_DONE_FRAME = typeEnd(USDC_END_TEXT, USDC_END_START);

  // Which token is active
  const isUsdcPhase = frame >= USDC_SWITCH_FRAME;
  const ethSelected = !isUsdcPhase;
  const usdcSelected = isUsdcPhase;

  // Checkmarks
  const ethChecked = frame >= ETH_DONE_FRAME;
  const usdcChecked = frame >= USDC_DONE_FRAME;

  // Current field values: switch between ETH and USDC values
  const currentLimit = isUsdcPhase
    ? typeText(USDC_LIMIT_TEXT, USDC_LIMIT_START, frame)
    : typeText(ETH_LIMIT_TEXT, ETH_LIMIT_START, frame);
  const currentFreq = isUsdcPhase
    ? typeText(USDC_FREQ_TEXT, USDC_FREQ_START, frame)
    : typeText(ETH_FREQ_TEXT, ETH_FREQ_START, frame);
  const currentStart = isUsdcPhase
    ? typeText(USDC_START_TEXT, USDC_START_START, frame)
    : typeText(ETH_START_TEXT, ETH_START_START, frame);
  const currentEnd = isUsdcPhase
    ? typeText(USDC_END_TEXT, USDC_END_START, frame)
    : typeText(ETH_END_TEXT, ETH_END_START, frame);

  // Cursors
  const limitCursor = isUsdcPhase
    ? (frame >= USDC_LIMIT_START && !typeDone(USDC_LIMIT_TEXT, USDC_LIMIT_START, frame))
    : (frame >= ETH_LIMIT_START && !typeDone(ETH_LIMIT_TEXT, ETH_LIMIT_START, frame));
  const freqCursor = isUsdcPhase
    ? (frame >= USDC_FREQ_START && !typeDone(USDC_FREQ_TEXT, USDC_FREQ_START, frame))
    : (frame >= ETH_FREQ_START && !typeDone(ETH_FREQ_TEXT, ETH_FREQ_START, frame));
  const startCursor = isUsdcPhase
    ? (frame >= USDC_START_START && !typeDone(USDC_START_TEXT, USDC_START_START, frame))
    : (frame >= ETH_START_START && !typeDone(ETH_START_TEXT, ETH_START_START, frame));
  const endCursor = isUsdcPhase
    ? (frame >= USDC_END_START && !typeDone(USDC_END_TEXT, USDC_END_START, frame))
    : (frame >= ETH_END_START && !typeDone(ETH_END_TEXT, ETH_END_START, frame));

  // USD suffix
  const limitNum = parseFloat(currentLimit) || 0;
  const limitSuffix = isUsdcPhase
    ? (limitNum > 0 ? `$${limitNum.toFixed(2)}` : undefined)
    : (limitNum > 0 ? `$${(limitNum * 3521.4).toFixed(2)}` : undefined);

  // Button
  const canGrant = ethChecked || usdcChecked;
  const buttonPulse = frame >= USDC_DONE_FRAME + 8 && frame < USDC_DONE_FRAME + 28
    ? 1 + 0.04 * Math.sin((frame - USDC_DONE_FRAME - 8) * 0.3)
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>
            Set agent permissions
          </div>
        </div>

        {/* Content area */}
        <div style={{ display: 'flex', gap: 16, flex: 1, padding: '4px 20px', overflow: 'hidden' }}>
          {/* Left Column - Token list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '40%', flexShrink: 0 }}>
            <TokenRow symbol="ETH" name="Ethereum" logo="/logos/eth-logo.png" selected={ethSelected} checked={ethChecked} />
            <TokenRow symbol="USDC" name="USD Coin" logo="/logos/usdc-logo.png" selected={usdcSelected} checked={usdcChecked} />
          </div>

          {/* Right Column - Form fields (always rendered, never unmounted) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FloatingInput label="Spend limit" value={currentLimit} showCursor={limitCursor} suffix={limitSuffix} />
            <FloatingInput label="Frequency" value={currentFreq} showCursor={freqCursor} />
            <FloatingInput label="Start date" value={currentStart} showCursor={startCursor} />
            <FloatingInput label="End date" value={currentEnd} showCursor={endCursor} />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid #e5e7eb',
            padding: '12px 20px',
            display: 'flex',
            gap: 10,
          }}
        >
          <div
            style={{
              height: 40,
              paddingLeft: 20,
              paddingRight: 20,
              borderRadius: 4,
              border: '2px solid #dc2626',
              backgroundColor: 'white',
              color: '#dc2626',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Cancel
          </div>
          <div
            style={{
              flex: 1,
              height: 40,
              borderRadius: 4,
              backgroundColor: canGrant ? PURPLE : '#d1d5db',
              color: canGrant ? 'white' : '#6b7280',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${buttonPulse})`,
            }}
          >
            Grant permissions
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
