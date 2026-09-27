import { beforeEach, vi } from "vitest";

// Tests with service reads must provide their own explicit Prisma mock.
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_target, property) => {
    if (property === "then") return undefined;
    throw new Error(`Unexpected database operation in dashboard unit suite: ${String(property)}`);
} }) }));
beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network operation in dashboard unit suite"); }));
});
