import { Suspense } from "react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import { AppShell } from "@/components/layout/AppShell";
import { EntrySidebar } from "@/components/layout/EntrySidebar";
export default function OnboardingPage(props: { searchParams: Promise<{ billingPlan?: string }> }) {
    return <AppShell designPilot sidebar={<EntrySidebar />}><Suspense><OnboardingWizard {...props} /></Suspense></AppShell>;
}
