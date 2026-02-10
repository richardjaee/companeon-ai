'use client';

import React from 'react';
import { Player } from '@remotion/player';
import { PermissionsSetup } from './PermissionsSetup';
import { PermissionsGrant } from './PermissionsGrant';
import { AgentChat } from './AgentChat';

type CompositionId = 'permissions-setup' | 'permissions-grant' | 'agent-chat';

interface Props {
  composition: CompositionId;
  durationInFrames: number;
}

const COMPOSITIONS: Record<CompositionId, React.FC> = {
  'permissions-setup': PermissionsSetup,
  'permissions-grant': PermissionsGrant,
  'agent-chat': AgentChat,
};

const RemotionPlayerInner: React.FC<Props> = ({ composition, durationInFrames }) => {
  const Component = COMPOSITIONS[composition];

  return (
    <Player
      component={Component}
      compositionWidth={438}
      compositionHeight={438}
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
