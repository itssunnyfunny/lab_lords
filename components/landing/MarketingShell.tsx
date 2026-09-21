import type { ReactNode } from "react";
import { ReferenceNavbar } from "./ReferenceNavbar";
import { LandingFooter } from "./LandingFooter";
import { publicDisplayFont } from "@/lib/publicMarketingFonts";
import "@/styles/marketing.css";
import "@/styles/brand-reference.css";
import "@/styles/public-pages-reference.css";
import { publicStrings } from "@/lib/public-i18n/server";
import { PublicLanguageProvider } from "./PublicLanguageProvider";
import "@/styles/public-languages.css";

export async function MarketingShell({ children, header, preservePricingAnchor = false }: { children: ReactNode; header?: ReactNode; preservePricingAnchor?: boolean }) {
  const { locale, t, uiMessages } = await publicStrings();
  return <PublicLanguageProvider locale={locale} messages={uiMessages}><div data-brand="botanical-reference" data-public-locale={locale} className={`marketing-root ${publicDisplayFont.variable}`}>
    <a className="marketing-skip" href="#main-content">{t("Skip to content")}</a>
    {header ?? <ReferenceNavbar />}
    <main id="main-content">{children}</main>
    <LandingFooter preservePricingAnchor={preservePricingAnchor} />
  </div></PublicLanguageProvider>;
}
