"use client";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Building2, Loader2 } from "lucide-react";
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
        const fetchOrgs = async () => {
            try {
                const data = await organizations.getAll();
                setOrgs(data);
            } catch (err) {
                console.error("Failed to fetch organizations", err);
                setError("Failed to load organizations");
            } finally {
                setLoading(false);
            }
        };

        fetchOrgs();
    }, []);

    const handleSelect = (orgId: string) => {
        router.push(`/org/${orgId}`);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-white">
            <AmbientBackground />

            <div className="relative z-10 max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-white mb-2"><GlowText>Select Workspace</GlowText></h2>
                    <p className="text-gray-400">Choose your organization to proceed</p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                    </div>
                ) : error ? (
                    <div className="text-center text-red-400 p-4 border border-red-500/20 bg-red-500/10 rounded-xl">
                        {error}
                    </div>
                ) : orgs.length === 0 ? (
                    <div className="text-center text-gray-400 p-8 border border-white/10 bg-white/5 rounded-xl">
                        No organizations found. Please check your data.
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-8">
                        {orgs.map(org => (
                            <button key={org.id} onClick={() => handleSelect(org.id)} className="group text-left h-full w-full">
                                <Card className="h-full hover:scale-[1.02] transition-all duration-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:border-cyan-500/30 bg-[#0f111a]/40">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800/50 to-black/50 border border-white/5 flex items-center justify-center text-gray-400 group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-all shadow-lg">
                                            <Building2 size={32} />
                                        </div>
                                        <Badge variant="cyan">Active</Badge>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">{org.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span>ID:</span>
                                        <span className="text-white font-medium bg-white/5 px-2 py-0.5 rounded">{org.id}</span>
                                    </div>
                                </Card>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
