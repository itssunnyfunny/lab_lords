"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function AIInsightsPage() {
    return (
        <div className="p-8">
            <EmptyState
                title="Smart Insights"
                description="AI-driven suggestions to optimize seat pricing and student retention."
                actionScript={<Button>Generate Insights</Button>}
            />
        </div>
    )
}
