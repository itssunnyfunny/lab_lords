"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/tables/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Loader2 } from "lucide-react";
import { useEffect, useState, use } from "react";
import { staff } from "@/lib/api/staff";
import { Staff } from "@prisma/client";

export default function StaffPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const [data, setData] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStaff = async () => {
            try {
                const list = await staff.list(branchId);
                setData(list);
            } catch (error) {
                console.error("Failed to load staff", error);
            } finally {
                setLoading(false);
            }
        };
        loadStaff();
    }, [branchId]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading staff...</div>;
    }

    if (data.length === 0) {
        return (
            <div className="p-8">
                <EmptyState
                    title="Staff Management"
                    description="Manage branch managers, cleaning staff, and security roles."
                    actionScript={<Button>Add Staff Member</Button>}
                />
            </div>
        );
    }

    return (
        <div className="p-8">
            <PageHeader
                title="Staff Management"
                subtitle="Manage branch team members and roles."
                onSearch={() => { }}
                onFilter={() => { }}
                onExport={() => { }}
                onAdd={() => { }}
                actionLabel="Add Staff"
            />
            <DataTable
                data={data}
                columns={[
                    { header: "Name", accessor: (item) => (item as any).user?.name || "Unknown User" },
                    { header: "Role", accessor: (item) => <Badge>{item.role}</Badge> },
                    { header: "Joined", accessor: (item) => new Date(item.createdAt).toLocaleDateString() }
                ]}
                actions={() => null}
            />
        </div>
    );
}

