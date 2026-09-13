"use client";
import { useMemo } from "react";
import { translate, translateError, translateOwnedText, type MessageKey, type MessageParams } from "@/lib/i18n";
import { useUserPreferences } from "./UserPreferencesApplier";
export function useTranslation(purpose: "interface" | "document" = "interface") {
    const preferences = useUserPreferences();
    const interfaceLanguage = purpose === "document" ? preferences.documentLanguage : preferences.interfaceLanguage;
    return useMemo(() => Object.assign(
        (key: MessageKey, params?: MessageParams) => translate(interfaceLanguage, key, params),
        { owned: (text: string, params?: MessageParams) => translateOwnedText(interfaceLanguage, text, params),
          error: (error: unknown, fallback?: MessageKey) => translateError(interfaceLanguage, error, fallback) }
    ), [interfaceLanguage]);
}
export function LocalizedText({ text, params }: { text: MessageKey; params?: MessageParams }) {
    const t = useTranslation();
    return t(text, params);
}
/** Only application-owned labels; never names, notes, references or stored prose. */
export function OwnedLabel({ text }: { text: string }) {
    const t = useTranslation();
    return t.owned(text);
}
export function LocalizedError({ error }: { error: unknown }) {
    const t = useTranslation();
    return t.error(error);
}
