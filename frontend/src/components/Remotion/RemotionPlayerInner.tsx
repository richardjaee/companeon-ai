'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { PermissionsSetup } from './PermissionsSetup';
import { PermissionsGrant } from './PermissionsGrant';
import { AgentChat } from './AgentChat';
import { HeroDemo } from './HeroDemo';

type CompositionId = 'permissions-setup' | 'permissions-grant' | 'agent-chat' | 'hero-demo';

interface Props {
  composition: CompositionId;
  durationInFrames: number;
  width: number;
  height: number;
}

const COMPOSITIONS: Record<CompositionId, React.FC> = {
  'permissions-setup': PermissionsSetup,
  'permissions-grant': PermissionsGrant,
  'agent-chat': AgentChat,
  'hero-demo': HeroDemo,
};

const RemotionPlayerInner: React.FC<Props> = ({ composition, durationInFrames, width, height }) => {
  const Component = COMPOSITIONS[composition];

  return (
    <Player
      component={Component}
      compositionWidth={width}
      compositionHeight={height}
      durationInFrames={durationInFrames}
      fps={30}
      loop
      autoPlay
      controls={false}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default RemotionPlayerInner;
