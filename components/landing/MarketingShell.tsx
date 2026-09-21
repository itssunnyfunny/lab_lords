import type { ReactNode } from "react";
import { ReferenceNavbar } from "./ReferenceNavbar";
import { LandingFooter } from "./LandingFooter";
import { publicDisplayFont } from "@/lib/publicMarketingFonts";
import "@/styles/marketing.css";
import "@/styles/brand-reference.css";
import "@/styles/public-pages-reference.css";

export function MarketingShell({ children, header, preservePricingAnchor = false }: { children: ReactNode; header?: ReactNode; preservePricingAnchor?: boolean }) {
  return <div data-brand="botanical-reference" className={`marketing-root ${publicDisplayFont.variable}`}>
    <a className="marketing-skip" href="#main-content">Skip to content</a>
    {header ?? <ReferenceNavbar />}
    <main id="main-content">{children}</main>
    <LandingFooter preservePricingAnchor={preservePricingAnchor} />
  </div>;
}
