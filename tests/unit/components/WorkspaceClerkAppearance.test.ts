import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  accountMenuClerkAppearance,
  accountProfileClerkAppearance,
  entryClerkAppearance,
  workspaceAccountMenuClerkAppearance,
  workspaceAccountProfileClerkAppearance,
} from "@/components/ui/entrySurface";

describe("selected workspace account appearance", () => {
  it("overrides every dark account element with semantic workspace tokens", () => {
    for (const key of Object.keys(accountMenuClerkAppearance.elements)) {
      expect(workspaceAccountMenuClerkAppearance.elements).toHaveProperty(key);
    }
    for (const key of Object.keys(accountProfileClerkAppearance.elements)) {
      expect(workspaceAccountProfileClerkAppearance.elements).toHaveProperty(key);
    }
    for (const key of Object.keys(entryClerkAppearance.elements)) {
      expect(workspaceAccountProfileClerkAppearance.elements).toHaveProperty(key);
    }
    const { avatarBox, ...popoverElements } = workspaceAccountMenuClerkAppearance.elements;
    expect(avatarBox).toBe(accountMenuClerkAppearance.elements.avatarBox);
    expect(workspaceAccountMenuClerkAppearance.variables.colorBackground).toBe("var(--ui-panel-bg)");
    expect(workspaceAccountProfileClerkAppearance.variables.colorForeground).toBe("var(--text-primary)");
    expect(JSON.stringify([popoverElements, workspaceAccountProfileClerkAppearance]))
      .not.toMatch(/#0f111a|#0b0d14|slate-|cyan-/);
  });

  it("owns the embedded profile appearance in Account", () => {
    const source = readFileSync("components/account/ProfileSecurity.tsx", "utf8");
    expect(source).toContain("workspaceAccountProfileClerkAppearance");
    expect(source).toContain('path="/account/profile"');
    expect(source).toContain('navbar: "!hidden"');
    expect(readFileSync("components/layout/AppShell.tsx", "utf8")).not.toContain("UserButton");
  });
});
