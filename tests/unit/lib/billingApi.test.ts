import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/lib/api/core", () => ({
  apiClient: {
    get: vi.fn(),
    post,
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { billingForBranch } from "@/lib/api/billing";
const billing = billingForBranch("west");

describe("billing API client", () => {
  beforeEach(() => {
    post.mockReset();
    vi.stubGlobal("sessionStorage", { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts a same-plan payment-method replacement with an idempotency key", async () => {
    post.mockResolvedValue({ purpose: "REPLACEMENT" });

    await billing.changePaymentMethod("org_123", "/org/org_123/settings#billing");

    expect(post).toHaveBeenCalledWith(
      "/organizations/org_123/billing/subscription/payment-method?branchId=west",
      { returnPath: "/org/org_123/settings#billing" },
      { headers: { "Idempotency-Key": expect.any(String) } }
    );
  });
});
