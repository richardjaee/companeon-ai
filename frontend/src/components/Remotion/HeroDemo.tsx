import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';

const PURPLE = '#AD29FF';
const GRAY_50 = '#f9fafb';
const GRAY_200 = '#e5e7eb';
const GRAY_300 = '#d1d5db';
const GRAY_400 = '#9ca3af';
const GRAY_500 = '#6b7280';
const GRAY_600 = '#4b5563';
const GRAY_700 = '#374151';
const GRAY_900 = '#111827';
const GREEN = '#22c55e';
const RED = '#dc2626';
const PURPLE_50 = '#faf5ff';
const PURPLE_100 = '#f3e8ff';
const PURPLE_200 = '#e9d5ff';
const GREEN_50 = '#f0fdf4';

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', balance: '1.2400', usd: '$3,847.52', logo: '/logos/eth-logo.png' },
  { symbol: 'USDC', name: 'USD Coin', balance: '450.00', usd: '$450.00', logo: '/logos/usdc-logo.png' },
];

const CHAT_TOOLS = ['get_prices', 'find_swap_route', 'estimate_gas_cost', 'preview_swap'];
const USER_MSG = 'Swap 100 USDC to ETH';
const THINK_MSG = 'Finding the best swap route and estimating gas costs.';
const RESULT_LINES = ['From: 100 USDC', 'To: ~0.0284 ETH ($100.00)', 'Route: Uniswap V4', 'Gas: ~$0.18'];

const PERM_FPC = 2;

function permTypeText(full: string, start: number, f: number): string {
  if (f < start) return '';
  const i = Math.floor((f - start) / PERM_FPC);
  return full.slice(0, Math.min(i + 1, full.length));
}
function permTypeDone(full: string, start: number, f: number): boolean {
  return f >= start + full.length * PERM_FPC;
}
function permTypeEnd(full: string, start: number): number {
  return start + full.length * PERM_FPC;
}

const ToolSpinner: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg style={{ width: 12, height: 12, transform: `rotate(${(frame * 12) % 360}deg)`, flexShrink: 0 }} fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke={GRAY_400} strokeWidth="4" />
      <path style={{ opacity: 0.75 }} fill={GRAY_400} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

const ToolCheck: React.FC = () => (
  <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill={GREEN} viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const Avatar: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', overflow: 'hidden',
    backgroundColor: 'white', border: '1.5px solid #e5e7eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    <img src="/companeon_symbol_square.png" style={{ width: size * 0.65, height: size * 0.65, objectFit: 'contain' }} />
  </div>
);

