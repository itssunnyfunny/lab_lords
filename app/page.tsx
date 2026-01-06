"use client";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Building2, Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organizations } from "@/lib/api/organizations";
import { Organization } from "@prisma/client";

export default function OrgSelectionPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Temporary: Ensure a user ID exists for testing
    const currentId = typeof window !== "undefined" ? localStorage.getItem("x-user-id") : null;
    if (!currentId || currentId === "user-1") {
      localStorage.setItem("x-user-id", "user_alice"); // Default test user set to Alice
    }

    const fetchOrgs = async () => {
      try {
        const data = await organizations.getAll();
        setOrgs(data);
      } catch (err: any) {
        setError(err.message || "Failed to load organizations");
      } finally {
        setLoading(false);
      }
    };

    fetchOrgs();
  }, []);

  const handleSelect = (orgId: string) => {
    router.push(`/org/${orgId}`); // Or logic to pick default branch
    // For now, redirecting to org page. 
    // If the requirement is specific about flow, we might need to list branches here or after.
    // Assuming standard flow: Org -> Org Dashboard or potentially Branch Selection.
    // Given routes, `/org/[orgId]` exists. 
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508] text-white">
        <Loader2 className="animate-spin mr-2" /> Loading workspace...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508] text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/10 rounded hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-white bg-[#050508]">
      <AmbientBackground />

      <div className="relative z-10 max-w-4xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-2"><GlowText>Select Workspace</GlowText></h2>
          <p className="text-gray-400">Choose your organization to proceed</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {orgs.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 py-10">
              No organizations found.
            </div>
          ) : (
            orgs.map(org => (
              <button key={org.id} onClick={() => handleSelect(org.id)} className="group text-left h-full w-full">
                <Card className="h-full hover:scale-[1.02] transition-all duration-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:border-cyan-500/30 bg-[#0f111a]/40">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800/50 to-black/50 border border-white/5 flex items-center justify-center text-gray-400 group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-all shadow-lg">
                      <Building2 size={32} />
                    </div>
                    {/* Status is not on Organization model standard, assuming Active for now or checking mock content */}
                    <Badge variant="cyan">Active</Badge>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">{org.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Plan:</span>
                    <span className="text-white font-medium bg-white/5 px-2 py-0.5 rounded">Enterprise</span>
                  </div>
                </Card>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

