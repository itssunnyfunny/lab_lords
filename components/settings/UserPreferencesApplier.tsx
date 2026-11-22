"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { installWorkspaceHistoryGuard } from "@/lib/workspaceNavigationGuard";
import { LANGUAGE_TAGS, normalizeLanguage, type InterfaceLanguage } from "@/lib/i18n/language";

export type UserDisplayPreferences = {
    interfaceLanguage: InterfaceLanguage;
    documentLanguage: InterfaceLanguage;
    densityPreference: "comfortable" | "compact";
    locale: string;
    timezone: string;
    dateFormat: "dd MMM yyyy" | "MMM dd, yyyy" | "yyyy-MM-dd";
};

const DEFAULT_PREFERENCES: UserDisplayPreferences = {
    interfaceLanguage: "en",
    documentLanguage: "en",
    densityPreference: "comfortable",
    locale: "en-IN",
    timezone: "Asia/Kolkata",
    dateFormat: "dd MMM yyyy",
};

const PREFERENCE_EVENT = "lablords:preferences-updated";

type UserPreferencesContextValue = UserDisplayPreferences & {
    ownerKey: string;
    profileName: string | null;
    formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
    formatDateTime: (value: Date | string | number) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function normalizePreferences(value: Partial<UserDisplayPreferences> | null | undefined): UserDisplayPreferences {
    return {
        interfaceLanguage: normalizeLanguage(value?.interfaceLanguage),
        documentLanguage: normalizeLanguage(value?.documentLanguage),
        densityPreference: value?.densityPreference === "compact" ? "compact" : "comfortable",
        locale: value?.locale || DEFAULT_PREFERENCES.locale,
        timezone: value?.timezone || DEFAULT_PREFERENCES.timezone,
        dateFormat: value?.dateFormat === "MMM dd, yyyy" || value?.dateFormat === "yyyy-MM-dd"
            ? value.dateFormat
            : "dd MMM yyyy",
    };
}

type DatePreferences = Pick<UserDisplayPreferences, "dateFormat" | "locale" | "timezone">;

export function formatPreferenceDate(input: Date | number | string, { dateFormat, locale, timezone }: DatePreferences, options?: Intl.DateTimeFormatOptions) {
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) return "Invalid date";
    if (options) return new Intl.DateTimeFormat(locale, { timeZone: timezone, ...options }).format(date);
    const parts = new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        day: "2-digit",
        month: dateFormat === "yyyy-MM-dd" ? "2-digit" : "short",
        year: "numeric",
    }).formatToParts(date);
    const values = new Map(parts.map(part => [part.type, part.value]));
    const year = values.get("year"), month = values.get("month"), day = values.get("day");
    if (dateFormat === "yyyy-MM-dd") return `${year}-${month}-${day}`;
    return dateFormat === "MMM dd, yyyy" ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

export function formatPreferenceDateTime(input: Date | number | string, preferences: DatePreferences) {
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) return "Invalid date";
    const time = new Intl.DateTimeFormat(preferences.locale, { timeZone: preferences.timezone, hour: "2-digit", minute: "2-digit" }).format(date);
    return `${formatPreferenceDate(date, preferences)}, ${time}`;
}

export function notifyUserPreferencesChanged(
    preferences: Partial<UserDisplayPreferences> & { name?: string | null },
    ownerKey: string
) {
    window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: { ...preferences, ownerKey } }));
}

export function UserPreferencesProvider({ children, signedIn = true, ownerKey = "test", publicLocale }: { children: ReactNode; signedIn?: boolean; ownerKey?: string; publicLocale?: InterfaceLanguage }) {
    useLayoutEffect(installWorkspaceHistoryGuard, []);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [profileName, setProfileName] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let updatesDuringLoad: Partial<UserDisplayPreferences> & { name?: string | null } = {};

        if (signedIn) fetch("/api/users/me", { cache: "no-store" })
            .then(response => response.ok
                ? response.json() as Promise<Partial<UserDisplayPreferences> & { name?: string | null }>
                : null)
            .then(value => {
                if (!cancelled && value) {
                    const merged = { ...value, ...updatesDuringLoad };
                    setPreferences(normalizePreferences(merged));
                    setProfileName(merged.name?.trim() || null);
                }
            })
            .catch(() => {
                // Defaults keep the authenticated shell usable when preferences are unavailable.
            });

        const handlePreferenceUpdate = (event: Event) => {
            const detail = (event as CustomEvent<Partial<UserDisplayPreferences> & { name?: string | null; ownerKey: string }>).detail;
            if (detail.ownerKey !== ownerKey) return;
            updatesDuringLoad = { ...updatesDuringLoad, ...detail };
            setPreferences(current => normalizePreferences({ ...current, ...detail }));
            if ("name" in detail) setProfileName(detail.name?.trim() || null);
        };
        window.addEventListener(PREFERENCE_EVENT, handlePreferenceUpdate);

        return () => {
            cancelled = true;
            window.removeEventListener(PREFERENCE_EVENT, handlePreferenceUpdate);
        };
    }, [signedIn, ownerKey]);

    useEffect(() => {
        const root = document.documentElement;
        root.dataset.density = preferences.densityPreference;
        root.dataset.locale = preferences.locale;
        root.dataset.timezone = preferences.timezone;
        root.dataset.dateFormat = preferences.dateFormat;
        root.lang = LANGUAGE_TAGS[publicLocale ?? preferences.interfaceLanguage];
    }, [preferences, publicLocale]);

    const { dateFormat, locale, timezone } = preferences;
    const formatDate = useCallback((value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        formatPreferenceDate(value, { dateFormat, locale, timezone }, options), [dateFormat, locale, timezone]);
    const formatDateTime = useCallback((value: Date | string | number) =>
        formatPreferenceDateTime(value, { dateFormat, locale, timezone }), [dateFormat, locale, timezone]);

    const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => (
        new Intl.NumberFormat(preferences.locale, options).format(value)
    ), [preferences.locale]);

    const value = useMemo<UserPreferencesContextValue>(() => ({
        ...preferences,
        ownerKey,
        profileName,
        formatDate,
        formatDateTime,
        formatNumber,
    }), [formatDate, formatDateTime, formatNumber, preferences, profileName, ownerKey]);

    return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
}

/** Kept for compatibility; preference application now lives in the shell provider. */
export function UserPreferencesApplier() {
    useUserPreferences();
    return null;
}

export function useUserPreferences(): UserPreferencesContextValue {
    const value = useContext(UserPreferencesContext);
    if (!value) {
        return {
            ...DEFAULT_PREFERENCES,
            ownerKey: "signed-out",
            profileName: null,
            formatDate: (input, options) => formatPreferenceDate(input, DEFAULT_PREFERENCES, options),
            formatDateTime: input => formatPreferenceDateTime(input, DEFAULT_PREFERENCES),
            formatNumber: (input, options) => new Intl.NumberFormat(DEFAULT_PREFERENCES.locale, options).format(input),
        };
    }
    return value;
}
