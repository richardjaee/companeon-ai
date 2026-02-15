'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { schedulesApi, Schedule, ScheduleExecutionResult, ExecutionStep } from '@/lib/api/schedules';

const HISTORY_PAGE_SIZE = 10;

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

function formatFrequency(freq: string, scheduledTime?: string | null, tz?: string | null): string {
  let base: string;
  switch (freq) {
    case 'hourly': base = 'Every hour'; break;
    case 'daily': base = 'Daily'; break;
    case 'weekly': base = 'Weekly'; break;
    case 'test': base = 'Test (1 min)'; break;
    default: base = freq;
  }
  if (scheduledTime && freq !== 'test') {
    const [h, m] = scheduledTime.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const timeStr = `${h12}:${String(m).padStart(2, '0')} ${period}`;
    base += ` at ${timeStr}`;
    if (tz) {
      const short = tz.replace('America/', '').replace('Europe/', '').replace('_', ' ');
      base += ` (${short})`;
    }
  }
  return base;
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

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60 * 1000) return 'just now';
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 3600000)}h ago`;
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 86400000)}d ago`;
  return date.toLocaleDateString();
}

function StepsList({ steps }: { steps: ExecutionStep[] }) {
  const [showSteps, setShowSteps] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setShowSteps(!showSteps)}
        className="text-xs text-blue-500 hover:text-blue-700"
      >
        {showSteps ? 'Hide trace' : `View trace (${steps.length} steps)`}
      </button>
      {showSteps && (
        <div className="mt-1 pl-3 border-l-2 border-gray-200 space-y-0.5">
          {steps.map((step, i) => (
            <div key={i} className="text-xs text-gray-500">
              <span className="text-gray-600 font-medium">{step.action}</span>
              {step.detail && (
                <span className="ml-1 text-gray-400 break-all">{step.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutionDetail({ exec, scheduleType }: { exec: ScheduleExecutionResult; scheduleType: string }) {
  if (scheduleType === 'transfer' && exec.success) {
    if (exec.amount && exec.token) {
      const recipientShort = exec.recipient ? `${exec.recipient.slice(0, 8)}...${exec.recipient.slice(-4)}` : '';
      return (
        <span className="text-xs text-gray-500">
          Sent {exec.amount} {exec.token}{recipientShort ? ` to ${recipientShort}` : ''}
        </span>
      );
    }
  }

  if (scheduleType === 'dca' && exec.success) {
    if (exec.buyAmount && exec.toToken) {
      return (
        <span className="text-xs text-gray-500">
          {exec.sellAmount ? `Sold ${exec.sellAmount} ${exec.fromToken || ''}` : ''}{exec.sellAmount ? ' | ' : ''}Received {Number(exec.buyAmount).toFixed(6)} {exec.toToken}
        </span>
      );
    }
  }

  if (scheduleType === 'rebalancing') {
    if (exec.skipped) {
      const reasons: Record<string, string> = {
        within_threshold: `Within threshold (${exec.maxDeviation?.toFixed(1)}% deviation)`,
        no_balances: 'No balances found',
        zero_portfolio_value: 'Zero portfolio value',
        no_swaps_needed: 'No swaps needed'
      };
      return (
        <span className="text-xs text-yellow-600">
          Skipped: {reasons[exec.reason || ''] || exec.reason || 'unknown'}
        </span>
      );
    }
    if (exec.swaps && exec.swaps.length > 0) {
      return (
        <div className="text-xs text-gray-500 space-y-0.5">
          {exec.swaps.map((swap, i) => (
            <div key={i} className="flex items-center gap-1">
              <span>{swap.sellAmount} {swap.sellToken} -{'>'} {swap.buyToken}</span>
              {swap.valueUsd && <span className="text-gray-400">(~${swap.valueUsd.toFixed(2)})</span>}
              {swap.txHash && (
                <span className="font-mono text-gray-400">{swap.txHash.slice(0, 8)}...{swap.txHash.slice(-4)}</span>
              )}
              {swap.error && <span className="text-red-500">{swap.error}</span>}
            </div>
          ))}
        </div>
      );
    }
  }

  return null;
}

function ExecutionRow({ exec, scheduleType }: { exec: ScheduleExecutionResult; scheduleType: string }) {
  const txShort = exec.txHash ? `${exec.txHash.slice(0, 8)}...${exec.txHash.slice(-6)}` : null;

  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            exec.skipped ? 'bg-yellow-400' : exec.success ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-xs text-gray-600">
            #{exec.executionNumber}
          </span>
          {exec.executedAt && (
            <span className="text-xs text-gray-400">
              {formatTimeAgo(exec.executedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exec.error && (
            <span className="text-xs text-red-500 max-w-[180px] truncate" title={exec.error}>
              {exec.error}
            </span>
          )}
          {txShort && (
            <span className="text-xs font-mono text-gray-400">{txShort}</span>
          )}
          {exec.gasUsed && (
            <span className="text-xs text-gray-400">{Number(exec.gasUsed).toLocaleString()} gas</span>
          )}
        </div>
      </div>
      <div className="mt-1 pl-4">
        <ExecutionDetail exec={exec} scheduleType={scheduleType} />
        <StepsList steps={exec.steps || []} />
      </div>
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);

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
  const history = (schedule.executionHistory || []).slice().reverse();
  const hasHistory = history.length > 0;
  const visibleHistory = history.slice(0, visibleCount);
  const hasMore = history.length > visibleCount;

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="p-4">
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
            <span>{formatFrequency(schedule.frequency, schedule.scheduledTime, schedule.timezone)}</span>
            <span>Runs: {execProgress}</span>
            {schedule.status === 'active' && (
              <span>Next: {formatNextRun(schedule.nextRunAt)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastSuccess !== undefined && (
              <span className={lastSuccess ? 'text-green-600' : 'text-red-600'}>
                {lastSuccess ? 'Last: OK' : 'Last: Failed'}
              </span>
            )}
            {hasHistory && (
              <button
                onClick={() => { setExpanded(!expanded); setVisibleCount(HISTORY_PAGE_SIZE); }}
                className="text-gray-400 hover:text-gray-600 ml-1"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && hasHistory && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Execution History ({history.length})
          </p>
          <div className="max-h-96 overflow-y-auto">
            {visibleHistory.map((exec, i) => (
              <ExecutionRow key={i} exec={exec} scheduleType={schedule.type} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => prev + HISTORY_PAGE_SIZE)}
              className="mt-2 w-full text-center text-xs text-blue-500 hover:text-blue-700 py-1"
            >
              Show more ({history.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
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
