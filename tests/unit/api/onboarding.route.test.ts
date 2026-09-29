import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingRequestError } from "@/lib/onboardingRequest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createNetwork: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));

vi.mock("@/lib/auth", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/services/onboarding.service", () => ({
  OnboardingService: {
    createNetwork: mocks.createNetwork,
  },
}));

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ userId: "clerk_owner_1" });
    mocks.getSessionUser.mockResolvedValue({ id: "user_1", email: "owner@test.com" });
  });

  const key = "11111111-1111-4111-8111-111111111111";
  const validBody = { orgName: "Bright Academy", ownerPhone: "9876543210", branchName: "Main Hall", seatCount: 1, selectedPostTrialPlan: "BASIC" };
  function request(body: unknown, headers: Record<string, string> = {}) {
    return new Request("http://test.local/api/onboarding", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", "Idempotency-Key": key, "X-Onboarding-Account": "clerk_owner_1", ...headers },
    });
  }

  it("passes custom seat numbering to the service", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user_1", email: "owner@test.com" });
    mocks.createNetwork.mockResolvedValue({ org: { id: "org_1", contactPhone: "private" }, branch: { id: "branch_1", name: "private" } });
    const { POST } = await import("@/app/api/onboarding/route");

    const seatNumbering = {
      mode: "RANGE",
      ranges: [
        { prefix: "A", start: 1, end: 2, separator: "" },
        { prefix: "B", start: 1, end: 1, separator: "" },
      ],
    };
    const response = await POST(request({
      orgName: "Bright Academy",
      ownerPhone: "9876543210",
      branchName: "Main Hall",
      seatCount: 3,
      seatNumbering,
      selectedPostTrialPlan: "PRO",
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ org: { id: "org_1" }, branch: { id: "branch_1" } });
    expect(mocks.createNetwork).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_1",
      idempotencyKey: key,
      ownerPhone: "+91 98765 43210",
      seatCount: 3,
      seatNumbering,
      selectedPostTrialPlan: "PRO",
    }));
  });

  it("rejects seat numbering that does not match total seats", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user_1", email: "owner@test.com" });
    const { POST } = await import("@/app/api/onboarding/route");

    const response = await POST(request({
      orgName: "Bright Academy",
      ownerPhone: "9876543210",
      branchName: "Main Hall",
      selectedPostTrialPlan: "BASIC",
      seatCount: 4,
      seatNumbering: {
        mode: "RANGE",
        ranges: [{ prefix: "A", start: 1, end: 3, separator: "" }],
      },
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Seat numbering creates 3 labels, but total seats is 4.",
      code: "ONBOARDING_INVALID_REQUEST",
    });
    expect(mocks.createNetwork).not.toHaveBeenCalled();
  });

  it.each([undefined, "AGENT_CONTROL", "CUSTOM", "STANDARD", "PRO<script>"])(
    "rejects an invalid post-trial plan identifier: %s",
    async selectedPostTrialPlan => {
      mocks.getSessionUser.mockResolvedValue({ id: "user_1", email: "owner@test.com" });
      const { POST } = await import("@/app/api/onboarding/route");

      const response = await POST(request({
        orgName: "Bright Academy",
        ownerPhone: "9876543210",
        branchName: "Main Hall",
        seatCount: 1,
        seatNumbering: { mode: "SIMPLE" },
        selectedPostTrialPlan,
      }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Choose Basic or Standard as the post-trial plan.",
        code: "ONBOARDING_INVALID_REQUEST",
      });
      expect(mocks.createNetwork).not.toHaveBeenCalled();
    }
  );

  it.each(["", "invalid", "1".repeat(1000)])("rejects absent/malformed keys before session synchronization or setup", async value => {
    const { POST } = await import("@/app/api/onboarding/route");
    const response = await POST(request(validBody, { "Idempotency-Key": value }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "ONBOARDING_INVALID_KEY" });
    expect(mocks.getSessionUser).not.toHaveBeenCalled();
    expect(mocks.createNetwork).not.toHaveBeenCalled();
  });

  it("rejects an old client with no request-key header before session synchronization", async () => {
    const { POST } = await import("@/app/api/onboarding/route");
    const input = request(validBody);
    input.headers.delete("Idempotency-Key");
    input.headers.delete("X-Onboarding-Account");
    const response = await POST(input);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "ONBOARDING_INVALID_KEY" });
    expect(mocks.getSessionUser).not.toHaveBeenCalled();
    expect(mocks.createNetwork).not.toHaveBeenCalled();
  });

  it.each(["", "clerk_other_owner"])("rejects a missing or switched account precondition without writes", async account => {
    const { POST } = await import("@/app/api/onboarding/route");
    const response = await POST(request(validBody, { "X-Onboarding-Account": account }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ONBOARDING_ACCOUNT_CHANGED" });
    expect(mocks.getSessionUser).not.toHaveBeenCalled();
    expect(mocks.createNetwork).not.toHaveBeenCalled();
  });

  it("requires current authentication even with matching-looking headers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const { POST } = await import("@/app/api/onboarding/route");
    expect((await POST(request(validBody))).status).toBe(401);
    expect(mocks.getSessionUser).not.toHaveBeenCalled();
    expect(mocks.createNetwork).not.toHaveBeenCalled();
  });

  it("uses only the authenticated internal owner, not request identity fields", async () => {
    mocks.createNetwork.mockResolvedValue({ org: { id: "org_1" }, branch: { id: "branch_1" } });
    const { POST } = await import("@/app/api/onboarding/route");
    expect((await POST(request({ ...validBody, userId: "foreign", ownerId: "foreign" }))).status).toBe(201);
    expect(mocks.createNetwork).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_1" }));
  });

  it.each([
    ["ONBOARDING_KEY_CONFLICT", 409], ["ONBOARDING_RESULT_NOT_FOUND", 404], ["ONBOARDING_UNAVAILABLE", 503],
  ] as const)("preserves typed %s failures", async (code, status) => {
    mocks.createNetwork.mockRejectedValue(new OnboardingRequestError(code, "Safe response", status));
    const { POST } = await import("@/app/api/onboarding/route");
    const response = await POST(request(validBody));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Safe response", code });
  });

  it("does not echo or log unexpected database details", async () => {
    mocks.createNetwork.mockRejectedValue(new Error("Private query parameters and phone"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { POST } = await import("@/app/api/onboarding/route");
      const response = await POST(request(validBody));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Failed to complete setup. Retry the same setup request.", code: "ONBOARDING_FAILED" });
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it.each([null, [], { ...validBody, shifts: [null] }, { ...validBody, multiShifts: [null] }])("rejects malformed payload shapes without setup", async body => {
    const { POST } = await import("@/app/api/onboarding/route");
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "ONBOARDING_INVALID_REQUEST" });
    expect(mocks.createNetwork).not.toHaveBeenCalled();
  });
});
