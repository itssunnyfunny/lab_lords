"use client";
// Native homepage fragment links preserve full cross-page scrolling, including the solution index in the footer.
/* eslint-disable @next/next/no-html-link-for-pages */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { SignInCTA, WorkspaceCTA } from "./MarketingActions";
import { PublicBrandLockup } from "./PublicBrandLockup";

const items = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "How it works", href: "/how-it-works" },
];
const resources = [
  { label: "About Lab Lords", href: "/about" },
  { label: "FAQs", href: "/faq" },
  { label: "Support", href: "/support" },
];

export function ReferenceNavbar() {
  const pathname = usePathname();
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    header.current?.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
  }, [pathname]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        header.current?.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const current = (href: string) => pathname === href ? "page" as const : undefined;
  const resourceLinks = resources.map(item => <Link key={item.href} href={item.href} aria-current={current(item.href)}>{item.label}</Link>);
  return <header ref={header} className="brand-reference reference-header" onKeyDown={event => {
    if (event.key !== "Escape") return;
    const menu = (event.target as HTMLElement).closest("details[open]");
    menu?.removeAttribute("open");
    menu?.querySelector("summary")?.focus();
    event.stopPropagation();
  }} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
      event.currentTarget.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
    }
  }} onClick={event => {
    if ((event.target as HTMLElement).closest("a,button")) header.current?.querySelectorAll("details[open]").forEach(menu => menu.removeAttribute("open"));
  }}>
    <div className="reference-container reference-header-row">
      <Link className="reference-lockup" href="/" aria-label="Lab Lords home">
        <PublicBrandLockup />
      </Link>
      <nav aria-label="Primary navigation" className="reference-desktop-nav">
        {items.map(item => <Link key={item.href} href={item.href} aria-current={current(item.href)}>{item.label}</Link>)}
        <details className="reference-resources">
          <summary className={resources.some(item => item.href === pathname) ? "reference-current-group" : undefined}>Resources <ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="reference-resource-links">{resourceLinks}<a href="/#software">Solutions for your space</a></div>
        </details>
        <Link href="/contact" aria-current={current("/contact")}>Contact us</Link>
      </nav>
      <div className="reference-header-actions">
        <span className="reference-desktop-signin"><SignInCTA /></span>
        <WorkspaceCTA source="landing_nav_workspace" />
        <details className="reference-mobile-menu">
          <summary aria-controls="reference-mobile-navigation">
            <Menu className="reference-menu-open" size={22} aria-hidden="true" />
            <X className="reference-menu-close" size={22} aria-hidden="true" />
            <span className="sr-only">Navigation menu</span>
          </summary>
          <nav id="reference-mobile-navigation" aria-label="Mobile navigation" onClick={event => {
            if ((event.target as HTMLElement).closest("a,button")) event.currentTarget.closest("details")?.removeAttribute("open");
          }}>
            <div className="reference-mobile-links">
              {items.map(item => <Link key={item.href} href={item.href} aria-current={current(item.href)}>{item.label}</Link>)}
              <Link href="/contact" aria-current={current("/contact")}>Contact us</Link>
              <div className="reference-mobile-resources"><p>Resources</p>{resourceLinks}<a href="/#software">Solutions for your space</a></div>
            </div>
            <div className="reference-mobile-actions">
              <SignInCTA />
              <WorkspaceCTA source="landing_mobile_nav_workspace" />
            </div>
          </nav>
        </details>
      </div>
    </div>
  </header>;
}
