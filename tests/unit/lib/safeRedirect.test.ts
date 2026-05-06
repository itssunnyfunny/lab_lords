import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/safeRedirect";

describe("getSafeRedirectPath", () => {
  it("allows local relative paths", () => {
    expect(getSafeRedirectPath("/invite/token123", "/org")).toBe("/invite/token123");
  });

  it("rejects external and malformed paths", () => {
    expect(getSafeRedirectPath("https://example.com", "/org")).toBe("/org");
    expect(getSafeRedirectPath("//example.com", "/org")).toBe("/org");
    expect(getSafeRedirectPath("\\\\example.com", "/org")).toBe("/org");
  });
});
