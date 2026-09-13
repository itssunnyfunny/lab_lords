export const INTERFACE_LANGUAGES = ["en", "hi", "hinglish"] as const;
export type InterfaceLanguage = typeof INTERFACE_LANGUAGES[number];
export const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "hi", label: "हिंदी" },
    { value: "hinglish", label: "Hinglish" },
] as const;
export const LANGUAGE_TAGS: Record<InterfaceLanguage, string> = { en: "en-IN", hi: "hi-IN", hinglish: "hi-Latn-IN" };
export function normalizeLanguage(value: unknown): InterfaceLanguage {
    return value === "hi" || value === "hinglish" ? value : "en";
}
