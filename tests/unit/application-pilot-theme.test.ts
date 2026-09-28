import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isApplicationDesignPilotPath } from "@/lib/applicationDesignPilot";

const projectRoot = resolve(process.cwd());
const pilotPath = join(projectRoot, "styles", "application-pilot.css");
const pilot = readFileSync(pilotPath, "utf8");
const tokens = readFileSync(join(projectRoot, "styles", "tokens.css"), "utf8").split("/* Selected application theme;")[1];

function tokenHex(name: string) {
  const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!match) throw new Error(`Missing six-digit pilot color token: ${name}`);
  return match[1];
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrast(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe("application design pilot theme", () => {
  it("selects migrated branch routes while excluding public and legacy AI Messages", () => {
    for (const path of ["/branch/test", ...["students", "staff", "seats", "follow-ups", "tasks", "reports", "dashboard-settings", "settings", "renewals", "overdue", "allocations", "shifts", "payments", "attendance", "analytics"].map(page => `/branch/test/${page}`), "/branch/test/ai/reports", "/branch/test/onboarding/import", "/branch/test/onboarding/import/session-1"]) expect(isApplicationDesignPilotPath(path)).toBe(true);
    for (const path of ["/", "/hi", "/features", "/pricing", "/faq", "/account", "/branch/test/ai/messages", "/branch/test/staff/nested", "/branch/test/onboarding/import/session-1/nested", null]) expect(isApplicationDesignPilotPath(path)).toBe(false);
  });
  it("stays opt-in to the pilot workspace and collection overlay", () => {
    const globals = readFileSync(join(projectRoot, "app", "globals.css"), "utf8");

    expect(globals).toContain('@import "../styles/application-pilot.css";');
    expect(pilot).toContain('[data-app-design-pilot="workspace"]');
    expect(pilot).toContain(".app-design-pilot-overlay");
    expect(pilot).not.toContain(":root");
    expect(pilot).not.toMatch(/marketing-root|data-brand|public-site/);
  });

  it("keeps text and semantic status pairs at normal-text contrast", () => {
    const pairs = [
      ["--text-primary", "--pilot-cream"],
      ["--text-secondary", "--pilot-cream"],
      ["--text-muted", "--pilot-cream"],
      ["--ui-tone-success-text", "--ui-tone-success-bg"],
      ["--ui-tone-warning-text", "--ui-tone-warning-bg"],
      ["--ui-tone-danger-text", "--ui-tone-danger-bg"],
      ["--ui-tone-info-text", "--ui-tone-info-bg"],
      ["--ui-tone-insight-text", "--ui-tone-insight-bg"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(
        contrast(tokenHex(foreground), tokenHex(background)),
        `${foreground} on ${background}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses a clearly visible forest focus color and preserves the Hindi heading font", () => {
    expect(contrast(tokenHex("--pilot-forest"), tokenHex("--pilot-paper"))).toBeGreaterThanOrEqual(3);
    expect(pilot).toContain('html[lang="hi-IN"] [data-app-design-pilot="workspace"] h1');
    expect(pilot).toContain("--font-devanagari");
  });
});
