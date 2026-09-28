import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CircleGauge } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";

describe("StatCard", () => {
    it.each([
        ["Collected", "emerald", "text-[color:var(--ui-tone-success-text)]"],
        ["Pending dues", "rose", "text-[color:var(--ui-tone-danger-text)]"],
        ["Active students", "cyan", "text-[color:var(--ui-tone-info-text)]"],
        ["Seat utilization", "violet", "text-[color:var(--ui-tone-insight-text)]"],
    ] as const)("renders the %s metric with its %s identity", (title, accent, valueClass) => {
        const html = renderToStaticMarkup(
            <StatCard title={title} value="42" sub="Metric context" icon={CircleGauge} accent={accent} />
        );

        expect(html).toContain(`data-accent="${accent}"`);
        expect(html).toContain(valueClass);
    });

    it("keeps metric identity separate from status severity", () => {
        const html = renderToStaticMarkup(
            <StatCard
                title="Seat utilization"
                value="95%"
                sub="Near capacity"
                icon={CircleGauge}
                accent="violet"
                tone="danger"
                progress={95}
            />
        );

        expect(html).toContain('data-accent="violet"');
        expect(html).toContain('data-tone="danger"');
        expect(html).toContain("text-[color:var(--ui-tone-insight-text)]");
        expect(html).toContain("var(--ui-tone-danger-progress)");
    });
});
