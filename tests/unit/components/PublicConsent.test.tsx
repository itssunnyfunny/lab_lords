import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { publicLocales, publicHref } from "@/lib/public-i18n/routes";
import { publicConsentCatalog } from "@/lib/public-i18n/consent";
import { messagesFor, publicTranslator } from "@/lib/public-i18n/translate";
import type { ReactElement, ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  path: "/", consent: null as "accepted" | "rejected" | null,
  effects: [] as Array<() => void>, applied: { current: null as "accepted" | "rejected" | null },
  order: [] as string[], setStored: vi.fn(), update: vi.fn(), setState: vi.fn(),
  activate: vi.fn(), track: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => ({ owned: (value: string) => value }) }));
vi.mock("@/lib/tracking", () => ({ COOKIE_CONSENT_CHANGE_EVENT: "test", getStoredCookieConsent: () => mocks.consent, setStoredCookieConsent: mocks.setStored, updateGoogleAnalyticsConsent: mocks.update, activateGoogleAnalyticsForPublicPath: mocks.activate, trackPageView: mocks.track }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => void) => { mocks.effects.push(effect); }, useRef: () => mocks.applied, useState: () => [false, mocks.setState], useSyncExternalStore: () => mocks.consent }));

beforeEach(() => {
  mocks.path = "/";
  mocks.consent = null;
  mocks.effects = [];
  mocks.applied.current = null;
  mocks.order = [];
  vi.clearAllMocks();
  mocks.activate.mockImplementation((_id: string, path: string) => {
    mocks.order.push(`activate:${path}`);
    if (path === "/" || path === "/features") {
      window.labLordsGaMeasurementId = _id;
      return true;
    }
    return false;
  });
  mocks.update.mockImplementation(() => { mocks.order.push("consent"); });
  mocks.track.mockImplementation((path: string) => { mocks.order.push(`track:${path}`); });
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

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

it("initializes on private-to-public navigation before applying saved consent and tracking", () => {
  mocks.consent = "accepted";
  mocks.path = "/sign-in";
  const visit = (path: string) => {
    mocks.path = path;
    mocks.effects = [];
    AnalyticsProvider({ measurementId: "G-TEST123" });
    mocks.effects.forEach(effect => effect());
  };

  visit("/sign-in");
  expect(mocks.order).toEqual(["activate:/sign-in", "track:/sign-in"]);
  expect(mocks.applied.current).toBeNull();

  mocks.order = [];
  visit("/");
  expect(mocks.order).toEqual(["activate:/", "consent", "track:/"]);
  expect(mocks.applied.current).toBe("accepted");

  mocks.order = [];
  visit("/invite/v2.synthetic-secret");
  visit("/");
  expect(mocks.order).toEqual([
    "activate:/invite/v2.synthetic-secret", "track:/invite/v2.synthetic-secret",
    "activate:/", "track:/",
  ]);
  expect(mocks.update).toHaveBeenCalledOnce();
});

it("keeps a choice made on a private page until the tag initializes on a public page", () => {
  mocks.path = "/sign-in";
  const view = AnalyticsProvider({ measurementId: "G-TEST123" });
  buttons(view)[0].props.onClick();
  expect(mocks.setStored).toHaveBeenCalledWith("accepted");
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.applied.current).toBeNull();

  mocks.consent = "accepted";
  mocks.path = "/";
  mocks.effects = [];
  AnalyticsProvider({ measurementId: "G-TEST123" });
  mocks.effects.forEach(effect => effect());
  expect(mocks.order).toEqual(["activate:/", "consent", "track:/"]);
});

it("applies a cross-tab rejection after a loaded tag navigates to a private page", () => {
  const visit = (path: string) => {
    mocks.path = path;
    mocks.effects = [];
    AnalyticsProvider({ measurementId: "G-TEST123" });
    mocks.effects.forEach(effect => effect());
  };
  mocks.consent = "accepted";
  visit("/");
  visit("/app");
  mocks.order = [];

  mocks.consent = "rejected";
  visit("/app");
  expect(mocks.order).toEqual(["activate:/app", "consent", "track:/app"]);
  expect(mocks.update).toHaveBeenLastCalledWith("rejected");
});
