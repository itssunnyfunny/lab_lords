import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeGoogleAnalytics,
  trackPageView,
} from "@/lib/tracking";

describe("Google Analytics tracking", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      dataLayer: undefined,
      gtag: undefined,
      labLordsGaMeasurementId: undefined,
      labLordsGaPagePath: undefined,
      location: {
        href: "https://example.com/",
      },
    });
    vi.stubGlobal("document", {
      title: "Lab Lords",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes a measurement ID only once", () => {
    initializeGoogleAnalytics("G-TEST123");
    initializeGoogleAnalytics("G-TEST123");

    expect(window.dataLayer).toHaveLength(2);
    expect(Array.from(window.dataLayer?.[0] as ArrayLike<unknown>)).toEqual([
      "js",
      expect.any(Date),
    ]);
    expect(Array.from(window.dataLayer?.[1] as ArrayLike<unknown>)).toEqual([
      "config",
      "G-TEST123",
      { send_page_view: false },
    ]);
  });

  it("tracks the first page and App Router path changes without duplicates", () => {
    initializeGoogleAnalytics("G-TEST123");

    trackPageView("/");
    trackPageView("/");
    trackPageView("/privacy");
    trackPageView("/");

    expect(
      window.dataLayer
        ?.slice(2)
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
});
