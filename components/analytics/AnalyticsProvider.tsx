"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  CookieConsent,
  getStoredCookieConsent,
  initializeGoogleAnalytics,
  setStoredCookieConsent,
  trackPageView,
} from "@/lib/tracking";

type AnalyticsProviderProps = {
  measurementId?: string;
};

export function AnalyticsProvider({ measurementId }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showPreferences, setShowPreferences] = useState(false);
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

  const analyticsReady = consent === "accepted" && Boolean(measurementId);

  useEffect(() => {
    if (!analyticsReady || !measurementId) return;
    initializeGoogleAnalytics(measurementId);
  }, [analyticsReady, measurementId]);

  useEffect(() => {
    if (!analyticsReady) return;
    trackPageView(pagePath);
  }, [analyticsReady, pagePath]);

  const saveConsent = (nextConsent: CookieConsent) => {
    setStoredCookieConsent(nextConsent);
    setShowPreferences(false);
  };

  const shouldShowBanner = showPreferences || consent === null;
  const analyticsEnabled = consent === "accepted" && Boolean(measurementId);

  return (
    <>
      {analyticsEnabled && (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
          strategy="afterInteractive"
        />
      )}

      {shouldShowBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-[color:var(--ui-panel-border)] bg-[color:var(--bg-app)]/95 px-4 py-4 shadow-[0_-20px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">Cookie preferences</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
                Lab Lords uses essential cookies for sign-in and optional analytics cookies to understand page usage. You can accept or reject optional analytics at any time.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-4 text-sm font-semibold text-[color:var(--ui-button-secondary-text)] transition-colors hover:bg-[color:var(--ui-button-secondary-hover-bg)]"
                onClick={() => saveConsent("rejected")}
              >
                Reject optional
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-primary-border)] bg-[color:var(--ui-button-primary-bg)] px-4 text-sm font-semibold text-[color:var(--ui-button-primary-text)] shadow-[var(--ui-button-primary-shadow)] transition-colors hover:bg-[color:var(--ui-button-primary-hover-bg)]"
                onClick={() => saveConsent("accepted")}
              >
                Accept analytics
              </button>
            </div>
          </div>
        </div>
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
