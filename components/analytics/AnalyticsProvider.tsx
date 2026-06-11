"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  CookieConsent,
  getStoredCookieConsent,
  setStoredCookieConsent,
  trackPageView,
  updateGoogleAnalyticsConsent,
} from "@/lib/tracking";

type AnalyticsProviderProps = {
  measurementId?: string;
};

export function AnalyticsProvider({ measurementId }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showPreferences, setShowPreferences] = useState(false);
  const appliedConsent = useRef<CookieConsent | null>(null);
  const consent = useSyncExternalStore(
    subscribeToCookieConsent,
    getStoredCookieConsent,
    () => null
  );

  const pagePath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    const openPreferences = () => setShowPreferences(true);
    window.addEventListener("lab_lords:open_cookie_settings", openPreferences);

    return () => {
      window.removeEventListener("lab_lords:open_cookie_settings", openPreferences);
    };
  }, []);

  useEffect(() => {
    if (!measurementId || consent === null || appliedConsent.current === consent) return;

    updateGoogleAnalyticsConsent(consent);
    appliedConsent.current = consent;

    if (consent === "accepted") {
      trackPageView(pagePath);
    }
  }, [consent, measurementId, pagePath]);

  useEffect(() => {
    if (!measurementId || consent !== "accepted") return;
    trackPageView(pagePath);
  }, [consent, measurementId, pagePath]);

  const saveConsent = (nextConsent: CookieConsent) => {
    updateGoogleAnalyticsConsent(nextConsent);
    appliedConsent.current = nextConsent;

    if (nextConsent === "accepted") {
      trackPageView(pagePath);
    }

    setStoredCookieConsent(nextConsent);
    setShowPreferences(false);
  };

  const shouldShowBanner =
    Boolean(measurementId) &&
    (showPreferences || consent === null);

  return (
    <>
      {shouldShowBanner && (
        <aside
          aria-label="Cookie preferences"
          className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-2xl rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--bg-app)]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:left-auto sm:right-5 sm:mx-0 sm:p-5"
        >
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            We use essential cookies to run Lab Lords and optional analytics to understand website usage.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-primary-border)] bg-[color:var(--ui-button-primary-bg)] px-3.5 text-sm font-semibold text-[color:var(--ui-button-primary-text)] shadow-[var(--ui-button-primary-shadow)] transition-colors hover:bg-[color:var(--ui-button-primary-hover-bg)]"
              onClick={() => saveConsent("accepted")}
            >
              Accept analytics
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-3.5 text-sm font-semibold text-[color:var(--ui-button-secondary-text)] transition-colors hover:bg-[color:var(--ui-button-secondary-hover-bg)]"
              onClick={() => saveConsent("rejected")}
            >
              Reject
            </button>
            <Link
              href="/cookies"
              className="inline-flex h-9 items-center justify-center rounded-[var(--ui-radius-control)] px-3 text-sm font-semibold text-[color:var(--ui-form-accent)] transition-colors hover:text-[color:var(--ui-form-accent-hover)]"
              onClick={() => setShowPreferences(false)}
            >
              Manage
            </Link>
          </div>
        </aside>
      )}
    </>
  );
}

function subscribeToCookieConsent(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, callback);
  };
}
