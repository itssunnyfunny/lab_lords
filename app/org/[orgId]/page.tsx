"use client";

import { useEffect, use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { organizations, BranchWithCounts } from "@/lib/api/organizations";
import { Building2, MapPin, Users, LayoutGrid, Clock, ArrowRight, Loader2, Plus } from "lucide-react";
import { CreateBranchDialog } from "@/components/branch/CreateBranchDialog";

export default function OrgDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
    const router = useRouter();
    const { orgId } = use(params);
    const [branches, setBranches] = useState<BranchWithCounts[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const loadBranches = useCallback(async () => {
        try {
            const data = await organizations.getBranches(orgId);
            setBranches(data);
        } catch (err) {
            console.error("Failed to fetch branches", err);
            setError("Failed to load branches.");
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    const handleBranchCreated = () => {
        setCreateDialogOpen(false);
        setLoading(true);
        loadBranches();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh] text-white">
                <Loader2 className="animate-spin mr-3 text-cyan-500" size={28} />
                <span className="text-gray-400 text-lg">Loading branches...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="text-red-400 p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <p className="font-semibold text-lg mb-1">Something went wrong</p>
                    <p className="text-sm text-red-300">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 fade-in text-white">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Select a Branch</h1>
                    <p className="text-gray-400 mt-1">
                        {branches.length} branch{branches.length !== 1 ? "es" : ""} in this organization
                    </p>
                </div>
                <button
                    onClick={() => setCreateDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all text-sm font-medium"
                >
                    <Plus size={15} />
                    Create Branch
                </button>
            </div>

            {/* Branch Cards Grid */}
            {branches.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Building2 size={32} className="text-gray-500" />
                    </div>
                    <div>
                        <p className="text-white font-semibold text-xl mb-1">No branches yet</p>
                        <p className="text-gray-500 text-sm max-w-xs">
                            Create your first branch to start managing students, seats, and payments.
                        </p>
                    </div>
                    <button
                        onClick={() => setCreateDialogOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/10 border border-dashed border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-sm font-medium"
                    >
                        <Plus size={15} />
                        Create Branch
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {branches.map((branch) => (
                        <button
                            key={branch.id}
                            onClick={() => router.push(`/branch/${branch.id}`)}
                            className="group text-left w-full"
                        >
                            <div className="
                                relative rounded-2xl border border-white/10 bg-[#0f111a]/60
                                p-6 flex flex-col gap-5
                                hover:border-cyan-500/40 hover:bg-[#0f111a]/90
                                hover:shadow-[0_0_40px_rgba(6,182,212,0.1)]
                                transition-all duration-300
                            ">
                                {/* Card Header */}
                                <div className="flex items-start justify-between">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center group-hover:border-cyan-500/30 transition-colors">
                                        <Building2 size={22} className="text-cyan-400" />
                                    </div>
                                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Active
                                    </div>
                                </div>

                                {/* Branch Name + City */}
                                <div>
                                    <h2 className="text-xl font-bold text-white group-hover:text-cyan-100 transition-colors leading-tight">
                                        {branch.name}
                                    </h2>
                                    {branch.city && (
                                        <div className="flex items-center gap-1.5 mt-1.5 text-gray-500 text-sm">
                                            <MapPin size={13} />
                                            <span>{branch.city}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Stats Row */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-xl bg-white/5 border border-white/5 p-3 flex flex-col gap-1">
                                        <Users size={14} className="text-cyan-400" />
                                        <span className="text-xl font-bold text-white">{branch._count.students}</span>
                                        <span className="text-[11px] text-gray-500 leading-tight">Students</span>
                                    </div>
                                    <div className="rounded-xl bg-white/5 border border-white/5 p-3 flex flex-col gap-1">
                                        <LayoutGrid size={14} className="text-indigo-400" />
                                        <span className="text-xl font-bold text-white">{branch._count.seats}</span>
                                        <span className="text-[11px] text-gray-500 leading-tight">Seats</span>
                                    </div>
                                    <div className="rounded-xl bg-white/5 border border-white/5 p-3 flex flex-col gap-1">
                                        <Clock size={14} className="text-violet-400" />
                                        <span className="text-xl font-bold text-white">{branch._count.shifts}</span>
                                        <span className="text-[11px] text-gray-500 leading-tight">Shifts</span>
                                    </div>
                                </div>

                                {/* Footer CTA */}
                                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                    {branch.defaultFee ? (
                                        <span className="text-xs text-gray-500">
                                            Default fee: <span className="text-gray-300 font-medium">₹{branch.defaultFee.toLocaleString()}/mo</span>
                                        </span>
                                    ) : (
                                        <span />
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-cyan-500 font-medium group-hover:gap-2 transition-all">
                                        Open branch <ArrowRight size={13} />
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Create Branch Dialog */}
            <CreateBranchDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                organizationId={orgId}
                onSuccess={handleBranchCreated}
            />
        </div>
    );
}
