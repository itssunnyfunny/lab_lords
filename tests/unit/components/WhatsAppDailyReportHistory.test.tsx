import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fetchWhatsAppDailyReportHistory, WhatsAppDailyReportHistoryRows } from "@/components/whatsapp/WhatsAppDailyReportHistory";
import type { WhatsAppDailyReportHistoryItem } from "@/lib/api/whatsapp";
import { translateOwnedText } from "@/lib/i18n";

describe("daily report history presentation", () => {
  it("localizes loading, failure, refresh, and delivery-status guidance", () => {
    for (const label of [
      "Loading daily report history…",
      "Daily report history is unavailable. Try refreshing.",
      "Refresh report history",
      "Your 20 most recent daily reports. Accepted means Meta accepted the request; delivery is confirmed separately.",
    ]) {
      expect(translateOwnedText("hi", label)).not.toBe(label);
      expect(translateOwnedText("hinglish", label)).not.toBe(label);
    }
  });
  it("loads each scope from its own persisted history endpoint", async () => {
    const api = { getBranchDailyReportHistory: vi.fn().mockResolvedValue({ reports: [] }), getOrganizationDailyReportHistory: vi.fn().mockResolvedValue({ reports: [] }) };
    await fetchWhatsAppDailyReportHistory("BRANCH", "branch_1", api);
    expect(api.getBranchDailyReportHistory).toHaveBeenCalledExactlyOnceWith("branch_1");
    expect(api.getOrganizationDailyReportHistory).not.toHaveBeenCalled();
    await fetchWhatsAppDailyReportHistory("ORGANIZATION", "org_1", api);
    expect(api.getOrganizationDailyReportHistory).toHaveBeenCalledExactlyOnceWith("org_1");
  });
  it.each(["loading", "unavailable"] as const)("does not claim an empty history while %s", status => {
    const html = renderToStaticMarkup(<WhatsAppDailyReportHistoryRows state={{ status }} />);
    expect(html).not.toContain("No daily report history yet");
    expect(html).toContain(status === "loading" ? "Loading daily report history" : "Daily report history is unavailable");
  });
  it("shows the empty state only after a successful empty response", () => {
    expect(renderToStaticMarkup(<WhatsAppDailyReportHistoryRows state={{ status: "ready", reports: [] }} />)).toContain("No daily report history yet");
  });
  it("keeps queued, accepted, delivered, failed and unknown outcomes distinct", () => {
    const statuses: WhatsAppDailyReportHistoryItem["status"][] = ["SCHEDULED", "ACCEPTED", "DELIVERED", "FAILED", "UNKNOWN"];
    const reports = statuses.map((status, index) => ({ id: `message_${index}`, status, localReportDate: "2026-09-28", maskedPhone: "••••••3210", scheduledFor: "2026-09-28T15:30:00.000Z", estimatedCostMicros: index ? "250000" : null }));
    const html = renderToStaticMarkup(<WhatsAppDailyReportHistoryRows state={{ status: "ready", reports }} />);
    statuses.forEach(status => expect(html).toContain(status));
    expect(html).toContain("••••••3210");
    expect(html).toContain("Unavailable");
    expect(html).toContain("₹0.2500");
    expect(html).not.toContain("No daily report history yet");
  });
});
