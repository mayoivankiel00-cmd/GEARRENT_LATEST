// Client-side attempt limiter (brute-force friction + friendlier UX).
// This is NOT the security boundary — Supabase Auth enforces its own
// server-side rate limits (Authentication → Rate Limits in the dashboard) and
// the database throttles publishing / admin actions. This just stops the UI
// from hammering those limits and tells the user how long to wait.

function readState(storageKey) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    return value && typeof value === 'object' ? value : { failures: [], lockedUntil: 0, lockCount: 0 };
  } catch {
    return { failures: [], lockedUntil: 0, lockCount: 0 };
  }
}

function writeState(storageKey, state) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode) — limiter degrades to per-page memory.
  }
}

export function createAttemptLimiter(name, {
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  baseLockMs = 30 * 1000,
  maxLockMs = 15 * 60 * 1000,
} = {}) {
  const storageKey = `gearrent-limit:${name}`;

  return {
    // Milliseconds until another attempt is allowed (0 = allowed now).
    remainingLockMs() {
      const state = readState(storageKey);
      return Math.max(0, (state.lockedUntil || 0) - Date.now());
    },

    recordFailure() {
      const now = Date.now();
      const state = readState(storageKey);
      state.failures = (state.failures || []).filter((time) => now - time < windowMs);
      state.failures.push(now);
      if (state.failures.length >= maxAttempts) {
        // Exponential back-off: 30s, 60s, 2m, 4m ... capped at maxLockMs.
        const lockMs = Math.min(maxLockMs, baseLockMs * 2 ** (state.lockCount || 0));
        state.lockedUntil = now + lockMs;
        state.lockCount = (state.lockCount || 0) + 1;
        state.failures = [];
      }
      writeState(storageKey, state);
      return Math.max(0, state.lockedUntil - now);
    },

    // Force a lock, e.g. when the server answered 429.
    lockFor(ms) {
      const state = readState(storageKey);
      state.lockedUntil = Math.max(state.lockedUntil || 0, Date.now() + ms);
      writeState(storageKey, state);
    },

    reset() {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    },
  };
}

export function formatWait(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function isRateLimitError(error) {
  if (!error) return false;
  const message = `${error.message || ''} ${error.hint || ''} ${error.code || ''}`.toLowerCase();
  return error.status === 429 || message.includes('rate limit') || message.includes('rate_limited')
    || message.includes('too many');
}
