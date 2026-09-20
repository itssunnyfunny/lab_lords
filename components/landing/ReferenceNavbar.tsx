"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SignInCTA, WorkspaceCTA } from "./MarketingActions";
import { PublicBrandLockup } from "./PublicBrandLockup";

const items = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Contact", href: "/contact" },
];

export function ReferenceNavbar() {
  return <header className="brand-reference reference-header">
    <div className="reference-container reference-header-row">
      <Link className="reference-lockup" href="/" aria-label="Lab Lords home">
        <PublicBrandLockup />
      </Link>
      <nav aria-label="Primary navigation" className="reference-desktop-nav">
        {items.map(item => item.href.includes("#")
          ? <a key={item.href} href={item.href}>{item.label}</a>
          : <Link key={item.href} href={item.href}>{item.label}</Link>)}
      </nav>
      <div className="reference-header-actions">
        <span className="reference-desktop-signin"><SignInCTA /></span>
        <WorkspaceCTA source="landing_nav_workspace" />
        <details className="reference-mobile-menu" onKeyDown={event => {
          if (event.key === "Escape") {
            event.currentTarget.removeAttribute("open");
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}>
          <summary aria-controls="reference-mobile-navigation">
            <Menu className="reference-menu-open" size={22} aria-hidden="true" />
            <X className="reference-menu-close" size={22} aria-hidden="true" />
            <span className="sr-only">Navigation menu</span>
          </summary>
          <nav id="reference-mobile-navigation" aria-label="Mobile navigation" onClick={event => {
            if ((event.target as HTMLElement).closest("a,button")) event.currentTarget.closest("details")?.removeAttribute("open");
          }}>
            {items.map(item => item.href.includes("#")
              ? <a key={item.href} href={item.href}>{item.label}</a>
              : <Link key={item.href} href={item.href}>{item.label}</Link>)}
            <SignInCTA />
          </nav>
        </details>
      </div>
    </div>
  </header>;
}
