export const LIMITS = {
  username: { min: 3, max: 32, pattern: /^[a-z0-9_]+$/ },
  password: { min: 8, max: 128 },
  displayName: { min: 1, max: 64 },
  bio: { max: 280 },
  groupName: { min: 1, max: 100 },
  messageBody: { max: 4000 },
  groupMembers: { max: 256 },
  attachmentsPerMessage: { max: 10 },
  uploadBytes: { max: 25 * 1024 * 1024 },
  page: { default: 30, max: 100 },
} as const;

export const TIMINGS = {
  presenceTtlSeconds: 30,
  presenceSweepMs: 15_000,
  typingTtlSeconds: 5,
  typingDebounceMs: 300,
  typingThrottleMs: 2_000,
} as const;
