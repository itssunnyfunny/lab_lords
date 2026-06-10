"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/tracking";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMockup } from "@/components/landing/LandingMockup";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingSoftware } from "@/components/landing/LandingSoftware";
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

  const trackLandingClick = (source: string) => {
    trackEvent("landing_cta_clicked", {
      source,
      signed_in: isSignedIn,
    });
  };

  const handleSignInClick = (source = "landing_nav_sign_in") => {
    if (!isLoaded) return;
    trackLandingClick(source);
    router.push(isSignedIn ? "/app" : "/sign-in");
  };

  const handleWorkspaceClick = (source = "landing_cta") => {
    if (!isLoaded) return;
    trackLandingClick(source);

    if (!isSignedIn) {
      router.push("/sign-up");
      return;
    }

    setIsRedirecting(true);
    router.push("/app");
  };

  if (isRedirecting) {
    return <PageLoadingSkeleton label="Loading workspace" variant="workspace" />;
  }

  return (
    <main className={landingRootClass}>
      <LandingNavbar
        isSignedIn={isSignedIn}
        onSignInClick={handleSignInClick}
        onWorkspaceClick={handleWorkspaceClick}
      />
      <div className="overflow-hidden">
        <LandingHero
          isSignedIn={isSignedIn}
          onWorkspaceClick={handleWorkspaceClick}
        />
        <LandingMockup />
      </div>
      <LandingFeatures />
      <LandingSoftware />
      <LandingHowItWorks />
      <LandingPricing onDashboardClick={handleWorkspaceClick} />
      <LandingFooter />
    </main>
  );
}

export default function RootPage() {
  const { isLoaded, isSignedIn } = useUser();
  return <LandingContent isLoaded={isLoaded} isSignedIn={isSignedIn ?? false} />;
}
