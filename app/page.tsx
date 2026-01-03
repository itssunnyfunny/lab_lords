"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// TODO: Move to shared types
interface Organization {
  id: string;
  name: string;
}

// TODO: Remove this mock data when API is integrated
const MOCK_ORGS: Organization[] = [
  { id: "org-1", name: "Sky High Study Hall" },
  { id: "org-2", name: "NexGen Library" },
  { id: "org-3", name: "Quantum Coaching" },
];

export default function OrganizationSelectionPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // TODO: Integrate real API -> GET /api/organizations
    async function fetchOrgs() {
      try {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Mock success
        setOrgs(MOCK_ORGS);

        // Mock error (uncomment to test)
        // throw new Error("Mock error");
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchOrgs();
  }, []);

  const handleOrgClick = (orgId: string) => {
    router.push(`/org/${orgId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="mt-4 text-sm text-muted">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-red-400">Error</h2>
          <p className="text-sm text-muted">
            Failed to load organizations. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-lg">
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            No organizations found
          </h2>
          <p className="mb-4 text-sm text-muted">
            Contact an admin or create one later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-xl font-bold text-foreground">
          Select Organization
        </h1>
        <div className="grid gap-4">
          {orgs.map((org) => (
            <div
              key={org.id}
              onClick={() => handleOrgClick(org.id)}
              className="group cursor-pointer rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10"
            >
              <h3 className="font-semibold text-foreground group-hover:text-primary">
                {org.name}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
