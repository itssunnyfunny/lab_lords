import { describe, expect, it, vi } from "vitest";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/core", () => ({ apiClient: { get } }));
import { billing } from "@/lib/api/billing";

describe("billing invoice history API", () => {
    it("requests the authorized organization history and encodes each pagination cursor", async () => {
        get.mockResolvedValue({ items: [], nextCursor: "next/page" });
        await billing.getInvoices("org/one");
        expect(get).toHaveBeenLastCalledWith("/organizations/org%2Fone/billing/invoices");
        await billing.getInvoices("org/one", "next/page&cursor=foreign");
        expect(get).toHaveBeenLastCalledWith("/organizations/org%2Fone/billing/invoices?cursor=next%2Fpage%26cursor%3Dforeign");
    });
});
