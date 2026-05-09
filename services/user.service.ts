import { prisma } from "@/lib/prisma";
import {
    assertKnownFields,
    assertPlainObject,
    optionalChoice,
    optionalText,
    requiredPhone,
} from "@/lib/settingsValidation";
import {
    DEFAULT_LANDING_PAGES,
    DENSITY_PREFERENCES,
    MESSAGE_LANGUAGES,
    THEME_PREFERENCES,
    UpdateUserSettingsDto,
} from "@/types";

const USER_SETTINGS_FIELDS = [
    "name",
    "phone",
    "timezone",
    "locale",
    "dateFormat",
    "themePreference",
    "densityPreference",
    "defaultMessageLanguage",
    "defaultLandingPage",
] as const;

export class UserService {
    static async getUserProfile(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            include: {
                organizations: {
                    include: {
                        branches: { select: { id: true } },
                    },
                },
                staff: {
                    include: {
                        branch: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }

    static parseSettingsPayload(body: unknown): UpdateUserSettingsDto {
        assertPlainObject(body);
        assertKnownFields(body, USER_SETTINGS_FIELDS);

        const settings: UpdateUserSettingsDto = {};
        const name = optionalText(body.name, "Name", { required: true, max: 120 });
        const phone = requiredPhone(body.phone, "Phone");
        const timezone = optionalText(body.timezone, "Timezone", { required: true, max: 80 });
        const locale = optionalText(body.locale, "Locale", { required: true, max: 24 });
        const dateFormat = optionalText(body.dateFormat, "Date format", { required: true, max: 40 });
        const themePreference = optionalChoice(body.themePreference, "Theme preference", THEME_PREFERENCES);
        const densityPreference = optionalChoice(body.densityPreference, "Density preference", DENSITY_PREFERENCES);
        const defaultMessageLanguage = optionalChoice(body.defaultMessageLanguage, "Default message language", MESSAGE_LANGUAGES);
        const defaultLandingPage = optionalChoice(body.defaultLandingPage, "Default landing page", DEFAULT_LANDING_PAGES);

        if (name != null) settings.name = name;
        if (phone !== undefined) settings.phone = phone;
        if (timezone != null) settings.timezone = timezone;
        if (locale != null) settings.locale = locale;
        if (dateFormat != null) settings.dateFormat = dateFormat;
        if (themePreference !== undefined) settings.themePreference = themePreference;
        if (densityPreference !== undefined) settings.densityPreference = densityPreference;
        if (defaultMessageLanguage !== undefined) settings.defaultMessageLanguage = defaultMessageLanguage;
        if (defaultLandingPage !== undefined) settings.defaultLandingPage = defaultLandingPage;

        return settings;
    }

    static async updateSettings(userId: string, body: unknown) {
        const data = this.parseSettingsPayload(body);
        return prisma.user.update({
            where: { id: userId },
            data,
        });
    }
}
