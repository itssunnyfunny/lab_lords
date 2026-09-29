import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateGoogleAnalyticsForPublicPath,
  getStoredCookieConsent,
  setStoredCookieConsent,
  trackEvent,
  trackPageView,
  updateGoogleAnalyticsConsent,
} from "@/lib/tracking";

describe("Google Analytics tracking", () => {
  let cookieWrites: string[];
  let appendedScripts: Array<Record<string, unknown>>;
  let queuedAtAppend: unknown[][];

  beforeEach(() => {
    cookieWrites = [];
    appendedScripts = [];
    queuedAtAppend = [];
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      dataLayer,
      dispatchEvent: vi.fn(),
      gtag: (...args: unknown[]) => dataLayer.push(args),
      labLordsGaConsent: undefined,
      labLordsGaMeasurementId: undefined,
      labLordsGaPagePath: undefined,
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
      location: {
        href: "https://example.com/",
        origin: "https://example.com",
        hostname: "example.com",
        pathname: "/",
      },
    });
    const documentStub = {
      cookie: "",
      title: "Lab Lords",
      referrer: "https://example.com/invite/v2.synthetic-secret?return=synthetic-secret",
      createElement: vi.fn(() => ({})),
      head: { appendChild: vi.fn((script: Record<string, unknown>) => {
        queuedAtAppend = (window.dataLayer ?? []).map(entry => Array.from(entry as ArrayLike<unknown>));
        appendedScripts.push(script);
      }) },
    };
    Object.defineProperty(documentStub, "cookie", {
      get: () => "_ga=client-id; _ga_TEST=session-id; essential=kept",
      set: (value: string) => cookieWrites.push(value),
    });
    vi.stubGlobal("document", documentStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates analytics consent while keeping advertising consent denied", () => {
    updateGoogleAnalyticsConsent("accepted");
    updateGoogleAnalyticsConsent("rejected");

    expect(window.dataLayer).toEqual([
      [
        "consent",
        "update",
        { analytics_storage: "granted" },
      ],
      [
        "consent",
        "update",
        { analytics_storage: "denied" },
      ],
    ]);
  });

  it("tracks accepted page views and App Router path changes without duplicates", () => {
    updateGoogleAnalyticsConsent("accepted");

    trackPageView("/");
    trackPageView("/");
    trackPageView("/privacy");
    trackPageView("/");

    expect(
      window.dataLayer
        ?.slice(1)
        .map((entry) => Array.from(entry as ArrayLike<unknown>))
    ).toEqual([
      [
        "event",
        "page_view",
        {
          page_path: "/",
          page_location: "https://example.com/",
          page_title: "Lab Lords",
          page_referrer: "",
        },
      ],
      [
        "event",
        "page_view",
        {
          page_path: "/privacy",
          page_location: "https://example.com/privacy",
          page_title: "Lab Lords",
          page_referrer: "",
        },
      ],
      [
        "event",
        "page_view",
        {
          page_path: "/",
          page_location: "https://example.com/",
          page_title: "Lab Lords",
          page_referrer: "",
        },
      ],
    ]);
  });

  it("sends cookieless page views while analytics storage is denied", () => {
    window.labLordsGaConsent = "rejected";

    trackPageView("/");

    expect(window.dataLayer).toEqual([
      [
        "event",
        "page_view",
        {
          page_path: "/",
          page_location: "https://example.com/",
          page_title: "Lab Lords",
          page_referrer: "",
        },
      ],
    ]);
  });

  it("keeps custom analytics events disabled until consent is accepted", () => {
    window.labLordsGaConsent = "rejected";

    trackEvent("pricing_viewed", { plan: "Growth" });

    expect(window.dataLayer).toHaveLength(0);
  });

  it.each([null, "rejected", "accepted"] as const)("omits a synthetic invitation and auth return URL with %s consent", consent => {
    window.labLordsGaConsent = consent ?? undefined;
    for (const path of [
      "/invite/v2.synthetic-hash.synthetic-secret",
      "/sign-in?redirect_url=%2Finvite%2Fv2.synthetic-hash.synthetic-secret",
      "/sign-up?redirect_url=%2Finvite%2Fv2.synthetic-hash.synthetic-secret",
    ]) {
      window.location.href = `https://example.com${path}`;
      window.location.pathname = path.split("?")[0];
      trackPageView(path);
      trackEvent("landing_cta_clicked", { source: "test" });
    }
    expect(window.dataLayer).toEqual([]);
  });

  it("removes public query, fragment and sensitive referrer from page views", () => {
    window.location.href = "https://example.com/pricing?redirect_url=synthetic-secret#synthetic-secret";
    trackPageView("/pricing?redirect_url=synthetic-secret#synthetic-secret");
    expect(window.dataLayer).toEqual([[
      "event", "page_view", {
        page_path: "/pricing",
        page_location: "https://example.com/pricing",
        page_referrer: "",
        page_title: "Lab Lords",
      },
    ]]);
    expect(JSON.stringify(window.dataLayer)).not.toContain("synthetic-secret");
  });

  it("keeps custom events on public routes but protects their URL fields", () => {
    window.labLordsGaConsent = "accepted";
    window.location.href = "https://example.com/pricing?redirect_url=synthetic-secret";
    window.location.pathname = "/pricing";
    trackEvent("landing_cta_clicked", {
      source: "landing_pricing_basic",
      page_path: "/invite/v2.synthetic-secret",
      page_location: "https://example.com/invite/v2.synthetic-secret",
      page_referrer: "https://example.com/invite/v2.synthetic-secret",
    });
    expect(window.dataLayer).toEqual([[
      "event", "landing_cta_clicked", {
        source: "landing_pricing_basic",
        page_path: "/pricing",
        page_location: "https://example.com/pricing",
        page_referrer: "",
        page_title: "Lab Lords",
      },
    ]]);
    expect(JSON.stringify(window.dataLayer)).not.toContain("synthetic-secret");
  });

  it("loads only after private-to-public routing with safe defaults before the external script", () => {
    window.gtag = undefined;
    window.location.href = "https://example.com/invite/v2.synthetic-secret";
    window.location.pathname = "/invite/v2.synthetic-secret";
    expect(activateGoogleAnalyticsForPublicPath("G-TEST123", window.location.pathname)).toBe(false);
    expect(window.dataLayer).toEqual([]);
    expect(appendedScripts).toHaveLength(0);

    window.location.href = "https://example.com/pricing?return=synthetic-secret";
    window.location.pathname = "/pricing";
    expect(activateGoogleAnalyticsForPublicPath("G-TEST123", "/pricing")).toBe(true);
    const queued = (window.dataLayer ?? []).map(entry => Array.from(entry as ArrayLike<unknown>));
    expect(Object.prototype.toString.call(window.dataLayer?.[0])).toBe("[object Arguments]");
    const config = queued.find(args => args[0] === "config");
    expect(queued[0]).toEqual(["consent", "default", {
      analytics_storage: "denied", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied",
    }]);
    expect(queued.findIndex(args => args[0] === "set" && args[1] === "page_location"))
      .toBeLessThan(queued.findIndex(args => args[0] === "config"));
    expect(config?.[2]).toMatchObject({
      send_page_view: false,
      page_location: "https://example.com/",
      page_referrer: "",
      page_title: "Lab Lords",
    });
    expect(appendedScripts).toEqual([{
      id: "google-analytics", async: true, referrerPolicy: "no-referrer",
      src: "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    }]);
    expect(queuedAtAppend).toEqual(queued);
    expect(activateGoogleAnalyticsForPublicPath("G-TEST123", "/features")).toBe(true);
    expect(appendedScripts).toHaveLength(1);
    expect(JSON.stringify(queued)).not.toContain("synthetic-secret");
  });

  it("clears page-view deduplication across public-private-public navigation", () => {
    activateGoogleAnalyticsForPublicPath("G-TEST123", "/");
    trackPageView("/");
    trackPageView("/sign-in?redirect_url=synthetic-secret");
    trackPageView("/");
    expect((window.dataLayer as unknown[][]).filter(args => args[0] === "event" && args[1] === "page_view"))
      .toHaveLength(2);
    expect(JSON.stringify(window.dataLayer)).not.toContain("synthetic-secret");
  });

  it("expires existing Google Analytics cookies when consent is rejected", () => {
    updateGoogleAnalyticsConsent("rejected");

    expect(cookieWrites).toContain("_ga=; Max-Age=0; Path=/; SameSite=Lax");
    expect(cookieWrites).toContain("_ga_TEST=; Max-Age=0; Path=/; SameSite=Lax");
    expect(cookieWrites.some(cookie => cookie.startsWith("essential="))).toBe(false);
  });

  it("keeps consent usable when localStorage is unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    });

    setStoredCookieConsent("accepted");

    expect(getStoredCookieConsent()).toBe("accepted");
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });
});
