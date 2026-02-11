'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const PlayerContainer = dynamic(() => import('./RemotionPlayerInner'), { ssr: false });

type CompositionId = 'permissions-setup' | 'permissions-grant' | 'agent-chat' | 'hero-demo';

interface RemotionPlayerProps {
  composition: CompositionId;
}

const COMPOSITION_CONFIG: Record<CompositionId, { durationInFrames: number; width: number; height: number }> = {
  'permissions-setup': { durationInFrames: 270, width: 438, height: 438 },
  'permissions-grant': { durationInFrames: 300, width: 438, height: 438 },
  'agent-chat': { durationInFrames: 450, width: 438, height: 438 },
  'hero-demo': { durationInFrames: 750, width: 960, height: 540 },
};

const RemotionPlayer: React.FC<RemotionPlayerProps> = ({ composition }) => {
  const config = COMPOSITION_CONFIG[composition];
  const isHero = composition === 'hero-demo';

  return (
    <div style={{
      width: isHero ? '100%' : 438,
      height: isHero ? undefined : 438,
      aspectRatio: isHero ? `${config.width} / ${config.height}` : undefined,
      borderRadius: isHero ? 0 : 12,
      overflow: 'hidden',
      backgroundColor: isHero ? 'transparent' : '#f5f5f5',
      border: isHero ? 'none' : '1px solid #e5e7eb',
      boxShadow: isHero ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <PlayerContainer composition={composition} durationInFrames={config.durationInFrames} width={config.width} height={config.height} />
    </div>
  );
};

export default RemotionPlayer;
