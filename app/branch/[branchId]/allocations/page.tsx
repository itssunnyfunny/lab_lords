"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function AllocationsPage() {
    return (
        <div className="p-8">
            <EmptyState
                title="Seat Allocations"
                description="View and manage allocation history. Who sat where and when."
                actionScript={<Button>New Allocation</Button>}
            />
        </div>
    )
}
