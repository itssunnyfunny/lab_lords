import { common } from "./common";
import { workspaceMessages } from "./workspace";
import { whatsappDetails } from "./whatsapp-details";
import { detailMessages } from "./details";
import { operationalLabels } from "./labels";
import { billingOutcomes } from "./billing-outcomes";
import { billingMessages } from "./billing";
import { analyticsMessages } from "./analytics";
import { importMessages } from "./imports";
import { settingsMessages } from "./settings";
import { errorMessages } from "./errors";
import { management } from "./management";
import { whatsappMessages } from "./whatsapp";
import { operations } from "./operations";
import { documentMessages } from "./documents";
import { attendanceMessages } from "./attendance";
import type { InterfaceLanguage } from "./language";

export const messages = { ...common, ...operations, ...attendanceMessages, ...documentMessages, ...management, ...whatsappMessages, ...errorMessages, ...settingsMessages, ...importMessages, ...analyticsMessages, ...billingMessages, ...workspaceMessages, ...whatsappDetails, ...detailMessages, ...operationalLabels, ...billingOutcomes } as const;
export type MessageKey = keyof typeof messages;
const lookup: Readonly<Record<string, readonly [string, string]>> = messages;
const localizedMessages = new Set<string>(Object.values(lookup).flat());
const caseInsensitiveLabels = new Map(Object.entries(lookup).filter(([key]) => /^[a-z ]+$/i.test(key) && key.length < 80).map(([key, value]) => [key.toLowerCase(), value]));
export type MessageParams = Readonly<Record<string, string | number>>;
export function translate(language: InterfaceLanguage, key: MessageKey, params: MessageParams = {}): string {
    return translateOwnedText(language, key, params);
}
/** Presentation boundary for known application labels; never use on user content. */
export function translateOwnedText(language: InterfaceLanguage, text: string, params: MessageParams = {}): string {
    // Legacy attendance receipts contain a stable full-message shape. Keep stored receipts intact.
    const attendance = /^(\d+) selected student\(s\) marked (present|absent|not marked)$/.exec(text);
    if (attendance) return translate(language, "{count} selected student(s) marked {status}", { count: attendance[1], status: translateOwnedText(language, attendance[2] === "not marked" ? "Not marked" : attendance[2] === "present" ? "Present" : "Absent") });
    const queued = /^(\d+) messages? queued\. Delivery remains subject to send-time revalidation\.$/.exec(text);
    if (queued) return translate(language, "{count} messages queued. Delivery remains subject to send-time revalidation.", { count: queued[1] });
    const permission = /^Requires (.+) access\. Ask the branch owner to update your staff permissions\.$/.exec(text);
    if (permission && !text.includes("{permissions}")) {
        const labels = permission[1].split(/, or | or |, /);
        if (labels.every(label => Object.prototype.hasOwnProperty.call(lookup, label))) {
            return translate(language, "Requires {permissions} access. Ask the branch owner to update your staff permissions.", { permissions: labels.map(label => translateOwnedText(language, label)).join(` ${translateOwnedText(language, "or")} `) });
        }
    }
    const pair = Object.prototype.hasOwnProperty.call(lookup, text) ? lookup[text] : caseInsensitiveLabels.get(text.replaceAll("_", " ").toLowerCase());
    let message = language === "en" ? text : pair?.[language === "hi" ? 0 : 1] ?? text;
    // Complete count messages retain English singular/plural forms without changing data.
    if (language === "en") message = message.replace(/\{(\w+)\}([^{}]*?)\(s\)/g, (_match, name: string, noun: string) => {
        const count = Number(String(params[name]).replaceAll(",", ""));
        return `{${name}}${noun}${count === 1 ? "" : /(?:s|x|z|ch|sh)$/.test(noun) ? "es" : "s"}`;
    });
    return message.replace(/\{(\w+)\}/g, (token, name: string) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token);
}
export function translateError(language: InterfaceLanguage, error: unknown, fallback: MessageKey = "Something went wrong. Try again.") {
    const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    if (localizedMessages.has(text)) return text;
    const required = /^(.{1,80}) is required\.$/.exec(text);
    if (required && Object.prototype.hasOwnProperty.call(messages, required[1])) return translate(language, "{field} is required.", { field: translateOwnedText(language, required[1]) });
    const length = /^(.{1,80}) must be (\d+) characters or less\.$/.exec(text);
    if (length && Object.prototype.hasOwnProperty.call(messages, length[1])) return translate(language, "{field} must be {max} characters or less.", { field: translateOwnedText(language, length[1]), max: length[2] });
    const numberRule = /^(.{1,80}) (must be a whole number|is too large|must be a valid email)\.$/.exec(text);
    if (numberRule && caseInsensitiveLabels.has(numberRule[1].toLowerCase())) return translateOwnedText(language, `{field} ${numberRule[2]}.`, { field: translateOwnedText(language, numberRule[1]) });
    const minimum = /^(.{1,80}) must be at least (-?\d+)\.$/.exec(text);
    if (minimum && caseInsensitiveLabels.has(minimum[1].toLowerCase())) return translate(language, "{field} must be at least {min}.", { field: translateOwnedText(language, minimum[1]), min: minimum[2] });
    const maximum = /^(.{1,80}) must be (\d+) or less\.$/.exec(text);
    if (maximum && caseInsensitiveLabels.has(maximum[1].toLowerCase())) return translate(language, "{field} must be {max} or less.", { field: translateOwnedText(language, maximum[1]), max: maximum[2] });
    return translateOwnedText(language, Object.prototype.hasOwnProperty.call(messages, text) ? text : fallback);
}
