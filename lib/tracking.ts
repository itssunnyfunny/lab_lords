export type TrackingProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    labLordsGaMeasurementId?: string;
    labLordsGaPagePath?: string;
  }
}

const RESERVED_PREFIX = "lab_lords";

export const COOKIE_CONSENT_KEY = `${RESERVED_PREFIX}_cookie_consent`;
export const COOKIE_CONSENT_CHANGE_EVENT = `${COOKIE_CONSENT_KEY}_changed`;

export type CookieConsent = "accepted" | "rejected";

export function getStoredCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

export function setStoredCookieConsent(consent: CookieConsent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function initializeGoogleAnalytics(measurementId: string) {
  if (typeof window === "undefined" || !measurementId) return;
  if (window.labLordsGaMeasurementId === measurementId) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag() {
    // Google tag expects the native arguments object, not a rest-parameter array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.labLordsGaMeasurementId = measurementId;
  window.labLordsGaPagePath = undefined;

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
}

export function trackPageView(path: string, title?: string) {
  if (typeof window === "undefined" || !window.gtag) return;
  if (window.labLordsGaPagePath === path) return;

  window.labLordsGaPagePath = path;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: title ?? document.title,
  });
}

export function trackEvent(name: string, properties: TrackingProperties = {}) {
  if (typeof window === "undefined" || !window.gtag) return;

  const cleanProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );

  window.gtag("event", name, cleanProperties);
}
