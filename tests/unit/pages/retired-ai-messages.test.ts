import { expect, it, vi } from "vitest";
import RetiredAIMessagesPage from "@/app/branch/[branchId]/ai/messages/page";

const redirect = vi.hoisted(() => vi.fn((href: string) => { throw new Error(`redirect:${href}`); }));
vi.mock("next/navigation", () => ({ redirect }));

it("takes an old AI Messages bookmark to the current branch follow-up queue", async () => {
    await expect(RetiredAIMessagesPage({ params: Promise.resolve({ branchId: "branch_1" }) }))
        .rejects.toThrow("redirect:/branch/branch_1/follow-ups");
    expect(redirect).toHaveBeenCalledExactlyOnceWith("/branch/branch_1/follow-ups");
});
