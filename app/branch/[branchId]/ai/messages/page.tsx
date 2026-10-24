import { redirect } from "next/navigation";

// Old bookmarks lead to the current contact-work queue.
export default async function RetiredAIMessagesPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = await params;
    redirect(`/branch/${encodeURIComponent(branchId)}/follow-ups`);
}
