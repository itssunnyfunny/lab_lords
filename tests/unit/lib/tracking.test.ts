import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGoogleAnalyticsBootstrapScript,
  getStoredCookieConsent,
  setStoredCookieConsent,
  trackPageView,
  updateGoogleAnalyticsConsent,
} from "@/lib/tracking";

describe("Google Analytics tracking", () => {
  let cookieWrites: string[];

  beforeEach(() => {
    cookieWrites = [];
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
        hostname: "example.com",
      },
    });
    const documentStub = {
      cookie: "",
      title: "Lab Lords",
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
        },
      ],
      [
        "event",
        "page_view",
        {
          page_path: "/privacy",
          page_location: "https://example.com/",
          page_title: "Lab Lords",
        },
      ],
      [
        "event",
        "page_view",
        {
          page_path: "/",
          page_location: "https://example.com/",
          page_title: "Lab Lords",
        },
      ],
    ]);
  });

  it("does not track page views while analytics storage is denied", () => {
    window.labLordsGaConsent = "rejected";

    trackPageView("/");

    expect(window.dataLayer).toHaveLength(0);
  });

  it("expires existing Google Analytics cookies when consent is rejected", () => {
    updateGoogleAnalyticsConsent("rejected");

    expect(cookieWrites).toContain("_ga=; Max-Age=0; Path=/; SameSite=Lax");
    expect(cookieWrites).toContain("_ga_TEST=; Max-Age=0; Path=/; SameSite=Lax");
    expect(cookieWrites.some(cookie => cookie.startsWith("essential="))).toBe(false);
  });

  it("places denied consent before config in the bootstrap script", () => {
    const script = getGoogleAnalyticsBootstrapScript("G-TEST123");

    expect(script).toContain('"analytics_storage":"denied"');
    expect(script).toContain('"ad_user_data":"denied"');
    expect(script.indexOf('"consent", "default"')).toBeLessThan(
      script.indexOf('"config", measurementId')
    );
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
