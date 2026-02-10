'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const PlayerContainer = dynamic(() => import('./RemotionPlayerInner'), { ssr: false });

type CompositionId = 'permissions-setup' | 'permissions-grant' | 'agent-chat';

interface RemotionPlayerProps {
  composition: CompositionId;
}

const COMPOSITION_CONFIG: Record<CompositionId, { durationInFrames: number }> = {
  'permissions-setup': { durationInFrames: 270 },
  'permissions-grant': { durationInFrames: 300 },
  'agent-chat': { durationInFrames: 450 },
};

const RemotionPlayer: React.FC<RemotionPlayerProps> = ({ composition }) => {
  const config = COMPOSITION_CONFIG[composition];

  return (
    <div style={{ width: 438, height: 438, maxWidth: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#f5f5f5', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <PlayerContainer composition={composition} durationInFrames={config.durationInFrames} />
    </div>
  );
};

export default RemotionPlayer;
