import { afterEach, describe, expect, it, vi } from "vitest";
import {
  areRazorpayBillingWritesEnabled,
  areRazorpayMultiMethodSubscriptionsEnabled,
  assertRazorpayBillingWritesEnabled,
  BillingWritesDisabledError,
  getRazorpayCheckoutMethodAvailability,
  RAZORPAY_BILLING_WRITES_FLAG,
  RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_FLAG,
} from "@/lib/billingFeature";

afterEach(() => vi.unstubAllEnvs());

describe("Razorpay emergency write pause", () => {
  it("allows configured installations to operate by default", () => {
    vi.stubEnv(RAZORPAY_BILLING_WRITES_FLAG, undefined);
    expect(areRazorpayBillingWritesEnabled()).toBe(true);
  });

  it.each(["false", "", "invalid"])("holds all writes when configured as %j", value => {
    vi.stubEnv(RAZORPAY_BILLING_WRITES_FLAG, value);
    vi.stubEnv("RAZORPAY_LIVE_CANARY_ORG_IDS", "old-canary");
    expect(() => assertRazorpayBillingWritesEnabled()).toThrow(BillingWritesDisabledError);
  });
});

describe("Razorpay multi-method subscriptions feature flag", () => {
  it("is disabled by default", () => {
    vi.stubEnv(RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_FLAG, undefined);
    expect(areRazorpayMultiMethodSubscriptionsEnabled()).toBe(false);
    expect(getRazorpayCheckoutMethodAvailability()).toEqual({
      mode: "CARD_ONLY",
      potentialMethods: ["CARD"],
      providerControlsVisibility: false,
    });
  });

  it("is enabled only by an explicit true value", () => {
    vi.stubEnv(RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_FLAG, " TRUE ");
    expect(areRazorpayMultiMethodSubscriptionsEnabled()).toBe(true);
    expect(getRazorpayCheckoutMethodAvailability()).toEqual({
      mode: "PROVIDER_MANAGED",
      potentialMethods: ["CARD", "UPI", "EMANDATE"],
      providerControlsVisibility: true,
    });

    vi.stubEnv(RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_FLAG, "false");
    expect(areRazorpayMultiMethodSubscriptionsEnabled()).toBe(false);
  });
});
