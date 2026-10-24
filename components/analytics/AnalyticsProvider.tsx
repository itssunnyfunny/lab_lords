"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { messagesFor, publicTranslator } from "@/lib/public-i18n/translate";
import { publicConsentCatalog } from "@/lib/public-i18n/consent";
import { publicRoute } from "@/lib/public-i18n/routes";
import { AppPanel } from "@/components/ui/AppPanel";
import { appActionClassName } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  activateGoogleAnalyticsForPublicPath,
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
  const appText = useTranslation();
  const pathname = usePathname();
  const route = publicRoute(pathname);
  const t = route ? publicTranslator(messagesFor(publicConsentCatalog, route.locale)) : appText.owned;
  const [showPreferences, setShowPreferences] = useState(false);
  const appliedConsent = useRef<CookieConsent | null>(null);
  const consent = useSyncExternalStore(
    subscribeToCookieConsent,
    getStoredCookieConsent,
    () => null
  );

  useEffect(() => {
    const openPreferences = () => setShowPreferences(true);
    window.addEventListener("lab_lords:open_cookie_settings", openPreferences);

    return () => {
      window.removeEventListener("lab_lords:open_cookie_settings", openPreferences);
    };
  }, []);

  useEffect(() => {
    if (!measurementId) return;
    activateGoogleAnalyticsForPublicPath(measurementId, pathname);
    if (window.labLordsGaMeasurementId === measurementId &&
        consent !== null && appliedConsent.current !== consent) {
      updateGoogleAnalyticsConsent(consent);
      appliedConsent.current = consent;
    }
    trackPageView(pathname);
  }, [consent, measurementId, pathname]);

  const saveConsent = (nextConsent: CookieConsent) => {
    if (measurementId && window.labLordsGaMeasurementId === measurementId) {
      updateGoogleAnalyticsConsent(nextConsent);
      appliedConsent.current = nextConsent;
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
          aria-label={t("Cookie preferences")}
          className="app-design-pilot-overlay fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-2xl [padding-bottom:env(safe-area-inset-bottom)] sm:left-auto sm:right-5 sm:mx-0"
        >
          <AppPanel density="compact" title={t("Cookie preferences")}>
          <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
            {t("We use essential cookies to run Lab Lords and optional analytics to understand website usage.")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(appActionClassName("primary"), "min-h-11")}
              onClick={() => saveConsent("accepted")}
            >
              {t("Accept analytics")}
            </button>
            <button
              type="button"
              className={cn(appActionClassName("secondary"), "min-h-11")}
              onClick={() => saveConsent("rejected")}
            >
              {t("Reject")}
            </button>
            <Link
              href="/cookies"
              className={cn(appActionClassName("quiet"), "min-h-11")}
              onClick={() => setShowPreferences(false)}
            >
              {t(route && route.locale !== "en" ? "Manage (English)" : "Manage")}</Link>
          </div>
          </AppPanel>
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
