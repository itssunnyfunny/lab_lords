"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { organizations } from "@/lib/api/organizations";
import type { CheckoutBillingPlanId } from "@/lib/billingPlans";
import { getBillingOnboardingPath, getBillingSignUpPath, getOrganizationBillingPath } from "@/lib/billingFlow";
import { trackEvent } from "@/lib/tracking";

export function WorkspaceCTA({ source = "landing_cta", className = "", label = "Start free trial" }: { source?: string; className?: string; label?: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  return <button type="button" disabled={!isLoaded} className={`marketing-button ${className}`} onClick={() => {
    trackEvent("landing_cta_clicked", { source, signed_in: Boolean(isSignedIn) });
    router.push(isSignedIn ? "/app" : "/sign-up");
  }}>{isSignedIn ? "Open workspace" : label}<ArrowRight size={16} aria-hidden="true" /></button>;
}

export function SignInCTA() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  return <button className="marketing-sign-in" type="button" disabled={!isLoaded} onClick={() => {
    trackEvent("landing_cta_clicked", { source: "landing_nav_sign_in", signed_in: Boolean(isSignedIn) });
    router.push(isSignedIn ? "/app" : "/sign-in");
  }}>{isSignedIn ? "My workspace" : "Sign in"}</button>;
}

export function PlanCTA({ planId, active, label }: { planId: CheckoutBillingPlanId; active: boolean; label: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function choosePlan() {
    if (!isLoaded || !active || pending) return;
    trackEvent("landing_cta_clicked", { source: `landing_pricing_${planId.toLowerCase()}`, signed_in: Boolean(isSignedIn) });
    if (!isSignedIn) { router.push(getBillingSignUpPath(planId)); return; }
    setPending(true);
    try {
      const data = await organizations.getAll();
      router.push(data.length ? getOrganizationBillingPath(data[0].id, planId) : getBillingOnboardingPath(planId));
    } catch {
      router.push(getBillingOnboardingPath(planId));
    }
  }
  return <button type="button" className="marketing-button w-full" disabled={!isLoaded || !active || pending} aria-busy={pending} onClick={choosePlan}>
    {pending ? "Opening your plan…" : active ? label : "Coming soon"}<ArrowRight size={16} aria-hidden="true" />
  </button>;
}
