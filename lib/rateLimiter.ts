// R3 Policy 5.1.8 — In-memory rate limiter per order_id (10 requests/min)
// Suitable for single-instance deployments. For multi-instance, use Redis.

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per window per order_id

// Clean up expired entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

/**
 * R3 Policy 5.1.8 — Rate limiter per order_id
 * @param orderId - The order ID to rate limit
 * @returns { allowed: boolean, remaining: number }
 */
export function checkRateLimit(orderId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(orderId);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(orderId, {
      count: 1,
      resetTime: now + WINDOW_MS,
    });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}
