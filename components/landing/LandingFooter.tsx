import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { publicRich } from "@/lib/public-i18n/rich";
import { PublicBrandLockup } from "./PublicBrandLockup";
import { NatureDetail } from "./NatureDetail";
import { CookieSettingsButton } from "@/components/analytics/CookieSettingsButton";
import { getSoftwarePagePath, activeSoftwarePageSlugs, softwarePages } from "@/lib/softwarePages";

export async function LandingFooter({ preservePricingAnchor = false }: { preservePricingAnchor?: boolean }) {
  const { t, href: localHref } = await publicStrings();
  return <footer className="marketing-footer">
    <div className="marketing-container">
      <div className="marketing-footer-grid">
        <div className="marketing-footer-brand">
          <Link className="reference-lockup" href={localHref("/")} aria-label={t("Lab Lords home")}><PublicBrandLockup /></Link>
          <p>{publicRich(t, "Simple management for libraries{break} and the people who run them.", { break: <br /> })}</p>
          <span className="marketing-footer-tagline">{t("Made for places where learning grows.")}</span>
          <NatureDetail className="footer-nature" />
        </div>
        {/* Native navigation preserves fragment scrolling across public pages (browser regression covered). */}
        <div className="public-footer-product"><nav aria-label={t("Product links")}><h2>{t("Product")}</h2><Link href={localHref("/features")}>{t("Features")}</Link><Link id={preservePricingAnchor ? "pricing" : undefined} href={localHref("/pricing")}>{t("Pricing")}</Link><Link href={localHref("/how-it-works")}>{t("How it works")}</Link><a href={localHref("/#product-tour")}>{t("Explore an example")}</a></nav><nav aria-label={t("Resource links")} className="mt-6"><h2>{t("Resources")}</h2><Link href={localHref("/about")}>{t("About Lab Lords")}</Link><Link href={localHref("/faq")}>{t("FAQs")}</Link><Link href={localHref("/contact")}>{t("Contact us")}</Link><Link href={localHref("/support")}>{t("Support")}</Link></nav></div>
        <nav aria-label={t("Software links")} id="software"><h2>{t("For your library")}</h2>{activeSoftwarePageSlugs.map(slug => <Link key={slug} href={localHref(getSoftwarePagePath(slug))}>{t(softwarePages[slug].shortName)}</Link>)}</nav>
        <nav aria-label={t("Policies")}><h2>{t("Policies")}</h2><Link href={localHref("/privacy")}>{t("Privacy Policy")}</Link><Link href={localHref("/terms")}>{t("Terms of Service")}</Link><Link href={localHref("/refund-policy")}>{t("Cancellation and Refund Policy")}</Link><Link href={localHref("/shipping-delivery-policy")}>{t("Shipping and Delivery Policy")}</Link><Link href={localHref("/cookies")}>{t("Cookies")}</Link></nav>
      </div>
      <div className="marketing-footer-bottom"><p>{t("© {year} Lab Lords. All rights reserved.", { year: new Date().getFullYear() })}</p><CookieSettingsButton className="marketing-cookie-button">{t("Cookie settings")}</CookieSettingsButton></div>
    </div>
  </footer>;
}
