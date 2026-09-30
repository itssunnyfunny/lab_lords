import { publicHref, publicRoute } from "@/lib/public-i18n/routes";

export type TrackingProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    labLordsGaConsent?: CookieConsent;
    labLordsGaMeasurementId?: string;
    labLordsGaPagePath?: string;
  }
}

const RESERVED_PREFIX = "lab_lords";
const GOOGLE_ANALYTICS_COOKIE_PREFIX = "_ga";
const DENIED_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;
const GOOGLE_ANALYTICS_CONFIG = {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;
const TRACKING_URL_FIELDS = new Set(["page_path", "page_location", "page_referrer", "page_title"]);

export const COOKIE_CONSENT_KEY = `${RESERVED_PREFIX}_cookie_consent_v2`;
export const COOKIE_CONSENT_CHANGE_EVENT = `${COOKIE_CONSENT_KEY}_changed`;

export type CookieConsent = "accepted" | "rejected";

let fallbackCookieConsent: CookieConsent | null = null;

export function getStoredCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (value === "accepted" || value === "rejected") {
      fallbackCookieConsent = value;
    }
  } catch {
    // Some privacy modes disable localStorage. Keep consent usable for this page session.
  }

  return fallbackCookieConsent;
}

export function setStoredCookieConsent(consent: CookieConsent) {
  if (typeof window === "undefined") return;

  fallbackCookieConsent = consent;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  } catch {
    // The in-memory fallback still lets the user dismiss the prompt for this page session.
  }

  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

/** Load the tag only after client routing reaches an allowlisted public page. */
export function activateGoogleAnalyticsForPublicPath(measurementId: string, path: string) {
  if (typeof window === "undefined" || typeof document === "undefined" || !safePublicPage(path)) {
    return false;
  }
  if (window.labLordsGaMeasurementId === measurementId) return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    // Google processes queued gtag commands as Arguments objects.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.labLordsGaConsent = "rejected";
  window.labLordsGaMeasurementId = measurementId;
  window.labLordsGaPagePath = undefined;
  window.gtag("consent", "default", DENIED_CONSENT);
  window.gtag("set", "ads_data_redaction", true);
  window.gtag("set", "url_passthrough", false);
  const safeOrigin = `${window.location.origin}/`;
  window.gtag("set", "page_location", safeOrigin);
  window.gtag("set", "page_referrer", "");
  window.gtag("set", "page_title", "Lab Lords");
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    ...GOOGLE_ANALYTICS_CONFIG,
    page_location: safeOrigin,
    page_referrer: "",
    page_title: "Lab Lords",
  });

  const script = document.createElement("script");
  script.id = "google-analytics";
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  return true;
}

export function updateGoogleAnalyticsConsent(consent: CookieConsent) {
  if (typeof window === "undefined" || !window.gtag) return;

  window.labLordsGaConsent = consent;
  window.gtag("consent", "update", {
    analytics_storage: consent === "accepted" ? "granted" : "denied",
  });

  if (consent === "rejected") {
    window.labLordsGaPagePath = undefined;
    clearGoogleAnalyticsCookies();
  }
}

function safePublicPage(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const pathname = path.split(/[?#]/, 1)[0];
  const route = publicRoute(pathname);
  if (!route) return null;
  const safePath = publicHref(route.locale, route.path);
  return {
    page_path: safePath,
    page_location: `${window.location.origin}${safePath}`,
    page_referrer: "",
    page_title: "Lab Lords",
  };
}

export function trackPageView(path: string) {
  if (typeof window === "undefined" || !window.gtag) return;
  const page = safePublicPage(path);
  if (!page) {
    window.labLordsGaPagePath = undefined;
    return;
  }
  if (window.labLordsGaPagePath === page.page_path) return;

  window.labLordsGaPagePath = page.page_path;

  window.gtag("event", "page_view", page);
}

export function trackEvent(name: string, properties: TrackingProperties = {}) {
  if (
    typeof window === "undefined" ||
    !window.gtag ||
    window.labLordsGaConsent !== "accepted"
  ) return;
  const page = safePublicPage(window.location.pathname);
  if (!page) return;

  const cleanProperties = Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => value !== undefined && !TRACKING_URL_FIELDS.has(key))
  );

  window.gtag("event", name, { ...cleanProperties, ...page });
}

export function clearGoogleAnalyticsCookies() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const cookieNames = document.cookie
    .split(";")
    .map(cookie => cookie.split("=", 1)[0]?.trim())
    .filter((name): name is string =>
      Boolean(name && (name === GOOGLE_ANALYTICS_COOKIE_PREFIX || name.startsWith(`${GOOGLE_ANALYTICS_COOKIE_PREFIX}_`)))
    );

  const hostname = window.location.hostname;
  const domainParts = hostname.split(".");
  const registrableDomain = domainParts.length > 1
    ? domainParts.slice(-2).join(".")
    : hostname;
  const domains = new Set([
    hostname,
    `.${hostname}`,
    registrableDomain,
    `.${registrableDomain}`,
  ]);

  for (const name of cookieNames) {
    expireCookie(name);

    for (const domain of domains) {
      expireCookie(name, domain);
    }
  }
}

function expireCookie(name: string, domain?: string) {
  const domainAttribute = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domainAttribute}`;
}
