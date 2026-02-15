import { apiClient } from './apiClient';

export interface ExecutionStep {
  action: string;
  detail?: string;
  timestamp: string;
}

export interface ExecutionSwap {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  valueUsd?: number;
  txHash?: string;
  gasUsed?: string;
  error?: string;
}

export interface ScheduleExecutionResult {
  success: boolean;
  txHash?: string;
  gasUsed?: string;
  executedAt?: string;
  executionNumber?: number;
  error?: string;
  // Transfer-specific
  amount?: string;
  token?: string;
  recipient?: string;
  // DCA-specific
  buyAmount?: string;
  fromToken?: string;
  toToken?: string;
  sellAmount?: string;
  // Rebalancing-specific
  skipped?: boolean;
  reason?: string;
  maxDeviation?: number;
  swaps?: ExecutionSwap[];
  // Execution trace
  steps?: ExecutionStep[];
}

export interface Schedule {
  scheduleId: string;
  type: 'transfer' | 'dca' | 'rebalancing';
  name: string;
  status: 'active' | 'paused' | 'executing' | 'completed' | 'cancelled';
  // Transfer fields
  token?: string;
  amount?: string;
  recipient?: string;
  recipientENS?: string | null;
  // DCA fields
  fromToken?: string;
  toToken?: string;
  // Rebalancing fields
  targetAllocations?: Record<string, number>;
  thresholdPercent?: number;
  // Common
  frequency: string;
  scheduledTime?: string | null;
  timezone?: string | null;
  executionCount: number;
  maxExecutions: number | null;
  nextRunAt: string | null;
  lastExecutionAt: number | null;
  lastResult: ScheduleExecutionResult | null;
  executionHistory?: ScheduleExecutionResult[];
  expiresAt: number | null;
  createdAt: string | null;
}

export const schedulesApi = {
  getSchedules: async (walletAddress: string, includeCompleted = false): Promise<{ schedules: Schedule[]; count: number }> => {
    return apiClient.get('SCHEDULES_LIST', {
      wallet: walletAddress,
      includeCompleted: String(includeCompleted)
    });
  }
};
