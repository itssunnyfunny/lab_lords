import { z } from "zod";

export const reportQuerySchema = z.object({
    kind: z.enum(["students", "fees", "attendance"]).default("fees"),
    from: z.iso.date(),
    through: z.iso.date(),
    search: z.string().trim().max(100).default(""),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE", "DUE", "PAID", "WAIVED", "PRESENT", "ABSENT"]).default("ALL"),
    format: z.enum(["json", "csv"]).default("json"),
}).strict().superRefine((value, context) => {
    const days = (Date.parse(value.through) - Date.parse(value.from)) / 86_400_000;
    if (days < 0 || days > 92) context.addIssue({ code: "custom", message: "Choose a date range of 93 days or less." });
    const allowed = value.kind === "students" ? ["ALL", "ACTIVE", "INACTIVE"]
        : value.kind === "fees" ? ["ALL", "DUE", "PAID", "WAIVED"] : ["ALL", "PRESENT", "ABSENT"];
    if (!allowed.includes(value.status)) context.addIssue({ code: "custom", message: "Invalid report status." });
});
export type BranchReportQuery = z.infer<typeof reportQuerySchema>;
export type BranchReport = { columns: string[]; rows: (string | number)[][]; count: number; asOf: string };

/** Keep untrusted text literal in Excel/Sheets, including leading whitespace controls. */
export function csvCell(value: string | number): string {
    const text = String(value);
    const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
}
export function reportCsv(report: Pick<BranchReport, "columns" | "rows">): string {
    return `\uFEFF${[report.columns, ...report.rows].map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
