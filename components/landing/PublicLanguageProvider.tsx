"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { publicHref, type PublicLocale } from "@/lib/public-i18n/routes";
import { publicTranslator, type PublicMessages } from "@/lib/public-i18n/translate";

const PublicLanguageContext = createContext<{ locale: PublicLocale; messages: PublicMessages } | null>(null);
export function PublicLanguageProvider({ locale, messages, children }: { locale: PublicLocale; messages: PublicMessages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <PublicLanguageContext.Provider value={value}>{children}</PublicLanguageContext.Provider>;
}
export function usePublicText() {
  const context = useContext(PublicLanguageContext);
  const locale = context?.locale ?? "en";
  return { locale, isPublic: context !== null, t: publicTranslator(context?.messages), href: (path: string) => publicHref(locale, path) };
}
