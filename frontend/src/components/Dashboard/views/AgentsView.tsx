'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { schedulesApi, Schedule } from '@/lib/api/schedules';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    executing: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700'
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    transfer: 'bg-purple-50 text-purple-700',
    dca: 'bg-indigo-50 text-indigo-700',
    rebalancing: 'bg-teal-50 text-teal-700'
  };
  const labels: Record<string, string> = {
    transfer: 'Transfer',
    dca: 'DCA',
    rebalancing: 'Rebalancing'
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      styles[type] || 'bg-gray-50 text-gray-700'
    }`}>
      {labels[type] || type}
    </span>
  );
}

function formatFrequency(freq: string): string {
  switch (freq) {
    case 'hourly': return 'Every hour';
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'test': return 'Test (1 min)';
    default: return freq;
  }
}

function formatNextRun(nextRunAt: string | null): string {
  if (!nextRunAt) return '-';
  const date = new Date(nextRunAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) return 'Due now';
  if (diffMs < 60 * 60 * 1000) return `in ${Math.ceil(diffMs / 60000)} min`;
  if (diffMs < 24 * 60 * 60 * 1000) return `in ${Math.ceil(diffMs / 3600000)}h`;
  return date.toLocaleDateString();
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  let description: string;
  if (schedule.type === 'transfer') {
    description = `${schedule.amount} ${schedule.token} to ${schedule.recipientENS || schedule.recipient?.slice(0, 10) + '...'}`;
  } else if (schedule.type === 'rebalancing') {
    description = Object.entries(schedule.targetAllocations || {})
      .map(([token, pct]) => `${pct}% ${token}`)
      .join(' / ');
  } else {
    description = `${schedule.amount} ${schedule.fromToken} to ${schedule.toToken}`;
  }

  const execProgress = schedule.maxExecutions
    ? `${schedule.executionCount}/${schedule.maxExecutions}`
    : `${schedule.executionCount}`;

  const lastSuccess = schedule.lastResult?.success;

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={schedule.type} />
          <h3 className="text-sm font-bold text-gray-900">{schedule.name}</h3>
        </div>
        <StatusBadge status={schedule.status} />
      </div>

      <p className="text-sm text-gray-700 mb-3">{description}</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>{formatFrequency(schedule.frequency)}</span>
          <span>Runs: {execProgress}</span>
          {schedule.status === 'active' && (
            <span>Next: {formatNextRun(schedule.nextRunAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {lastSuccess !== undefined && (
            <span className={lastSuccess ? 'text-green-600' : 'text-red-600'}>
              {lastSuccess ? 'Last: OK' : 'Last: Failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentsView() {
  const { address } = useUnifiedWallet();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchSchedules = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const data = await schedulesApi.getSchedules(address, showCompleted);
      setSchedules(data.schedules);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address, showCompleted]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const activeCount = schedules.filter(s => s.status === 'active' || s.status === 'executing').length;

  return (
    <div className="flex flex-col h-[calc(100vh-176px)] bg-white">
      <div className="pb-6 mt-10 px-6">
        <h1 className="text-4xl font-medium text-gray-900">Agents</h1>
        <p className="mt-2 text-sm text-gray-500">
          Active automations running with your wallet permissions.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No automations yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Tell Companeon to set up a recurring transfer, DCA strategy, or portfolio rebalancing in chat. Your active automations will appear here.
            </p>
          </div>
        ) : (
          <>
            {activeCount > 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <span className="font-bold">{activeCount}</span> automation{activeCount !== 1 ? 's' : ''} running
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Schedules</h2>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {showCompleted ? 'Hide completed' : 'Show completed'}
              </button>
            </div>

            <div className="space-y-3 pb-6">
              {schedules.map(schedule => (
                <ScheduleCard key={schedule.scheduleId} schedule={schedule} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
