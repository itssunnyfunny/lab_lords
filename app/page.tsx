"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { organizations } from "@/lib/api/organizations";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Ensure a default user ID exists for testing
    const currentId = typeof window !== "undefined" ? localStorage.getItem("x-user-id") : null;
    if (!currentId || currentId === "user-1") {
      localStorage.setItem("x-user-id", "user_alice");
    }

    const redirect = async () => {
      try {
        const data = await organizations.getAll();

        if (data.length === 0) {
          router.replace("/onboarding");
        } else {
          // For now: 1 user = 1 org, go straight to the org dashboard
          router.replace(`/org/${data[0].id}`);
        }
      } catch {
        // On error, fall through to onboarding so the user isn't stuck
        router.replace("/onboarding");
      }
    };

    redirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] text-white">
      <Loader2 className="animate-spin mr-3 text-cyan-500" size={24} />
      <span className="text-gray-400">Loading...</span>
    </div>
  );
}
