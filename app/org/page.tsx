"use client";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organizations } from "@/lib/api/organizations";
import type { Organization } from "@/app/generated/prisma/browser";

export default function OrgSelectionPage() {
    const router = useRouter();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrgs = async () => {
            try {
                const data = await organizations.getAll();
                if (data.length === 0) {
                    router.replace("/onboarding");
                    return;
                }
                setOrgs(data);
            } catch (err) {
                console.error("Failed to fetch organizations", err);
                setError("Failed to load organizations");
            } finally {
                setLoading(false);
            }
        };

        fetchOrgs();
    }, [router]);

    const handleSelect = (orgId: string) => {
        router.push(`/org/${orgId}`);
    };

    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden overflow-y-auto p-4 font-sans text-white sm:p-6">
            <AmbientBackground />

            <div className="relative z-10 max-w-4xl w-full">
                <div className="mb-8 text-center sm:mb-12">
                    <h2 className="mb-2 text-3xl font-bold text-white sm:text-4xl"><GlowText>Select Workspace</GlowText></h2>
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
                    <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-gray-400 sm:p-8">
                        No organizations found. Please check your data.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 md:gap-8">
                        {orgs.map(org => (
                            <button key={org.id} onClick={() => handleSelect(org.id)} className="group text-left h-full w-full">
                                <Card className="h-full hover:scale-[1.02] transition-all duration-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:border-cyan-500/30 bg-[#0f111a]/40">
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-gradient-to-br from-gray-800/50 to-black/50 text-gray-400 shadow-lg transition-all group-hover:border-cyan-500/30 group-hover:text-cyan-300 sm:h-16 sm:w-16">
                                            <Building2 size={32} />
                                        </div>
                                        <Badge variant="cyan">Active</Badge>
                                    </div>
                                    <h3 className="mb-2 text-xl font-bold text-white transition-colors group-hover:text-cyan-100 sm:text-2xl">{org.name}</h3>
                                    <div className="flex min-w-0 items-center gap-2 text-sm text-gray-500">
                                        <span className="shrink-0">ID:</span>
                                        <span className="truncate rounded bg-white/5 px-2 py-0.5 font-medium text-white">{org.id}</span>
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
