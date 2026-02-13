import { apiClient } from './apiClient';

export interface ScheduleExecutionResult {
  success: boolean;
  txHash?: string;
  gasUsed?: string;
  executedAt?: string;
  executionNumber?: number;
  error?: string;
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
  executionCount: number;
  maxExecutions: number | null;
  nextRunAt: string | null;
  lastExecutionAt: number | null;
  lastResult: ScheduleExecutionResult | null;
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
