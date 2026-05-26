"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type CookieSettingsButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function CookieSettingsButton({
  className,
  children = "Cookie settings",
}: CookieSettingsButtonProps) {
  return (
    <button
      type="button"
      className={cn("inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ui-form-accent)] transition-colors hover:text-[color:var(--ui-form-accent-hover)]", className)}
      onClick={() => window.dispatchEvent(new Event("lab_lords:open_cookie_settings"))}
    >
      <SlidersHorizontal size={14} />
      {children}
    </button>
  );
}
