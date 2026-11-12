import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingPaymentMethodsOverview } from "@/components/billing/BillingPaymentMethodsOverview";

describe("BillingPaymentMethodsOverview", () => {
  it("explains provider-managed multi-method checkout without promising eligibility", () => {
    const html = renderToStaticMarkup(
      <BillingPaymentMethodsOverview
        availability={{
          mode: "PROVIDER_MANAGED",
          potentialMethods: ["CARD", "UPI", "EMANDATE"],
          providerControlsVisibility: true,
        }}
        currentMethod="UPI"
      />
    );

    expect(html).toContain("Choose securely in Razorpay Checkout");
    expect(html).toContain("Card");
    expect(html).toContain("UPI AutoPay");
    expect(html).toContain("eMandate");
    expect(html).toContain("Shown if eligible");
    expect(html).toContain("Options depend on your bank or app, payment amount and device.");
    expect(html).toContain("Current recurring method");
    expect(html).toContain("Lab Lords shows your confirmed payment status.");
  });

  it("makes card-only rollout state explicit", () => {
    const html = renderToStaticMarkup(<BillingPaymentMethodsOverview />);

    expect(html).toContain("Pay by card");
    expect(html).toContain("Card payments");
    expect(html).toContain("UPI AutoPay");
    expect(html).toContain("eMandate");
    expect(html.match(/Not available/g)).toHaveLength(2);
  });
});
