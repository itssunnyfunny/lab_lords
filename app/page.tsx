"use client";

import { useUser } from "@clerk/nextjs";
import { isAuthBypassEnabled } from "@/lib/authMode";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizations } from "@/lib/api/organizations";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMockup } from "@/components/landing/LandingMockup";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PageLoadingSkeleton } from "@/components/ui";
import { landingRootClass } from "@/components/ui/landingSurface";

type LandingContentProps = {
  isLoaded: boolean;
  isSignedIn: boolean;
};

function LandingContent({ isLoaded, isSignedIn }: LandingContentProps) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleDashboardClick = async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setIsRedirecting(true);

    try {
      const data = await organizations.getAll();

      if (data.length === 0) {
        router.push("/onboarding");
      } else {
        // For now: 1 user = 1 org, go straight to the org dashboard
        router.push(`/org/${data[0].id}`);
      }
    } catch {
      // On error, fall through to onboarding so the user isn't stuck
      router.push("/onboarding");
    }
  };

  if (isRedirecting) {
    return <PageLoadingSkeleton label="Loading workspace" variant="workspace" />;
  }

  return (
    <main className={landingRootClass}>
      <LandingNavbar onDashboardClick={handleDashboardClick} />
      <div className="overflow-hidden">
        <LandingHero onDashboardClick={handleDashboardClick} />
        <LandingMockup />
      </div>
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingPricing onDashboardClick={handleDashboardClick} />
      <LandingFooter />
    </main>
  );
}

function ClerkLandingPage() {
  const { isLoaded, isSignedIn } = useUser();
  return <LandingContent isLoaded={isLoaded} isSignedIn={isSignedIn ?? false} />;
}

export default function RootPage() {
  if (isAuthBypassEnabled()) {
    return <LandingContent isLoaded={true} isSignedIn={true} />;
  }

  return <ClerkLandingPage />;
}
