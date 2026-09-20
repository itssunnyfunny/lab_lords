import Link from "next/link";
import { PublicBrandLockup } from "./PublicBrandLockup";
import { NatureDetail } from "./NatureDetail";
import { CookieSettingsButton } from "@/components/analytics/CookieSettingsButton";
import { getSoftwarePagePath, softwarePageSlugs, softwarePages } from "@/lib/softwarePages";

export function LandingFooter() {
  return <footer className="marketing-footer">
    <div className="marketing-container">
      <div className="marketing-footer-grid">
        <div><Link className="reference-lockup" href="/" aria-label="Lab Lords home"><PublicBrandLockup /></Link><p>Software for managing students,<br /> seats, shifts and fees.</p><span className="marketing-footer-small">Made for your everyday library work.</span><NatureDetail className="footer-nature" /></div>
        {/* Native navigation preserves fragment scrolling across public pages (browser regression covered). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <nav aria-label="Product links"><h2>Product</h2><Link href="/features">Features</Link><Link href="/pricing">Pricing</Link><a href="/#how-it-works">How it works</a><a href="/#product-tour">Explore an example</a></nav>
        <nav aria-label="Software links" id="software"><h2>For your library</h2>{softwarePageSlugs.map(slug => <Link key={slug} href={getSoftwarePagePath(slug)}>{softwarePages[slug].shortName}</Link>)}</nav>
        <nav aria-label="Help and policies"><h2>Help &amp; information</h2><Link href="/contact">Contact</Link><Link href="/support">Support</Link><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><Link href="/refund-policy">Cancellation and Refund Policy</Link><Link href="/shipping-delivery-policy">Shipping and Delivery Policy</Link><Link href="/cookies">Cookies</Link></nav>
      </div>
      <div className="marketing-footer-bottom"><p>&copy; {new Date().getFullYear()} Lab Lords. All rights reserved.</p><CookieSettingsButton className="marketing-cookie-button">Cookie settings</CookieSettingsButton></div>
    </div>
  </footer>;
}
