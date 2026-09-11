import { describe, expect, it } from "vitest";
import { nextConfig } from "@/next.config";

describe("Next.js response headers", () => {
  it("marks private, auth, and API route families as noindex", async () => {
    const headers = await nextConfig.headers?.();
    const privateRouteHeaders = headers?.filter(
      entry => entry.headers.some(header => header.key === "X-Robots-Tag"),
    );

    expect(privateRouteHeaders).toHaveLength(9);
    expect(privateRouteHeaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "/app/:path*" }),
        expect.objectContaining({ source: "/api/:path*" }),
        expect.objectContaining({ source: "/sign-in/:path*" }),
      ]),
    );

    for (const entry of privateRouteHeaders ?? []) {
      expect(entry.headers).toContainEqual({
        key: "X-Robots-Tag",
        value: "noindex, nofollow",
      });
    }
  });
  it("allows only same-origin attendance camera use and keeps other device policies denied", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers?.find(h => h.source === "/branch/:branchId/attendance")?.headers).toContainEqual({ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" });
    expect(headers?.find(h => h.source === "/(.*)")?.headers).toContainEqual({ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" });
  });
});
