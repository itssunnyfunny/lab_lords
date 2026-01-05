"use client";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

// Mock data from snippet to populate the UI for now
const MOCK_ORGS = [
  { id: "org-1", name: "Nebula Libraries", plan: "Enterprise", status: "active" },
  { id: "org-2", name: "Quantum Study Halls", plan: "Pro", status: "active" }
];

export default function OrgSelectionPage() {
  const router = useRouter();

  const handleSelect = (orgId: string) => {
    router.push(`/org/${orgId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-white bg-[#050508]">
      <AmbientBackground />

      <div className="relative z-10 max-w-4xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-2"><GlowText>Select Workspace</GlowText></h2>
          <p className="text-gray-400">Choose your organization to proceed</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {MOCK_ORGS.map(org => (
            <button key={org.id} onClick={() => handleSelect(org.id)} className="group text-left h-full w-full">
              <Card className="h-full hover:scale-[1.02] transition-all duration-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:border-cyan-500/30 bg-[#0f111a]/40">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800/50 to-black/50 border border-white/5 flex items-center justify-center text-gray-400 group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-all shadow-lg">
                    <Building2 size={32} />
                  </div>
                  <Badge variant="cyan">{org.status}</Badge>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">{org.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Plan:</span>
                  <span className="text-white font-medium bg-white/5 px-2 py-0.5 rounded">{org.plan}</span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