const GrantSpinner: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = PURPLE }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${color}`,
      borderRightColor: 'transparent',
      borderRadius: '50%',
      transform: `rotate(${(frame * 12) % 360}deg)`,
      flexShrink: 0,
    }} />
  );
};

const StepCheckIcon: React.FC = () => (
  <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill={GREEN} viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const PermFloatingInput: React.FC<{
  label: string;
  value: string;
  showCursor?: boolean;
  suffix?: string;
}> = ({ label, value, showCursor = false, suffix }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        height: 28, paddingLeft: 8,
        paddingRight: suffix ? 60 : 8,
        paddingTop: value ? 12 : 0,
        paddingBottom: value ? 2 : 0,
        border: `1px solid ${GRAY_300}`,
        borderRadius: 4, backgroundColor: 'white',
        display: 'flex', alignItems: 'center',
        fontSize: 9, lineHeight: '9px',
        color: value ? '#000' : GRAY_400,
      }}>
        {value && (
          <div style={{
            position: 'absolute', left: 8, top: 2,
            fontSize: 7, color: GRAY_500, lineHeight: '8px',
          }}>
            {label}
          </div>
        )}
        <span style={{ fontSize: 9 }}>
          {value || label}
          {showCursor && <span style={{ color: '#000', opacity: frame % 20 < 12 ? 1 : 0 }}>|</span>}
        </span>
      </div>
      {suffix && value && (
        <div style={{
          position: 'absolute', right: 6, top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 8, color: '#000',
        }}>
          {suffix}
        </div>
      )}
    </div>
  );
};

const PermTokenRow: React.FC<{
  symbol: string; name: string; logo: string;
  selected: boolean; checked: boolean;
}> = ({ symbol, name, logo, selected, checked }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 8px', backgroundColor: GRAY_50,
    borderRadius: 4,
    boxShadow: selected ? `0 0 0 2px ${PURPLE}` : 'none',
  }}>
    <img src={logo} style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: '#000' }}>{symbol}</div>
      <div style={{ fontSize: 8, color: GRAY_500 }}>{name}</div>
    </div>
    {checked && (
      <div style={{
        width: 14, height: 14, backgroundColor: GREEN, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )}
  </div>
);

export const HeroDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // ===== PHASE 1: Dashboard + Token Selection (0-125) =====
  const P1_END = 125;
  const ethSelected = frame >= 50 && frame < P1_END;
  const usdcSelected = frame >= 70 && frame < P1_END;
  const selectedCount = (ethSelected ? 1 : 0) + (usdcSelected ? 1 : 0);

  const showBar = frame >= 85 && frame < 120;
  const barSpring = spring({ frame: Math.max(0, frame - 85), fps, config: { damping: 14, stiffness: 120 } });
  const barExit = frame >= 113 ? interpolate(frame, [113, 123], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const barY = showBar ? interpolate(barSpring, [0, 1], [50, 0]) + barExit * 50 : 50;
  const barOp = showBar ? barSpring * (1 - barExit) : 0;
  const continuePress = frame >= 108 && frame < 116;

  // ===== PHASE 2: Bottom Sheet - Permission Setup (125-310) =====
  const SHEET_START = 125;
  const showSheet = frame >= SHEET_START && frame < 440;
  const sheetSlide = spring({ frame: Math.max(0, frame - SHEET_START), fps, config: { damping: 16, stiffness: 100 } });
  const sheetDismiss = frame >= 420 ? interpolate(frame, [420, 440], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const sheetY = showSheet ? interpolate(sheetSlide, [0, 1], [380, 0]) + sheetDismiss * 380 : 380;
  const backdropOp = showSheet
    ? (frame < 420
      ? Math.min(sheetSlide * 0.5, 0.5)
      : interpolate(frame, [420, 440], [0.5, 0], { extrapolateRight: 'clamp' }))
    : 0;

  // Permission form typing
  const PERM_START = 140;

  const ETH_LIM_S = PERM_START;
  const ETH_LIM_T = '0.1';
  const ETH_FREQ_S = permTypeEnd(ETH_LIM_T, ETH_LIM_S) + 3;
  const ETH_FREQ_T = 'Daily';
  const ETH_STRT_S = permTypeEnd(ETH_FREQ_T, ETH_FREQ_S) + 3;
  const ETH_STRT_T = '02/09/2026';
  const ETH_END_S = permTypeEnd(ETH_STRT_T, ETH_STRT_S) + 3;
  const ETH_END_T = '03/09/2026';
  const ETH_DONE = permTypeEnd(ETH_END_T, ETH_END_S) + 5;

  const USDC_SWITCH = ETH_DONE + 5;
  const USDC_LIM_S = USDC_SWITCH + 5;
  const USDC_LIM_T = '50';
  const USDC_FREQ_S = permTypeEnd(USDC_LIM_T, USDC_LIM_S) + 3;
  const USDC_FREQ_T = 'Daily';
  const USDC_STRT_S = permTypeEnd(USDC_FREQ_T, USDC_FREQ_S) + 3;
  const USDC_STRT_T = '02/09/2026';
  const USDC_END_S = permTypeEnd(USDC_STRT_T, USDC_STRT_S) + 3;
  const USDC_END_T = '03/09/2026';
  const USDC_DONE = permTypeEnd(USDC_END_T, USDC_END_S) + 5;

  const isUsdcPhase = frame >= USDC_SWITCH;
  const ethPermSel = frame >= PERM_START && !isUsdcPhase;
  const usdcPermSel = isUsdcPhase && frame < USDC_DONE + 20;
  const ethPermCheck = frame >= ETH_DONE;
  const usdcPermCheck = frame >= USDC_DONE;

  const pLim = isUsdcPhase ? permTypeText(USDC_LIM_T, USDC_LIM_S, frame) : permTypeText(ETH_LIM_T, ETH_LIM_S, frame);
  const pFreq = isUsdcPhase ? permTypeText(USDC_FREQ_T, USDC_FREQ_S, frame) : permTypeText(ETH_FREQ_T, ETH_FREQ_S, frame);
  const pStart = isUsdcPhase ? permTypeText(USDC_STRT_T, USDC_STRT_S, frame) : permTypeText(ETH_STRT_T, ETH_STRT_S, frame);
  const pEnd = isUsdcPhase ? permTypeText(USDC_END_T, USDC_END_S, frame) : permTypeText(ETH_END_T, ETH_END_S, frame);

  const limCur = isUsdcPhase
    ? (frame >= USDC_LIM_S && !permTypeDone(USDC_LIM_T, USDC_LIM_S, frame))
    : (frame >= ETH_LIM_S && !permTypeDone(ETH_LIM_T, ETH_LIM_S, frame));
  const freqCur = isUsdcPhase
    ? (frame >= USDC_FREQ_S && !permTypeDone(USDC_FREQ_T, USDC_FREQ_S, frame))
    : (frame >= ETH_FREQ_S && !permTypeDone(ETH_FREQ_T, ETH_FREQ_S, frame));
  const strtCur = isUsdcPhase
    ? (frame >= USDC_STRT_S && !permTypeDone(USDC_STRT_T, USDC_STRT_S, frame))
    : (frame >= ETH_STRT_S && !permTypeDone(ETH_STRT_T, ETH_STRT_S, frame));
  const endCur = isUsdcPhase
    ? (frame >= USDC_END_S && !permTypeDone(USDC_END_T, USDC_END_S, frame))
    : (frame >= ETH_END_S && !permTypeDone(ETH_END_T, ETH_END_S, frame));

  const limN = parseFloat(pLim) || 0;
  const limSuffix = isUsdcPhase
    ? (limN > 0 ? `$${limN.toFixed(2)}` : undefined)
    : (limN > 0 ? `$${(limN * 3521.4).toFixed(2)}` : undefined);

  const canGrant = ethPermCheck || usdcPermCheck;
  const GRANT_CLICK = USDC_DONE + 15;
  const grantPress = frame >= GRANT_CLICK && frame < GRANT_CLICK + 8;

  // ===== PHASE 3: Grant Processing (inside sheet) =====
  const GRANT_VIEW_START = GRANT_CLICK + 10;
  const showGrantView = frame >= GRANT_VIEW_START && showSheet;

  const S1_START = GRANT_VIEW_START + 5;
  const S1_DONE = S1_START + 35;
  const S2_START = S1_DONE + 5;
  const S2_DONE = S2_START + 25;
  const SUCCESS_FRAME = S2_DONE + 5;
  const DONE_CLICK = SUCCESS_FRAME + 20;

  const s1Status: 'pending' | 'loading' | 'completed' = frame < S1_START ? 'pending' : frame < S1_DONE ? 'loading' : 'completed';
  const s2Status: 'pending' | 'loading' | 'completed' = frame < S2_START ? 'pending' : frame < S2_DONE ? 'loading' : 'completed';
  const showSuccess = frame >= SUCCESS_FRAME;

  const grantStage = frame >= S1_START && frame < S1_START + 12 ? 'Switching to Base...'
    : frame >= S1_START + 12 && frame < S1_DONE ? 'Granting ERC-7715 permissions...'
    : frame >= S2_START && frame < S2_DONE ? 'Registering wallet agent...'
    : '';

  // ===== PHASE 4: Chat Interaction =====
  const CHAT_ACTIVE = DONE_CLICK + 30;
  const TYPE_START = CHAT_ACTIVE + 10;
  const typedChars = Math.floor(Math.max(0, frame - TYPE_START));
  const userTyped = USER_MSG.slice(0, Math.min(typedChars, USER_MSG.length));
  const SENT = TYPE_START + USER_MSG.length + 5;
  const showBubble = frame >= SENT;
  const showTyping = frame >= TYPE_START && !showBubble;

  const TH_START = SENT + 8;
  const thinkChars = Math.floor(Math.max(0, frame - TH_START) * 1.3);
  const thinkTyped = THINK_MSG.slice(0, Math.min(thinkChars, THINK_MSG.length));
  const showThink = frame >= TH_START;
  const TH_END = TH_START + Math.ceil(THINK_MSG.length / 1.3);

  const T_START = TH_END + 5;
  const T_GAP = 18;
  const tStates = CHAT_TOOLS.map((_, i) => {
    const a = T_START + i * T_GAP;
    const d = a + T_GAP - 4;
    if (frame < a) return 'hidden' as const;
    if (frame < d) return 'loading' as const;
    return 'done' as const;
  });
  const firstToolVis = tStates.some(s => s !== 'hidden');
  const T_END = T_START + CHAT_TOOLS.length * T_GAP;

  const R_START = T_END + 8;
  const rSpring = spring({ frame: Math.max(0, frame - R_START), fps, config: { damping: 14, stiffness: 100 } });
  const showRes = frame >= R_START;

  const SUC_START = R_START + 30;
  const sSpring = spring({ frame: Math.max(0, frame - SUC_START), fps, config: { damping: 14, stiffness: 100 } });
  const showSuccChat = frame >= SUC_START;

  // Chat scroll
  const VIS_H = 260;
  let cH = 0;
  if (showTyping || showBubble) cH += 32;
  if (showThink) { cH += 14; if (thinkTyped) cH += 28; cH += tStates.filter(s => s !== 'hidden').length * 16; }
  if (showRes) cH += 100;
  if (showSuccChat) cH += 48;
  const scrollY = Math.max(0, cH - VIS_H);

  const isChatPhase = frame >= CHAT_ACTIVE;

  return (
    <AbsoluteFill style={{ backgroundColor: 'white', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", opacity: fadeIn }}>

      {/* ====== SIDEBAR ====== */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 52,
        backgroundColor: 'white', borderRight: `1px solid ${GRAY_200}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14,
        zIndex: 5,
      }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden' }}>
          <img src="/companeon_symbol_square.png" style={{ width: 30, height: 30, objectFit: 'contain' }} />
        </div>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{
            width: 42, padding: '5px 0', borderRadius: 8, backgroundColor: PURPLE_50,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <svg width="16" height="16" fill="none" stroke="#7e22ce" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span style={{ fontSize: 7, color: '#7e22ce', fontWeight: 500 }}>Portfolio</span>
          </div>
          <div style={{
            width: 42, padding: '5px 0', borderRadius: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <svg width="16" height="16" fill="none" stroke={GRAY_600} viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span style={{ fontSize: 7, color: GRAY_600, fontWeight: 500 }}>Account</span>
          </div>
        </div>
      </div>

      {/* ====== MAIN AREA ====== */}
      <div style={{ position: 'absolute', left: 52, top: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Banner */}
        <div style={{
          height: 148, position: 'relative', flexShrink: 0,
          background: `linear-gradient(to bottom, ${PURPLE_100}, ${PURPLE_200})`,
        }}>
          <div style={{
            position: 'absolute', top: 10, right: 16,
            display: 'flex', alignItems: 'center', gap: 5,
            backgroundColor: 'white', borderRadius: 20, padding: '4px 10px',
          }}>
            <svg width="14" height="14" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 500, color: '#000' }}>0xf39F...2266</span>
          </div>

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: GRAY_900, marginBottom: 8 }}>Portfolio</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              backgroundColor: 'white', borderRadius: 16, padding: '7px 0',
            }}>
              <div style={{ padding: '0 14px' }}>
                <div style={{ fontSize: 7, color: GRAY_600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, fontWeight: 500 }}>Portfolio Value</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: GRAY_900 }}>$4,297.52</div>
              </div>
              <div style={{ width: 1, height: 24, backgroundColor: GRAY_200 }} />
              <div style={{ padding: '0 14px' }}>
                <div style={{ fontSize: 7, color: GRAY_600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, fontWeight: 500 }}>ETH Balance</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: GRAY_900 }}>1.2400 ETH</div>
              </div>
              <div style={{ width: 1, height: 24, backgroundColor: GRAY_200 }} />
              <div style={{ padding: '0 14px' }}>
                <div style={{ fontSize: 7, color: GRAY_600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 2, fontWeight: 500 }}>Tokens</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: GRAY_900 }}>2</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>

          {/* Left column */}
          <div style={{ flex: 1, padding: '10px 14px', overflow: 'hidden', marginRight: 280 }}>

            {/* Get Started Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{
                backgroundColor: PURPLE_50, borderRadius: 6, padding: '8px 10px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#000', marginBottom: 3 }}>Welcome to your dashboard</div>
                <div style={{ fontSize: 8, color: GRAY_600, lineHeight: 1.4, marginBottom: 6 }}>
                  Select tokens to grant AI agent permissions.
                </div>
                <div style={{
                  display: 'inline-flex', padding: '3px 8px',
                  border: `1px solid ${GRAY_300}`, borderRadius: 3,
                  fontSize: 8, color: GRAY_700, backgroundColor: 'white',
                }}>
                  Learn more
                </div>
              </div>
              <div style={{
                backgroundColor: GREEN_50, borderRadius: 6, padding: '8px 10px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#000', marginBottom: 3 }}>Get AI prompts</div>
                <div style={{ fontSize: 8, color: GRAY_600, lineHeight: 1.4, marginBottom: 6 }}>
                  20 free credits to get started.
                </div>
                <div style={{
                  display: 'inline-flex', padding: '3px 8px',
                  border: `1px solid ${GRAY_300}`, borderRadius: 3,
                  fontSize: 8, color: GRAY_700, backgroundColor: 'white',
                }}>
                  Buy credits
                </div>
              </div>
            </div>

            {/* Your Crypto */}
            <div style={{ fontSize: 12, fontWeight: 500, color: GRAY_900, marginBottom: 8 }}>Your Crypto</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TOKENS.map((token, i) => {
                const isSel = (i === 0 && ethSelected) || (i === 1 && usdcSelected);
                const selOp = isSel
                  ? spring({ frame: Math.max(0, frame - (i === 0 ? 50 : 70)), fps, config: { damping: 12, stiffness: 150 } })
                  : (frame >= P1_END)
                    ? 1 - interpolate(frame, [P1_END, P1_END + 10], [0, 1], { extrapolateRight: 'clamp' })
                    : 0;

                return (
                  <div key={token.symbol} style={{ flex: 1 }}>
                    <div style={{
                      backgroundColor: GRAY_50, borderRadius: 16,
                      padding: '10px 10px 8px', position: 'relative',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 16,
                        border: `2px solid ${PURPLE}`, pointerEvents: 'none' as const,
                        opacity: selOp,
                      }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <img src={token.logo} style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#000', lineHeight: 1.2 }}>{token.symbol}</div>
                          <div style={{ fontSize: 8, color: GRAY_600, lineHeight: 1.2, marginTop: 1 }}>{token.name}</div>
                        </div>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%',
                          backgroundColor: PURPLE, opacity: selOp,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div style={{ marginLeft: 26, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>{token.balance}</span>
                        <span style={{ fontSize: 8, color: '#000' }}>({token.usd})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ====== CHAT PANEL ====== */}
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 280,
            borderLeft: `1px solid ${GRAY_200}`, backgroundColor: 'white',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '8px 10px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#000' }}>AI Companeon</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <svg width="14" height="14" fill="none" stroke={GRAY_400} viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg width="14" height="14" fill="none" stroke={GRAY_400} viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </div>
            </div>

            {/* Chat body */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: '6px 10px',
                transform: `translateY(-${scrollY}px)`,
              }}>
                {/* Welcome state (before chat starts) */}
                {!isChatPhase && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: 220, gap: 10,
                  }}>
                    <Avatar size={36} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#000', textAlign: 'center' }}>
                      Welcome to your AI Companeon!
                    </div>
                    <div style={{ fontSize: 9, color: GRAY_500, textAlign: 'center', lineHeight: 1.4, maxWidth: 200 }}>
                      Your AI-powered assistant for managing crypto and executing on-chain transactions.
                    </div>
                    <div style={{
                      marginTop: 4, height: 26, paddingLeft: 16, paddingRight: 16,
                      borderRadius: 4, backgroundColor: PURPLE, color: 'white',
                      fontSize: 9, fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      Connect to AI
                    </div>
                  </div>
                )}

                {/* Typing preview */}
                {showTyping && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', padding: '6px 10px', borderRadius: 8,
                      backgroundColor: GRAY_50, fontSize: 10, color: '#000',
                    }}>
                      {userTyped}
                      <span style={{ opacity: frame % 16 < 10 ? 1 : 0, color: GRAY_400 }}>|</span>
                    </div>
                  </div>
                )}

                {/* User bubble */}
                {showBubble && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', padding: '6px 10px', borderRadius: 8,
                      backgroundColor: PURPLE, color: 'white', fontSize: 10,
                    }}>
                      {USER_MSG}
                    </div>
                  </div>
                )}

                {/* Thinking + tools */}
                {showThink && (
                  <div style={{ marginLeft: 2 }}>
                    {!firstToolVis && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <div style={{
                          width: 4, height: 4, borderRadius: '50%', backgroundColor: '#3b82f6',
                          opacity: 0.4 + 0.6 * Math.sin(frame * 0.15),
                        }} />
                        <span style={{ fontSize: 8, color: GRAY_500 }}>Thinking...</span>
                      </div>
                    )}
                    {thinkTyped && (
                      <div style={{
                        fontSize: 9, color: GRAY_500, fontStyle: 'italic',
                        lineHeight: 1.4, marginBottom: 4, marginLeft: 3, maxWidth: '90%',
                      }}>
                        {THINK_MSG}
                      </div>
                    )}
                    <div style={{ marginLeft: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {CHAT_TOOLS.map((tool, i) => {
                        if (tStates[i] === 'hidden') return null;
                        return (
                          <div key={tool} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 9, color: GRAY_500,
                          }}>
                            {tStates[i] === 'loading' ? <ToolSpinner /> : <ToolCheck />}
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{tool}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Result card */}
                {showRes && (
                  <div style={{
                    display: 'flex', gap: 6, alignItems: 'flex-start',
                    opacity: rSpring, transform: `translateY(${(1 - rSpring) * 8}px)`,
                  }}>
                    <Avatar size={20} />
                    <div style={{
                      border: `1px solid ${GRAY_200}`, borderRadius: 10,
                      overflow: 'hidden', flex: 1,
                    }}>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#111', marginBottom: 5 }}>Swap Summary</div>
                        {RESULT_LINES.map((line, i) => (
                          <div key={i} style={{ fontSize: 9, color: GRAY_600, lineHeight: 1.5 }}>{line}</div>
                        ))}
                      </div>
                      {showSuccChat && (
                        <div style={{
                          borderTop: `1px solid ${GRAY_200}`, padding: '7px 10px',
                          opacity: sSpring,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                            <svg width="10" height="10" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                              <circle cx="7" cy="7" r="7" fill={GREEN} />
                              <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#111' }}>Swap executed successfully</span>
                          </div>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            height: 22, paddingLeft: 10, paddingRight: 10,
                            border: `2px solid ${PURPLE}`, borderRadius: 22,
                            color: PURPLE, fontSize: 8, fontWeight: 600,
                          }}>
                            View on Etherscan
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat input */}
            <div style={{
              padding: '6px 10px', borderTop: `1px solid ${GRAY_200}`, flexShrink: 0,
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <div style={{
                flex: 1, height: 26, borderRadius: 13,
                backgroundColor: GRAY_50, display: 'flex', alignItems: 'center',
                padding: '0 10px', fontSize: 9, color: GRAY_400,
              }}>
                Ask me anything
              </div>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', backgroundColor: PURPLE,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M4 7l4-4 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====== FLOATING ACTION BAR ====== */}
      {selectedCount > 0 && (
        <div style={{
          position: 'absolute', bottom: 10, left: 186, width: 360,
          opacity: barOp, transform: `translateY(${barY}px)`,
          zIndex: 10,
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            border: `1px solid ${GRAY_200}`,
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: GRAY_700 }}>
              {selectedCount} asset{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                padding: '4px 12px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                border: `2px solid ${RED}`, color: RED, backgroundColor: 'white',
              }}>
                Cancel
              </div>
              <div style={{
                padding: '4px 14px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                backgroundColor: PURPLE, color: 'white', border: `2px solid ${PURPLE}`,
                transform: continuePress ? 'scale(0.97)' : 'scale(1)',
              }}>
                Continue
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== BOTTOM SHEET OVERLAY ====== */}
      {showSheet && (
        <>
          {/* Backdrop */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundColor: `rgba(0,0,0,${backdropOp})`,
            zIndex: 50,
          }} />

          {/* Sheet */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 378,
            backgroundColor: 'white',
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            transform: `translateY(${sheetY}px)`,
            display: 'flex', flexDirection: 'column',
            zIndex: 60,
          }}>
            {!showGrantView ? (
              /* Permission configure view */
              <>
                <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Set agent permissions</div>
                </div>

                <div style={{ flex: 1, display: 'flex', gap: 12, padding: '4px 16px', overflow: 'hidden' }}>
                  {/* Token list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '35%', flexShrink: 0 }}>
                    <PermTokenRow symbol="ETH" name="Ethereum" logo="/logos/eth-logo.png" selected={ethPermSel} checked={ethPermCheck} />
                    <PermTokenRow symbol="USDC" name="USD Coin" logo="/logos/usdc-logo.png" selected={usdcPermSel} checked={usdcPermCheck} />
                  </div>

                  {/* Form fields */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <PermFloatingInput label="Spend limit" value={pLim} showCursor={limCur} suffix={limSuffix} />
                    <PermFloatingInput label="Frequency" value={pFreq} showCursor={freqCur} />
                    <PermFloatingInput label="Start date" value={pStart} showCursor={strtCur} />
                    <PermFloatingInput label="End date" value={pEnd} showCursor={endCur} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  flexShrink: 0, borderTop: `1px solid ${GRAY_200}`,
                  padding: '8px 16px', display: 'flex', gap: 8,
                }}>
                  <div style={{
                    height: 32, paddingLeft: 14, paddingRight: 14,
                    borderRadius: 4, border: `2px solid ${RED}`,
                    backgroundColor: 'white', color: RED,
                    fontSize: 10, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    Cancel
                  </div>
                  <div style={{
                    flex: 1, height: 32, borderRadius: 4,
                    backgroundColor: canGrant ? PURPLE : GRAY_300,
                    color: canGrant ? 'white' : GRAY_500,
                    fontSize: 10, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: grantPress ? 'scale(0.97)' : 'scale(1)',
                  }}>
                    Grant permissions
                  </div>
                </div>
              </>
            ) : !showSuccess ? (
              /* Grant processing view */
              <>
                <div style={{ padding: '16px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Grant agent permissions</div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px' }}>
                  <div style={{ width: '100%', maxWidth: 280 }}>
                    {/* Step 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 0' }}>
                      {s1Status === 'loading' ? <GrantSpinner size={16} /> : s1Status === 'completed' ? <StepCheckIcon /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${GRAY_300}` }} />}
                      <span style={{ fontSize: 11, color: s1Status === 'completed' ? GRAY_500 : '#000', fontWeight: 500 }}>
                        1. Grant ERC-7715 permissions
                      </span>
                    </div>
                    {/* Step 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 0' }}>
                      {s2Status === 'loading' ? <GrantSpinner size={16} /> : s2Status === 'completed' ? <StepCheckIcon /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${GRAY_300}` }} />}
                      <span style={{ fontSize: 11, color: s2Status === 'completed' ? GRAY_500 : (s2Status === 'pending' ? GRAY_400 : '#000'), fontWeight: 500 }}>
                        2. Register wallet agent
                      </span>
                    </div>
                    {grantStage && (
                      <div style={{ fontSize: 9, color: GRAY_500, textAlign: 'center', marginTop: 8 }}>
                        {grantStage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  flexShrink: 0, borderTop: `1px solid ${GRAY_200}`,
                  padding: '8px 16px', display: 'flex', gap: 8,
                }}>
                  <div style={{
                    height: 32, paddingLeft: 14, paddingRight: 14,
                    borderRadius: 4, border: `2px solid ${RED}`,
                    backgroundColor: 'white', color: RED,
                    fontSize: 10, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    Back
                  </div>
                  <div style={{
                    flex: 1, height: 32, borderRadius: 4,
                    backgroundColor: PURPLE, color: 'white',
                    fontSize: 10, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <GrantSpinner size={10} color="white" />
                    <span>Processing...</span>
                  </div>
                </div>
              </>
            ) : (
              /* Success view */
              <>
                <div style={{ padding: '16px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Permissions granted!</div>
                </div>
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                }}>
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="20" fill={GREEN} />
                    <path d="M12 20l5 5 11-11" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ fontSize: 10, color: GRAY_600, textAlign: 'center', maxWidth: 240 }}>
                    Your wallet agent permissions have been successfully configured!
                  </div>
                  <div style={{
                    height: 32, paddingLeft: 20, paddingRight: 20,
                    borderRadius: 4, backgroundColor: PURPLE, color: 'white',
                    fontSize: 10, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: frame >= DONE_CLICK ? 'scale(0.97)' : 'scale(1)',
                  }}>
                    Done
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
