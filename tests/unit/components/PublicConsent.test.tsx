import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { publicLocales, publicHref } from "@/lib/public-i18n/routes";
import { publicConsentCatalog } from "@/lib/public-i18n/consent";
import { messagesFor, publicTranslator } from "@/lib/public-i18n/translate";
import type { ReactElement, ReactNode } from "react";

const mocks = vi.hoisted(() => ({ path: "/", setStored: vi.fn(), update: vi.fn(), setState: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => ({ owned: (value: string) => value }) }));
vi.mock("@/lib/tracking", () => ({ COOKIE_CONSENT_CHANGE_EVENT: "test", getStoredCookieConsent: () => null, setStoredCookieConsent: mocks.setStored, updateGoogleAnalyticsConsent: mocks.update, trackPageView: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => {}, useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }), useState: () => [false, mocks.setState], useSyncExternalStore: () => null }));

function buttons(node: ReactNode): ReactElement<{ onClick: () => void; children: ReactNode }>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(buttons);
  const element = node as ReactElement<{ children: ReactNode; onClick: () => void }>;
  return element.type === "button" ? [element] : buttons(element.props?.children);
}
describe.each(publicLocales)("%s consent interface", locale => {
  it("keeps the same accept/reject choices and English policy destination", () => {
    mocks.path = publicHref(locale, "/features");
    const t = publicTranslator(messagesFor(publicConsentCatalog, locale));
    const view = AnalyticsProvider({ measurementId: "test-only" });
    const html = renderToStaticMarkup(view);
    expect(html).toContain(t("Cookie preferences"));
    expect(html).toContain(t("Accept analytics"));
    expect(html).toContain(t("Reject"));
    expect(html).toContain('href="/cookies"');
    if (locale !== "en") expect(html).toContain(t("Manage (English)"));
    const controls = buttons(view);
    expect(controls).toHaveLength(2);
    controls[0].props.onClick(); expect(mocks.setStored).toHaveBeenLastCalledWith("accepted");
    controls[1].props.onClick(); expect(mocks.setStored).toHaveBeenLastCalledWith("rejected");
  });
});
