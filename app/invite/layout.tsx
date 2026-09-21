import type { ReactNode } from "react";
import { publicDisplayFont } from "@/lib/publicMarketingFonts";
import "@/styles/marketing.css";
import "@/styles/brand-reference.css";

/** Presentation only: invite preview and explicit acceptance retain their own guards. */
export default function InviteLayout({ children }: { children: ReactNode }) {
  return <div data-brand="botanical-reference" className={`marketing-root ${publicDisplayFont.variable}`}>{children}</div>;
}
