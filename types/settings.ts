export const MESSAGE_LANGUAGES = ["en", "hi"] as const;
export const REMINDER_TONES = ["polite", "friendly", "firm"] as const;
export const THEME_PREFERENCES = ["dark", "system"] as const;
export const DENSITY_PREFERENCES = ["comfortable", "compact"] as const;
export const DEFAULT_LANDING_PAGES = ["org", "account"] as const;
export const WEEK_STARTS_ON = [0, 1] as const;

export type MessageLanguage = typeof MESSAGE_LANGUAGES[number];
export type ReminderTone = typeof REMINDER_TONES[number];
export type ThemePreference = typeof THEME_PREFERENCES[number];
export type DensityPreference = typeof DENSITY_PREFERENCES[number];
export type DefaultLandingPage = typeof DEFAULT_LANDING_PAGES[number];

export interface UpdateUserSettingsDto {
    name?: string;
    phone?: string;
    timezone?: string;
    locale?: string;
    dateFormat?: string;
    themePreference?: ThemePreference;
    densityPreference?: DensityPreference;
    defaultMessageLanguage?: MessageLanguage;
    defaultLandingPage?: DefaultLandingPage;
}

export interface UpdateOrganizationSettingsDto {
    name?: string;
    businessType?: string | null;
    legalName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string;
    address?: string | null;
    timezone?: string;
    currency?: string;
    weekStartsOn?: 0 | 1;
    paymentGraceDays?: number;
}

export interface UpdateBranchSettingsDto {
    name?: string;
    city?: string | null;
    address?: string | null;
    contactPhone?: string;
    openingTime?: string | null;
    closingTime?: string | null;
    defaultFee?: number;
    defaultAdmissionFee?: number;
    defaultMessageLanguage?: MessageLanguage;
    reminderTone?: ReminderTone;
    aiEnabled?: boolean;
}
