"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function ShiftsPage() {
    return (
        <div className="p-8">
            <EmptyState
                title="Shift Management"
                description="Configure morning, evening, and night shifts for proper seat allocation tracking."
                actionScript={<Button>Create First Shift</Button>}
            />
        </div>
    )
}
