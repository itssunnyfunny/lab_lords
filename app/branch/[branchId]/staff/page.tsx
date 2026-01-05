"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function StaffPage() {
    return (
        <div className="p-8">
            <EmptyState
                title="Staff Management"
                description="Manage branch managers, cleaning staff, and security roles."
                actionScript={<Button>Add Staff Member</Button>}
            />
        </div>
    )
}
