"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Check, Languages } from "lucide-react";
import { languageHref, publicLanguageNames, publicLanguageTags, publicLocales, publicRoute } from "@/lib/public-i18n/routes";
import { usePublicText } from "./PublicLanguageProvider";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => { window.removeEventListener("hashchange", callback); window.removeEventListener("popstate", callback); };
}
const snapshot = () => window.location.search + window.location.hash;

export function PublicLanguageLinks() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const suffix = useSyncExternalStore(subscribe, snapshot, () => "");
  const { t, locale } = usePublicText();
  if (!publicRoute(pathname)?.translated) return null;
  const hashIndex = suffix.indexOf("#");
  const hash = hashIndex < 0 ? "" : suffix.slice(hashIndex);
  return <details className="public-language-menu" onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("open");
  }}>
    <summary aria-label={`${t("Website language")}: ${publicLanguageNames[locale]}`} title={`${t("Website language")}: ${publicLanguageNames[locale]}`} aria-controls="public-language-options">
      <Languages size={20} aria-hidden="true" />
    </summary>
    <nav id="public-language-options" className="public-language-links" aria-label={t("Website language")}>
      {publicLocales.map(language => <Link key={language} href={languageHref(language, pathname, search, hash)!}
        hrefLang={publicLanguageTags[language]} lang={publicLanguageTags[language]} aria-current={language === locale ? "page" : undefined}>
        {publicLanguageNames[language]}{language === locale && <Check size={16} aria-hidden="true" />}
      </Link>)}
    </nav>
  </details>;
}
