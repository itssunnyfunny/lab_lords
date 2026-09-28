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

  it("activates the light account skin only in the selected AppShell", () => {
    const source = readFileSync("components/layout/AppShell.tsx", "utf8");
    expect(source).toContain("designPilot ? workspaceAccountMenuClerkAppearance : accountMenuClerkAppearance");
    expect(source).toContain("designPilot ? workspaceAccountProfileClerkAppearance : accountProfileClerkAppearance");
    expect(accountMenuClerkAppearance.variables.colorBackground).toBe("#0f111a");
    expect(accountProfileClerkAppearance.variables.colorBackground).toBe("#0f111a");
  });
});
