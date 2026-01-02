'use client';

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type AutoTxMode = 'ask' | 'auto';
export type X402Mode = 'off' | 'ask' | 'auto';

export interface AgentControls {
  autoTxMode: AutoTxMode;
  x402Mode: X402Mode;
}

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  controls: AgentControls;
  onSave: (controls: AgentControls) => void;
}

export default function AgentSettingsModal({
  isOpen,
  onClose,
  controls,
  onSave
}: AgentSettingsModalProps) {
  const [localControls, setLocalControls] = React.useState<AgentControls>(controls);

  React.useEffect(() => {
    setLocalControls(controls);
  }, [controls]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localControls);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[4px] shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">Agent settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="px-6 pt-4 pb-6 space-y-8 overflow-y-auto flex-1">
          {/* Transaction Mode */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-0">Transaction execution</h3>
            <p className="text-sm text-gray-600 mb-4 mt-0">
              Control how the agent handles on-chain transactions
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-[4px] cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="autoTxMode"
                  value="ask"
                  checked={localControls.autoTxMode === 'ask'}
                  onChange={(e) => setLocalControls({ ...localControls, autoTxMode: e.target.value as AutoTxMode })}
                  className="mt-1 w-4 h-4 accent-[#AD29FF]"
                  style={{ accentColor: '#AD29FF' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">Ask for permission</div>
                  <div className="text-sm text-gray-600 mt-0">
                    Agent will request approval before submitting any transaction to the blockchain
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-[4px] cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="autoTxMode"
                  value="auto"
                  checked={localControls.autoTxMode === 'auto'}
                  onChange={(e) => setLocalControls({ ...localControls, autoTxMode: e.target.value as AutoTxMode })}
                  className="mt-1 w-4 h-4 accent-[#AD29FF]"
                  style={{ accentColor: '#AD29FF' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">Auto execute</div>
                  <div className="text-sm text-gray-600 mt-0">
                    Agent will automatically submit transactions without asking. Use with caution!
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* x402 Mode */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-0">Paid API access (x402)</h3>
            <p className="text-sm text-gray-600 mb-4 mt-0">
              Control if the agent can use paid APIs for enhanced capabilities
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-[4px] cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="x402Mode"
                  value="off"
                  checked={localControls.x402Mode === 'off'}
                  onChange={(e) => setLocalControls({ ...localControls, x402Mode: e.target.value as X402Mode })}
                  className="mt-1 w-4 h-4 accent-[#AD29FF]"
                  style={{ accentColor: '#AD29FF' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">Disabled</div>
                  <div className="text-sm text-gray-600 mt-0">
                    Agent will not use any paid APIs, even if they would improve results
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-[4px] cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="x402Mode"
                  value="ask"
                  checked={localControls.x402Mode === 'ask'}
                  onChange={(e) => setLocalControls({ ...localControls, x402Mode: e.target.value as X402Mode })}
                  className="mt-1 w-4 h-4 accent-[#AD29FF]"
                  style={{ accentColor: '#AD29FF' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">Ask before using</div>
                  <div className="text-sm text-gray-600 mt-0">
                    Agent will ask for permission before using paid APIs and show estimated costs
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-[4px] cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="x402Mode"
                  value="auto"
                  checked={localControls.x402Mode === 'auto'}
                  onChange={(e) => setLocalControls({ ...localControls, x402Mode: e.target.value as X402Mode })}
                  className="mt-1 w-4 h-4 accent-[#AD29FF]"
                  style={{ accentColor: '#AD29FF' }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">Auto approve</div>
                  <div className="text-sm text-gray-600 mt-0">
                    Agent will automatically use paid APIs when beneficial. Costs will be charged to your account.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer - Sticky */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-[4px]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-[4px] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-[#AD29FF] rounded-[4px] hover:bg-[#9d24e6] transition-colors"
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
