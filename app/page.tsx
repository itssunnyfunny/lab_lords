"use client";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Building2, Plus, Loader2, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organizations } from "@/lib/api/organizations";
import { Organization } from "@prisma/client";
import { CreateBranchDialog } from "@/components/branch/CreateBranchDialog";

export default function OrgSelectionPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOrgId, setDialogOrgId] = useState<string | null>(null);

  useEffect(() => {
    // Temporary: Ensure a user ID exists for testing
    const currentId = typeof window !== "undefined" ? localStorage.getItem("x-user-id") : null;
    if (!currentId || currentId === "user-1") {
      localStorage.setItem("x-user-id", "user_alice"); // Default test user set to Alice
    }

    const checkState = async () => {
      try {
        const data = await organizations.getAll();
        setOrgs(data);

        // 1. No Organizations -> Redirect to Onboarding
        if (data.length === 0) {
          router.replace("/onboarding");
          return;
        }
      } catch (err: any) {
        setError(err.message || "Failed to load organizations");
      } finally {
        setLoading(false);
      }
    };

    checkState();
  }, [router]);

  const handleSelectOrg = (orgId: string) => {
    router.push(`/org/${orgId}`);
  };

  const handleBranchCreated = (branch: { id: string; name: string }) => {
    setDialogOrgId(null);
    // Navigate directly to the new branch
    router.push(`/branch/${branch.id}`);
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
              <div key={org.id} className="flex flex-col h-full">
                {/* Org card — click goes to org dashboard */}
                <button onClick={() => handleSelectOrg(org.id)} className="group text-left h-full w-full flex-1">
                  <Card className="h-full hover:scale-[1.02] transition-all duration-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:border-cyan-500/30 bg-[#0f111a]/40">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800/50 to-black/50 border border-white/5 flex items-center justify-center text-gray-400 group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-all shadow-lg">
                        <Building2 size={32} />
                      </div>
                      <Badge variant="cyan">Active</Badge>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">{org.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>Plan:</span>
                      <span className="text-white font-medium bg-white/5 px-2 py-0.5 rounded">Enterprise</span>
                    </div>
                  </Card>
                </button>

                {/* Org-level action buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDialogOrgId(org.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-cyan-400 border border-dashed border-white/10 hover:border-cyan-500/30 rounded-lg transition-all"
                  >
                    <Plus size={14} />
                    Add Branch
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/org/${org.id}/settings`);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
                    title="Org Settings"
                  >
                    <Settings size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Branch Dialog */}
      {dialogOrgId && (
        <CreateBranchDialog
          isOpen={true}
          onClose={() => setDialogOrgId(null)}
          organizationId={dialogOrgId}
          onSuccess={handleBranchCreated}
        />
      )}
    </div>
  );
}
