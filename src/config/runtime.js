export const RUNTIME = {
  // Default hard-kill around 2 minutes for full tasks
  TIMEOUT_TASK_MS: Number(process.env.TIMEOUT_TASK_MS || 120000),
  TIMEOUT_MODEL_MS: Number(process.env.TIMEOUT_MODEL_MS || 30000),
  TIMEOUT_TOOL_MS: Number(process.env.TIMEOUT_TOOL_MS || 20000),
  REQUEST_TIMEOUT_MS: Number(process.env.REQUEST_TIMEOUT_MS || 125000),
  HEARTBEAT_MS: Number(process.env.HEARTBEAT_MS || 5000),
  // If true, planner may attempt simulate/estimateGas before sending swaps; set to false to execute directly
  SIMULATE_SWAPS: String(process.env.SWAP_SIMULATE || '').toLowerCase() === 'true'
};
