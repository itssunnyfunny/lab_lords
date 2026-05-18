import type { MessageLanguage, ReminderTone } from "@/types/settings";

export const MESSAGE_DRAFT_ACTION_PREFIX = "FOLLOW_UP_OVERDUE_PAYMENTS";
export const MESSAGE_REGENERATION_COOLDOWN_MS = 5 * 60 * 1000;

export const MESSAGE_INCLUDE_FIELDS = ["name", "date", "fee"] as const;

export type MessageIncludeField = typeof MESSAGE_INCLUDE_FIELDS[number];
export type MessageDraftInclude = Record<MessageIncludeField, boolean>;

export const DEFAULT_MESSAGE_INCLUDE: MessageDraftInclude = {
    name: true,
    date: true,
    fee: true,
};

export function parseMessageLanguage(value: unknown, fallback: MessageLanguage = "en"): MessageLanguage {
    return value === "hi" || value === "en" ? value : fallback;
}

export function parseReminderTone(value: unknown, fallback: ReminderTone = "polite"): ReminderTone {
    return value === "friendly" || value === "firm" || value === "polite" ? value : fallback;
}

export function normalizeMessageInclude(value: unknown): MessageDraftInclude {
    if (typeof value === "string") {
        const selected = new Set(
            value
                .split(",")
                .map(part => part.trim())
                .filter((part): part is MessageIncludeField =>
                    MESSAGE_INCLUDE_FIELDS.includes(part as MessageIncludeField)
                )
        );

        if (selected.size === 0) return { ...DEFAULT_MESSAGE_INCLUDE };

        return {
            name: selected.has("name"),
            date: selected.has("date"),
            fee: selected.has("fee"),
        };
    }

    if (value && typeof value === "object") {
        const source = value as Partial<Record<MessageIncludeField, unknown>>;
        const include = {
            name: source.name === undefined ? DEFAULT_MESSAGE_INCLUDE.name : source.name === true,
            date: source.date === undefined ? DEFAULT_MESSAGE_INCLUDE.date : source.date === true,
            fee: source.fee === undefined ? DEFAULT_MESSAGE_INCLUDE.fee : source.fee === true,
        };

        if (Object.values(include).some(Boolean)) return include;
    }

    return { ...DEFAULT_MESSAGE_INCLUDE };
}

export function includedMessageFields(include: MessageDraftInclude): MessageIncludeField[] {
    return MESSAGE_INCLUDE_FIELDS.filter(field => include[field]);
}

export function messageIncludeKey(include: MessageDraftInclude) {
    return includedMessageFields(include).join("-") || "generic";
}

export function buildMessageDraftAction(tone: ReminderTone, include: MessageDraftInclude) {
    if (
        tone === "polite" &&
        include.name &&
        include.date &&
        include.fee
    ) {
        return MESSAGE_DRAFT_ACTION_PREFIX;
    }

    return `${MESSAGE_DRAFT_ACTION_PREFIX}:${tone}:${messageIncludeKey(include)}`;
}
