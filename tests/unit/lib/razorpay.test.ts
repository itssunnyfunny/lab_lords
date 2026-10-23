import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getRazorpayKeyId,
  getRazorpayClient,
  getRazorpayPlanCatalogClient,
  hmacSha256Hex,
  parseRazorpayKeyMode,
  RazorpayConfigurationError,
  resolveRazorpayMode,
  toRazorpaySubunits,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
  verifyRazorpayWebhookSignature,
  type RazorpayInvoice,
} from "@/lib/razorpay";

describe("razorpay security helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("converts INR major units to paise", () => {
    expect(toRazorpaySubunits(1200, "INR")).toBe(120000);
  });

  it("accepts local test key aliases", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_TEST_KEY_ID", "");
    vi.stubEnv("TEST_API_KEY", "");
    vi.stubEnv("Test_API_Key", "rzp_test_alias");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    vi.stubEnv("RAZORPAY_TEST_KEY_SECRET", "");
    vi.stubEnv("TEST_KEY_SECRET", "");
    vi.stubEnv("Test_Key_Secret", "secret");
    const signature = hmacSha256Hex("pay_456|sub_123", "secret");

    expect(getRazorpayKeyId()).toBe("rzp_test_alias");
    expect(verifyRazorpaySubscriptionSignature({
      subscriptionId: "sub_123",
      paymentId: "pay_456",
      signature,
    })).toBe(true);
  });

  it("accepts the public checkout Key ID without exposing the Key Secret", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_public_alias");

    expect(getRazorpayKeyId()).toBe("rzp_test_public_alias");
  });

  it("requires the server-only key and rejects deployed aliases on Vercel", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_public_only");
    expect(() => getRazorpayKeyId()).toThrow("RAZORPAY_KEY_ID must be configured as a server-only variable");

    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_server");
    expect(() => getRazorpayKeyId()).toThrow("NEXT_PUBLIC_RAZORPAY_KEY_ID is not supported");

    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_server");
    expect(() => getRazorpayKeyId()).toThrow("NEXT_PUBLIC_RAZORPAY_KEY_ID is not supported");

    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "");
    expect(getRazorpayKeyId()).toBe("rzp_test_server");
  });

  it("derives Test and Live provider modes only from valid Razorpay key prefixes", () => {
    expect(parseRazorpayKeyMode("rzp_test_example")).toBe("TEST");
    expect(parseRazorpayKeyMode("rzp_live_example")).toBe("LIVE");
    expect(() => parseRazorpayKeyMode("plan_example")).toThrow(RazorpayConfigurationError);
  });

  it("requires an explicit mode matching both the key and Vercel environment", () => {
    expect(resolveRazorpayMode({
      RAZORPAY_MODE: "TEST",
      RAZORPAY_KEY_ID: "rzp_test_example",
      VERCEL_ENV: "preview",
    })).toBe("TEST");
    expect(resolveRazorpayMode({
      RAZORPAY_MODE: "LIVE",
      RAZORPAY_KEY_ID: "rzp_live_example",
      VERCEL_ENV: "production",
    })).toBe("LIVE");

    expect(() => resolveRazorpayMode({
      RAZORPAY_KEY_ID: "rzp_test_example",
      VERCEL_ENV: "preview",
    })).toThrow("RAZORPAY_MODE must be explicitly set");
    expect(() => resolveRazorpayMode({
      RAZORPAY_MODE: "LIVE",
      RAZORPAY_KEY_ID: "rzp_test_example",
      VERCEL_ENV: "production",
    })).toThrow("does not match");
    expect(() => resolveRazorpayMode({
      RAZORPAY_MODE: "TEST",
      RAZORPAY_KEY_ID: "rzp_test_example",
      VERCEL_ENV: "production",
    })).toThrow("Vercel Production requires RAZORPAY_MODE=LIVE");
    expect(() => resolveRazorpayMode({
      RAZORPAY_MODE: "LIVE",
      RAZORPAY_KEY_ID: "rzp_live_example",
      VERCEL_ENV: "preview",
    })).toThrow("Vercel preview requires RAZORPAY_MODE=TEST");
  });

  it("classifies provider responses so only a confirmed 404 is reprovisionable", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { description: "missing" } }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )));

    await expect(getRazorpayPlanCatalogClient().fetchPlan("plan_missing"))
      .rejects.toMatchObject({ kind: "NOT_FOUND", status: 404 });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { description: "bad key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )));
    await expect(getRazorpayPlanCatalogClient().fetchPlan("plan_private"))
      .rejects.toMatchObject({ kind: "AUTHENTICATION", status: 401 });

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(getRazorpayPlanCatalogClient().fetchPlan("plan_network"))
      .rejects.toMatchObject({ kind: "NETWORK", status: null });
  });

  it.each([undefined, "", "development", "preview", "staging", "prodution"])(
    "rejects Live keys outside the explicit production environment (%s)", environment => {
      expect(() => resolveRazorpayMode({
        RAZORPAY_MODE: "LIVE", RAZORPAY_KEY_ID: "rzp_live_example", VERCEL_ENV: environment,
      })).toThrow("RAZORPAY_MODE=TEST");
      expect(resolveRazorpayMode({
        RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: "rzp_test_example", VERCEL_ENV: environment,
      })).toBe("TEST");
    }
  );

  function invoice(index: number): RazorpayInvoice {
    return {
      id: `inv_${index}`, entity: "invoice", subscription_id: "sub_test", payment_id: `pay_${index}`,
      status: "paid", amount: 29900, amount_paid: 29900, amount_due: 0, currency: "INR",
    };
  }

  function stubInvoicePages(pages: unknown[]) {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    const fetchMock = vi.fn();
    for (const page of pages) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(page), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("reads every invoice page before exposing evidence, including a short provider page", async () => {
    const first = Array.from({ length: 100 }, (_, index) => invoice(index));
    const later = [invoice(100), invoice(101)];
    const fetchMock = stubInvoicePages([
      { entity: "collection", count: 100, items: first },
      { entity: "collection", count: 2, items: later },
      { entity: "collection", count: 0, items: [] },
    ]);

    await expect(getRazorpayClient().fetchSubscriptionInvoices("sub_test")).resolves.toEqual({
      entity: "collection", count: 102, items: [...first, ...later],
    });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "https://api.razorpay.com/v1/invoices?subscription_id=sub_test&count=100&skip=0",
      "https://api.razorpay.com/v1/invoices?subscription_id=sub_test&count=100&skip=100",
      "https://api.razorpay.com/v1/invoices?subscription_id=sub_test&count=100&skip=102",
    ]);
    for (const [, options] of fetchMock.mock.calls) expect(options).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it.each([
    null,
    { entity: "collection", count: 2, items: [invoice(0)] },
    { entity: "collection", count: 1, items: [{ ...invoice(0), subscription_id: "sub_other" }] },
    { entity: "collection", count: 1, items: [{ ...invoice(0), id: "" }] },
    { entity: "collection", count: 1, items: [null] },
  ])("rejects malformed or cross-subscription invoice collections", async page => {
    stubInvoicePages([page]);
    await expect(getRazorpayClient().fetchSubscriptionInvoices("sub_test"))
      .rejects.toMatchObject({ kind: "PROVIDER" });
  });

  it("rejects overlapping pages instead of hiding duplicate evidence", async () => {
    const page = { entity: "collection", count: 1, items: [invoice(0)] };
    const fetchMock = stubInvoicePages([page, page]);
    await expect(getRazorpayClient().fetchSubscriptionInvoices("sub_test"))
      .rejects.toThrow("inconsistent invoice collection");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not expose the earlier pages when a later provider read fails", async () => {
    const fetchMock = stubInvoicePages([{ entity: "collection", count: 1, items: [invoice(0)] }]);
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(getRazorpayClient().fetchSubscriptionInvoices("sub_test"))
      .rejects.toMatchObject({ kind: "NETWORK" });
  });

  it("bounds non-terminating pagination and refuses to treat the limit as complete evidence", async () => {
    const fetchMock = stubInvoicePages(Array.from({ length: 25 }, (_, index) => ({
      entity: "collection", count: 1, items: [invoice(index)],
    })));
    await expect(getRazorpayClient().fetchSubscriptionInvoices("sub_test"))
      .rejects.toThrow("could not be read completely");
    expect(fetchMock).toHaveBeenCalledTimes(25);
  });

  it("lists recent subscriptions for response-loss recovery", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_example");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      entity: "collection",
      count: 1,
      items: [{ id: "sub_candidate", entity: "subscription", plan_id: "plan_pro", status: "created", total_count: 120 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const subscriptions = await getRazorpayClient().listSubscriptions?.({ count: 25, skip: 5 });

    expect(subscriptions?.items[0]?.id).toBe("sub_candidate");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/subscriptions?count=25&skip=5",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  it("verifies order checkout signatures with orderId|paymentId", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    const signature = hmacSha256Hex("order_123|pay_456", "secret");

    expect(verifyRazorpayPaymentSignature({
      orderId: "order_123",
      paymentId: "pay_456",
      signature,
    })).toBe(true);

    expect(verifyRazorpayPaymentSignature({
      orderId: "order_123",
      paymentId: "pay_bad",
      signature,
    })).toBe(false);
  });

  it("verifies subscription checkout signatures with paymentId|subscriptionId", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    const signature = hmacSha256Hex("pay_456|sub_123", "secret");

    expect(verifyRazorpaySubscriptionSignature({
      subscriptionId: "sub_123",
      paymentId: "pay_456",
      signature,
    })).toBe(true);
  });

  it("verifies webhook signatures against the raw body", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "webhook_secret");
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = hmacSha256Hex(body, "webhook_secret");

    expect(verifyRazorpayWebhookSignature(body, signature)).toBe(true);
    expect(verifyRazorpayWebhookSignature(JSON.stringify({ event: "payment.failed" }), signature)).toBe(false);
  });

  it("verifies webhook signatures over the exact received bytes", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "webhook_secret");
    const body = Buffer.from('{"event":"payment.captured","note":"नमस्ते"}', "utf8");
    const signature = hmacSha256Hex(body, "webhook_secret");
    const changed = Buffer.concat([body, Buffer.from(" ")]);

    expect(verifyRazorpayWebhookSignature(body, signature)).toBe(true);
    expect(verifyRazorpayWebhookSignature(changed, signature)).toBe(false);
  });

  it("keeps approved old webhook secrets valid during rotation", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "current_secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_OLD_SECRETS", "previous_secret, oldest_secret");
    const body = Buffer.from('{"event":"subscription.activated"}', "utf8");

    expect(verifyRazorpayWebhookSignature(
      body,
      hmacSha256Hex(body, "previous_secret")
    )).toBe(true);
    expect(verifyRazorpayWebhookSignature(
      body,
      hmacSha256Hex(body, "unapproved_secret")
    )).toBe(false);
  });
});
