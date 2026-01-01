export function withTimeout(promise, ms, label = 'operation') {
  let t;
  const timer = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    timer
  ]);
}

// Like withTimeout, but emits heartbeat logs while waiting and hard-aborts at ms
export function withTimeoutAndHeartbeat(promise, ms, label, logger, heartbeatMs = 5000) {
  let timeoutId;
  let intervalId;
  const start = Date.now();
  const timer = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (logger) logger.warn('timeout_abort', { label, waitedMs: Date.now() - start });
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    if (logger && heartbeatMs > 0) {
      intervalId = setInterval(() => {
        const waited = Date.now() - start;
        logger.info('heartbeat_waiting', { label, waitedMs: waited });
      }, Math.min(heartbeatMs, Math.max(1000, Math.floor(ms / 10))));
    }
  });
  const wrapped = Promise.race([
    promise,
    timer
  ]);
  return wrapped.finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
  });
}
