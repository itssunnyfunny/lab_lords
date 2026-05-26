import { describe, expect, it } from "vitest";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rateLimit";

describe("rateLimit", () => {
  it("allows requests within the configured window", () => {
    const key = "rate-limit:test:within-window";
    const options = { limit: 2, windowMs: 1000 };

    expect(checkRateLimit(key, options, 1000)).toEqual({ allowed: true, retryAfter: 0 });
    expect(checkRateLimit(key, options, 1100)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it("blocks requests after the limit until the window resets", () => {
    const key = "rate-limit:test:blocked";
    const options = { limit: 1, windowMs: 1000 };

    expect(checkRateLimit(key, options, 2000).allowed).toBe(true);
    expect(checkRateLimit(key, options, 2100)).toEqual({ allowed: false, retryAfter: 1 });
    expect(checkRateLimit(key, options, 3001).allowed).toBe(true);
  });

  it("uses actor ids before forwarded IPs for keys", () => {
    const request = new Request("https://lablords.in/api", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });

    expect(getRequestRateLimitKey(request, "feedback", "user_123")).toBe("feedback:user_123");
    expect(getRequestRateLimitKey(request, "feedback")).toBe("feedback:203.0.113.10");
  });
});
