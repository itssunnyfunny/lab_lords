import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { BugReportForm } from "@/components/feedback/BugReportForm";
import { publicCatalog } from "@/lib/public-i18n/catalog";
import { messagesFor, publicTranslator } from "@/lib/public-i18n/translate";
import { publicLocales } from "@/lib/public-i18n/routes";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "hi" | "hinglish", draft: { summary: "Seat list issue {summary}", details: "Original visitor text <unchanged>.", contact: "owner@example.test" } }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => ({ owned: (value: string) => value }) }));
vi.mock("@/components/landing/PublicLanguageProvider", () => ({ usePublicText: () => ({ isPublic: true, t: publicTranslator(messagesFor(publicCatalog, state.locale)) }) }));
vi.mock("@/components/landing/PublicDraftProvider", () => ({ emptySupportDraft: {}, usePublicSupportDraft: () => ({ draft: state.draft, setDraft: vi.fn() }) }));
vi.mock("@/lib/tracking", () => ({ trackEvent: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [state.draft, vi.fn()] }));
afterEach(() => vi.unstubAllGlobals());

describe.each(publicLocales)("%s bug report email draft", locale => {
  it("prepares an encoded draft without submitting a network message or claiming success", () => {
    state.locale = locale;
    const location = { href: "https://lablords.in/support?private=discard", origin: "https://lablords.in", pathname: "/support" };
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
    expect(draft.searchParams.get("subject")).toBe("[Lab Lords bug] Seat list issue {summary}");
    const body = draft.searchParams.get("body")!;
    expect(body).toContain(state.draft.details);
    expect(body).toContain(state.draft.contact);
    expect(body).toContain(publicTranslator(messagesFor(publicCatalog, locale))("Summary: {summary}", { summary: state.draft.summary }));
    expect(body).toContain("https://lablords.in/support");
    expect(body).not.toContain("private=discard");
    expect(fetch).not.toHaveBeenCalled();
  });
});
