"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function AIMessagesPage() {
    return (
        <div className="p-8">
            <EmptyState
                title="Message Drafts"
                description="Let AI draft payment reminders and announcements for you."
                actionScript={<Button>Draft New Message</Button>}
            />
        </div>
    )
}
