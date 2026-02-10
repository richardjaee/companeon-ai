import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { AbsoluteFill } from 'remotion';

const PURPLE = '#AD29FF';

// Matches LoadingAnimation fallback: rounded-full border-[1px] border-t-transparent border-purple-600 animate-spin
const PurpleSpinner: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const frame = useCurrentFrame();
  const rotation = (frame * 12) % 360;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid #9333ea',
        borderTopColor: 'transparent',
        transform: `rotate(${rotation}deg)`,
        flexShrink: 0,
      }}
    />
  );
};

// Matches StepStatusIcon completed state: /check-circle.png rendered as w-6 h-6
// Approximated as a green circle with white checkmark
const CompletedIcon: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#22c55e" />
    <path d="M7 12l3.5 3.5L17 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface StepRowProps {
  title: string;
  status: 'pending' | 'loading' | 'completed';
  message?: string;
}

// Matches StepList: flex items-start, text-base for title, text-sm text-gray-500 italic for message
const StepRow: React.FC<StepRowProps> = ({ title, status, message }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 16,
            color: status === 'completed' ? '#000' : '#6b7280',
          }}
        >
          {title}
        </span>
        {/* Status icon on right: w-6 h-6 ml-3 */}
        {status === 'loading' && (
          <div style={{ width: 24, height: 24, marginLeft: 12 }}>
            <PurpleSpinner size={24} />
          </div>
        )}
        {status === 'completed' && (
          <div style={{ marginLeft: 12, marginTop: -1 }}>
            <CompletedIcon />
          </div>
        )}
      </div>
      {/* Substage message: text-sm text-gray-500 mt-1 italic */}
      {status === 'loading' && message && (
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>
          {message}
        </p>
      )}
    </div>
  </div>
);

export const PermissionsGrant: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Modal appears
  const modalScale = spring({ frame, fps, from: 0.95, to: 1, config: { damping: 15 } });
  const modalOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Step 1 status
  const step1Status: 'pending' | 'loading' | 'completed' =
    frame < 30 ? 'pending' : frame < 150 ? 'loading' : 'completed';

  // Step 1 substage message (matches GrantPermissionsModal stage messages)
  const step1Message =
    frame < 60 ? 'Waiting for wallet signature...' :
    frame < 90 ? 'Switching to Base...' :
    frame < 150 ? 'Granting ERC-7715 permissions...' : '';

  // Step 2 status
  const step2Actual: 'pending' | 'loading' | 'completed' =
    frame < 150 ? 'pending' : frame < 180 ? 'loading' : 'completed';

  const step2Message =
    frame >= 150 && frame < 180 ? 'Registering wallet agent...' : '';

  // Success view
  const showSuccess = frame >= 210;
  const successOpacity = interpolate(frame, [210, 235], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.5)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Modal: bg-white rounded-lg max-w-lg shadow-xl (matches GrantPermissionsModal) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          width: '88%',
          maxWidth: 400,
          backgroundColor: 'white',
          borderRadius: 8,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          opacity: modalOpacity,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!showSuccess ? (
          <>
            {/* Header: p-8 pb-4, text-xl font-semibold centered */}
            <div style={{ padding: '32px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#000' }}>
                Grant agent permissions
              </span>
            </div>

            {/* Steps: px-8 pt-4 pb-8, space-y-4 */}
            <div style={{ padding: '16px 32px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <StepRow
                  title="1. Grant ERC-7715 permissions"
                  status={step1Status}
                  message={step1Message}
                />
                <StepRow
                  title="2. Register wallet agent"
                  status={step2Actual}
                  message={step2Message}
                />
              </div>
            </div>

            {/* Footer: bg-white border-t border-gray-200 px-6 py-4 */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: 'white',
                borderTop: '1px solid #e5e7eb',
                padding: '16px 24px',
                display: 'flex',
                gap: 12,
              }}
            >
              <div
                style={{
                  height: 48,
                  paddingLeft: 24,
                  paddingRight: 24,
                  borderRadius: 4,
                  border: '2px solid #dc2626',
                  backgroundColor: 'white',
                  color: '#dc2626',
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Back
              </div>
              <div
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 4,
                  backgroundColor: PURPLE,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'wait',
                }}
              >
                <PurpleSpinnerWhite size={16} />
                <span>Processing...</span>
              </div>
            </div>
          </>
        ) : (
          /* Success view - matches GrantPermissionsModal success */
          <div style={{ opacity: successOpacity }}>
            <div style={{ padding: '32px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#000', textAlign: 'center' }}>
                Permissions granted!
              </span>
            </div>
            <div style={{ padding: '16px 32px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 32, textAlign: 'center' }}>
                  Your wallet agent permissions have been successfully configured!
                </p>
                {/* Done button: w-full max-w-xs h-[48px] bg-[#AD29FF] text-white rounded-[4px] */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    height: 48,
                    borderRadius: 4,
                    backgroundColor: PURPLE,
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Done
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// White spinner for the processing button
const PurpleSpinnerWhite: React.FC<{ size?: number }> = ({ size = 16 }) => {
  const frame = useCurrentFrame();
  const rotation = (frame * 12) % 360;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white',
        transform: `rotate(${rotation}deg)`,
        flexShrink: 0,
      }}
    />
  );
};
