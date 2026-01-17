"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AllocationsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;

    return (
        <div className="p-8">
            <EmptyState
                title="Seat Allocations"
                description="View and manage allocation history. Who sat where and when."
                actionScript={
                    <Link href={`/branch/${branchId}/allocations/new`}>
                        <Button>New Allocation</Button>
                    </Link>
                }
            />
        </div>
    )
}
