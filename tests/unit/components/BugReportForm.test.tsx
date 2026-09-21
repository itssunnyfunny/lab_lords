import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { BugReportForm } from "@/components/feedback/BugReportForm";

const state = vi.hoisted(() => ({ index: 0, values: ["Seat list issue", "The expected shift is missing from the list.", "owner@example.test"] }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => (value: string) => value }));
vi.mock("@/lib/tracking", () => ({ trackEvent: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [state.values[state.index++], vi.fn()] }));
afterEach(() => vi.unstubAllGlobals());

describe("bug report email draft", () => {
  it("prepares an encoded draft without submitting a network message or claiming success", () => {
    state.index = 0;
    const location = { href: "https://lablords.in/support" };
    const fetch = vi.fn();
    vi.stubGlobal("window", { location });
    vi.stubGlobal("navigator", { userAgent: "Test browser" });
    vi.stubGlobal("fetch", fetch);
    const form = BugReportForm({ supportEmail: "support@example.test" });
    const preventDefault = vi.fn();
    form.props.onSubmit({ preventDefault } as unknown as FormEvent<HTMLFormElement>);
    expect(preventDefault).toHaveBeenCalled();
    expect(location.href).toMatch(/^mailto:support@example.test\?subject=/);
    const draft = new URL(location.href);
    expect(draft.searchParams.get("subject")).toBe("[Lab Lords bug] Seat list issue");
    expect(draft.searchParams.get("body")).toContain("The expected shift is missing");
    expect(draft.searchParams.get("body")).toContain("Page: https://lablords.in/support");
    expect(fetch).not.toHaveBeenCalled();
  });
});
