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
const PUBLIC_ANALYTICS_PATHS = new Set([
  "/",
  "/cookies",
  "/privacy",
  "/support",
  "/terms",
]);
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

export function getGoogleAnalyticsBootstrapScript(measurementId: string) {
  const serializedMeasurementId = JSON.stringify(measurementId);
  const serializedDeniedConsent = JSON.stringify(DENIED_CONSENT);
  const serializedConfig = JSON.stringify(GOOGLE_ANALYTICS_CONFIG);

  return `
(function () {
  var measurementId = ${serializedMeasurementId};
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.labLordsGaConsent = "rejected";
  window.labLordsGaMeasurementId = measurementId;
  window.labLordsGaPagePath = undefined;
  window.gtag("consent", "default", ${serializedDeniedConsent});
  window.gtag("set", "ads_data_redaction", true);
  window.gtag("set", "url_passthrough", false);
  window.gtag("js", new Date());
  window.gtag("config", measurementId, ${serializedConfig});
})();
  `.trim();
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

export function trackPageView(path: string, title?: string) {
  if (
    typeof window === "undefined" ||
    !window.gtag ||
    window.labLordsGaConsent !== "accepted"
  ) return;
  if (window.labLordsGaPagePath === path) return;

  window.labLordsGaPagePath = path;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: title ?? document.title,
  });
}

export function trackEvent(name: string, properties: TrackingProperties = {}) {
  if (
    typeof window === "undefined" ||
    !window.gtag ||
    window.labLordsGaConsent !== "accepted"
  ) return;

  const cleanProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );

  window.gtag("event", name, cleanProperties);
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

export function isPublicAnalyticsPage(pathname: string) {
  return PUBLIC_ANALYTICS_PATHS.has(pathname) || pathname.startsWith("/software/");
}

function expireCookie(name: string, domain?: string) {
  const domainAttribute = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domainAttribute}`;
}
