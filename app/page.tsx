"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizations } from "@/lib/api/organizations";
import { Loader2 } from "lucide-react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingMockup } from "@/components/landing/LandingMockup";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function RootPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleDashboardClick = async () => {
    setIsRedirecting(true);
    
    // Ensure a default user ID exists for testing
    const currentId = typeof window !== "undefined" ? localStorage.getItem("x-user-id") : null;
    if (!currentId || currentId === "user-1") {
      localStorage.setItem("x-user-id", "user_alice");
    }

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508] text-white">
        <Loader2 className="animate-spin mr-3 text-cyan-500" size={24} />
        <span className="text-gray-400">Loading workspace...</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] selection:bg-cyan-500/30 text-white font-sans relative">
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
