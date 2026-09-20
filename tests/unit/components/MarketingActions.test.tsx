import type { ButtonHTMLAttributes, MouseEvent, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanCTA, SignInCTA, WorkspaceCTA } from "@/components/landing/MarketingActions";
import { getBillingOnboardingPath, getBillingSignUpPath, getOrganizationBillingPath } from "@/lib/billingFlow";

const mocks = vi.hoisted(() => ({
  user: { isLoaded: true, isSignedIn: false },
  pending: false,
  setPending: vi.fn(),
  push: vi.fn(),
  getAll: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({ useUser: () => mocks.user }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/organizations", () => ({ organizations: { getAll: mocks.getAll } }));
vi.mock("@/lib/tracking", () => ({ trackEvent: mocks.trackEvent }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: () => [mocks.pending, mocks.setPending],
}));

type ActionButton = ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;

async function activate(button: ActionButton) {
  if (!button.props.disabled) {
    await button.props.onClick?.({} as MouseEvent<HTMLButtonElement>);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.isLoaded = true;
  mocks.user.isSignedIn = false;
  mocks.pending = false;
  mocks.getAll.mockResolvedValue([]);
});

describe("public marketing account actions", () => {
  it("takes signed-out trial and sign-in actions to their existing routes", async () => {
    await activate(WorkspaceCTA({ source: "landing_hero_primary" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/sign-up");
    expect(mocks.trackEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      source: "landing_hero_primary", signed_in: false,
    });
    await activate(SignInCTA());
    expect(mocks.push).toHaveBeenLastCalledWith("/sign-in");
    expect(mocks.getAll).not.toHaveBeenCalled();
  });

  it("takes both account actions to the workspace for a signed-in visitor", async () => {
    mocks.user.isSignedIn = true;
    const trial = WorkspaceCTA({});
    expect(trial.props.children).toContain("Open workspace");
    await activate(trial);
    await activate(SignInCTA());
    expect(mocks.push.mock.calls).toEqual([["/app"], ["/app"]]);
  });

  it("disables account and plan actions until authentication finishes loading", async () => {
    mocks.user.isLoaded = false;
    const buttons = [WorkspaceCTA({}), SignInCTA(), PlanCTA({ planId: "BASIC", active: true, label: "Choose Basic" })];
    for (const button of buttons) {
      expect(button.props.disabled).toBe(true);
      await activate(button);
    }
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.getAll).not.toHaveBeenCalled();
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
});

describe.each(["BASIC", "PRO"] as const)("%s selected-plan continuation", planId => {
  function planButton() {
    return PlanCTA({ planId, active: true, label: planId === "BASIC" ? "Choose Basic" : "Choose Standard" });
  }

  it("preserves the selected plan through signed-out signup", async () => {
    await activate(planButton());
    expect(mocks.push).toHaveBeenCalledWith(getBillingSignUpPath(planId));
    expect(mocks.getAll).not.toHaveBeenCalled();
    expect(mocks.trackEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      source: `landing_pricing_${planId.toLowerCase()}`, signed_in: false,
    });
  });

  it("takes a signed-in owner without organizations to onboarding with the selected plan", async () => {
    mocks.user.isSignedIn = true;
    await activate(planButton());
    expect(mocks.getAll).toHaveBeenCalledOnce();
    expect(mocks.setPending).toHaveBeenCalledWith(true);
    expect(mocks.push).toHaveBeenCalledWith(getBillingOnboardingPath(planId));
  });

  it("continues to the existing organization's billing page", async () => {
    mocks.user.isSignedIn = true;
    mocks.getAll.mockResolvedValue([{ id: "org_example" }, { id: "org_other" }]);
    await activate(planButton());
    expect(mocks.push).toHaveBeenCalledWith(getOrganizationBillingPath("org_example", planId));
  });

  it("retains the selected plan in onboarding when organization lookup fails", async () => {
    mocks.user.isSignedIn = true;
    mocks.getAll.mockRejectedValue(new Error("Network unavailable"));
    await activate(planButton());
    expect(mocks.push).toHaveBeenCalledWith(getBillingOnboardingPath(planId));
  });

  it("keeps pending and unavailable plan actions disabled", async () => {
    const unavailable = PlanCTA({ planId, active: false, label: "Choose plan" });
    expect(unavailable.props.disabled).toBe(true);
    await activate(unavailable);
    mocks.pending = true;
    const pending = planButton();
    expect(pending.props.disabled).toBe(true);
    expect(pending.props["aria-busy"]).toBe(true);
    await activate(pending);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.getAll).not.toHaveBeenCalled();
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
});
