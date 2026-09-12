"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { LanguageControls } from "@/components/settings/LanguageControls";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
    AlertCircle,
    Building2,
    Calendar,
    GitBranch,
    Hash,
    LayoutDashboard,
    Mail,
    Monitor,
    Shield,
    SlidersHorizontal,
    User,
} from "lucide-react";
import {
    ReadOnlyRow,
    SegmentedControl,
    SettingsField,
    SettingsInput,
    SettingsPanel,
    SettingsSaveBar,
    SettingsCard,
    SettingsEmptyState,
    SettingsSelect,
    SettingsSubtleText,
    SettingsWorkspace,
} from "@/components/settings/SettingsWorkspace";
import { AppButton, PageLoadingSkeleton } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { focusFirstInvalidField } from "@/components/ui/FormField";
import {
    notifyUserPreferencesChanged,
    useUserPreferences,
    type UserDisplayPreferences,
} from "@/components/settings/UserPreferencesApplier";
import { useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import {
    pageErrorIconClass,
    pageErrorStateClass,
    pageMutedTextClass,
} from "@/components/ui/pageSurface";
import { validateRequiredPhone, validateRequiredText } from "@/lib/formValidation";

interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    timezone: string;
    locale: string;
    dateFormat: string;
    themePreference: "dark" | "system";
    densityPreference: "comfortable" | "compact";
    defaultMessageLanguage: "en" | "hi";
    defaultLandingPage: "org" | "account";
    createdAt: string;
    organizations: {
        id: string;
        name: string;
        businessType: string | null;
        branches: { id: string }[];
    }[];
    staff: {
        id: string;
        role: string;
        branch: { id: string; name: string };
    }[];
}

type AccountForm = Pick<
    UserProfile,
    | "name"
    | "phone"
    | "timezone"
    | "locale"
    | "dateFormat"
    | "themePreference"
    | "densityPreference"
    | "defaultMessageLanguage"
    | "defaultLandingPage"
>;

const SECTIONS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
    { id: "workspace", label: "Workspace", icon: LayoutDashboard },
    { id: "access", label: "Access", icon: Shield },
    { id: "system", label: "System Info", icon: Hash },
];

function toForm(profile: UserProfile): AccountForm {
    return {
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        timezone: profile.timezone ?? "Asia/Kolkata",
        locale: profile.locale ?? "en-IN",
        dateFormat: profile.dateFormat ?? "dd MMM yyyy",
        themePreference: profile.themePreference ?? "dark",
        densityPreference: profile.densityPreference ?? "comfortable",
        defaultMessageLanguage: profile.defaultMessageLanguage ?? "en",
        defaultLandingPage: profile.defaultLandingPage ?? "org",
    };
}

export default function AccountPage() {
    const { ownerKey } = useUserPreferences();
    const t = useTranslation();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [form, setForm] = useState<AccountForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState("profile");
    const [isEditing, setIsEditing] = useState(false);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [saveError, setSaveError] = useState("");
    const { markTouched, markSubmitted, resetFieldErrors, visibleError } = useInlineFieldErrors<"name" | "phone">();

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/users/me");
                if (!res.ok) throw new Error("Failed to load account settings");
                const data = await res.json();
                setProfile(data);
                setForm(toForm(data));
                resetFieldErrors();
            } catch (err) {
                setFetchError(err instanceof Error ? err.message : "Something went wrong.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [resetFieldErrors]);

    const hasChanges = useMemo(() => {
        if (!profile || !form) return false;
        return JSON.stringify(form) !== JSON.stringify(toForm(profile));
    }, [profile, form]);

    const updateForm = <K extends keyof AccountForm>(key: K, value: AccountForm[K]) => {
        if (!isEditing) return;
        setForm(prev => prev ? { ...prev, [key]: value } : prev);
        if (saveStatus !== "idle") setSaveStatus("idle");
    };

    const reset = () => {
        if (!profile) return;
        setForm(toForm(profile));
        setSaveStatus("idle");
        setSaveError("");
        resetFieldErrors();
    };

    const discardChanges = () => {
        reset();
        setIsEditing(false);
        setDiscardDialogOpen(false);
    };

    const requestCancelEditing = () => {
        if (hasChanges) {
            setDiscardDialogOpen(true);
            return;
        }
        discardChanges();
    };

    const beginEditing = () => {
        setSaveStatus("idle");
        setSaveError("");
        setIsEditing(true);
    };

    const validateForm = () => {
        const errors: Partial<Record<"name" | "phone", string>> = {};
        if (!form) return { errors, values: null };
        const nameResult = validateRequiredText(form.name, "Display name", 120);
        const phoneResult = validateRequiredPhone(form.phone);
        if (!nameResult.ok) errors.name = nameResult.error;
        if (!phoneResult.ok) errors.phone = phoneResult.error;
        if (!nameResult.ok || !phoneResult.ok) return { errors, values: null };
        return { errors, values: { nameResult, phoneResult } };
    };

    const validation = validateForm();
    const nameError = visibleError("name", validation.errors);
    const phoneError = visibleError("phone", validation.errors);

    const save = async () => {
        if (!form || !isEditing) return;
        markSubmitted();
        setSaveError("");
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) {
            if (saveStatus === "error") {
                setSaveStatus("idle");
            }
            window.requestAnimationFrame(() => focusFirstInvalidField());
            return;
        }
        const { nameResult, phoneResult } = result.values;
        setSaving(true);
        setSaveStatus("idle");
        setSaveError("");
        try {
            const res = await fetch("/api/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    name: nameResult.value,
                    phone: phoneResult.value,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save account settings");
            }
            const updated = await res.json();
            const nextProfile = {
                ...(profile as UserProfile),
                ...updated,
            };
            setProfile(nextProfile);
            setForm(toForm(nextProfile));
            notifyUserPreferencesChanged({
                name: nextProfile.name,
                densityPreference: nextProfile.densityPreference,
                locale: nextProfile.locale,
                timezone: nextProfile.timezone,
                dateFormat: nextProfile.dateFormat as UserDisplayPreferences["dateFormat"],
            }, ownerKey);
            resetFieldErrors();
            setSaveStatus("success");
            setIsEditing(false);
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Save failed.");
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <PageLoadingSkeleton label={t("Loading account settings")} variant="settings" maxWidth="content" />;
    }

    if (fetchError || !profile || !form) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <p className={pageMutedTextClass}>{t.error(fetchError || "Account not found.")}</p>
                <AppButton variant="secondary" onClick={() => router.back()}>{t("Go back")}</AppButton>
            </div>
        );
    }

    const totalBranches = profile.organizations.reduce((sum, org) => sum + org.branches.length, 0);

    return (
        <>
            <SettingsWorkspace
                title={t("Account Settings")}
                subtitle={t("Manage your profile, preferences, and workspace defaults.")}
                sections={SECTIONS}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                actions={!isEditing ? (
                    <AppButton variant="primary" size="sm" onClick={beginEditing} className="min-h-11 lg:min-h-9">
                        {t("Edit settings")}</AppButton>
                ) : null}
            >
                <SettingsPanel id="profile" title={t("Profile")} description={t("These details identify you across the workspace.")} icon={User}>
                    <div className="mb-2 flex items-center gap-4 rounded-[var(--ui-radius-control)] border border-cyan-300/15 bg-gradient-to-r from-cyan-400/[0.08] to-violet-400/[0.05] p-4">
                        <Avatar name={profile.name || profile.email} size="xl" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">{t("Workspace identity")}</p>
                            <p className="mt-1 truncate font-semibold text-[color:var(--text-primary)]">{profile.name || t.owned("Add your display name")}</p>
                            <p className="truncate text-xs text-[color:var(--text-secondary)]">{profile.email}</p>
                        </div>
                        <span className="hidden rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200 sm:inline-flex">
                            {t("Active")}</span>
                    </div>
                    {isEditing ? (
                        <>
                            <SettingsField label={t("Display name")} description={t("Shown in account menus and staff lists.")} error={nameError} errorId="account-name-error">
                                <SettingsInput
                                    value={form.name ?? ""}
                                    onChange={e => updateForm("name", e.target.value)}
                                    onBlur={() => markTouched("name")}
                                    placeholder={t("Your name")}
                                    error={nameError}
                                    errorId="account-name-error"
                                />
                            </SettingsField>
                            <SettingsField label={t("Phone")} description={t("Required contact number for account operations.")} error={phoneError} errorId="account-phone-error">
                                <SettingsInput
                                    value={form.phone ?? ""}
                                    onChange={e => updateForm("phone", e.target.value)}
                                    onBlur={() => markTouched("phone")}
                                    placeholder="+91 98765 43210"
                                    error={phoneError}
                                    errorId="account-phone-error"
                                />
                            </SettingsField>
                        </>
                    ) : (
                        <>
                            <ReadOnlyRow label={t("Display name")} value={profile.name || "Not set"} />
                            <ReadOnlyRow label={t("Phone")} value={profile.phone || "Not set"} />
                        </>
                    )}
                    <ReadOnlyRow label={t("Email")} value={<span className="inline-flex items-center gap-2"><Mail size={14} />{profile.email}</span>} />
                </SettingsPanel>

                <SettingsPanel id="preferences" title={t("Preferences")} description={t("Persisted personal defaults for this account.")} icon={SlidersHorizontal}>
                    <LanguageControls />
                    {isEditing ? (
                        <>
                            <SettingsField label={t("Timezone")}>
                                <SettingsSelect
                                    value={form.timezone}
                                    onValueChange={value => updateForm("timezone", value)}
                                    options={[
                                        { value: "Asia/Kolkata", label: "Asia/Kolkata" },
                                        { value: "UTC", label: "UTC" },
                                    ]}
                                />
                            </SettingsField>
                            <SettingsField label={t("Locale")}>
                                <SettingsSelect
                                    value={form.locale}
                                    onValueChange={value => updateForm("locale", value)}
                                    options={[
                                        { value: "en-IN", label: t("English India") },
                                        { value: "en-US", label: t("English US") },
                                    ]}
                                />
                            </SettingsField>
                            <SettingsField label={t("Date format")}>
                                <SettingsSelect
                                    value={form.dateFormat}
                                    onValueChange={value => updateForm("dateFormat", value)}
                                    options={[
                                        { value: "dd MMM yyyy", label: "dd MMM yyyy" },
                                        { value: "MMM dd, yyyy", label: "MMM dd, yyyy" },
                                        { value: "yyyy-MM-dd", label: "yyyy-MM-dd" },
                                    ]}
                                />
                            </SettingsField>
                            <SettingsField label={t("Density")}>
                                <SegmentedControl
                                    value={form.densityPreference}
                                    onChange={value => updateForm("densityPreference", value)}
                                    options={[
                                        { value: "comfortable", label: t("Comfortable") },
                                        { value: "compact", label: t("Compact") },
                                    ]}
                                />
                            </SettingsField>
                        </>
                    ) : (
                        <>
                            <ReadOnlyRow label={t("Timezone")} value={profile.timezone} />
                            <ReadOnlyRow label={t("Locale")} value={profile.locale === "en-US" ? "English US" : "English India"} />
                            <ReadOnlyRow label={t("Date format")} value={profile.dateFormat} />
                            <ReadOnlyRow label={t("Density")} value={profile.densityPreference === "compact" ? "Compact" : "Comfortable"} />
                        </>
                    )}
                </SettingsPanel>

                <SettingsPanel id="workspace" title={t("Workspace Defaults")} description={t("Defaults used by message and navigation experiences.")} icon={LayoutDashboard}>
                    {isEditing ? (
                        <>
                            <SettingsField label={t("Message language")} description={t("Manual reminders use Hindi script; existing AI drafting uses Roman Hindi. This does not change screen or document language.")}>
                                <SegmentedControl
                                    value={form.defaultMessageLanguage}
                                    onChange={value => updateForm("defaultMessageLanguage", value)}
                                    options={[
                                        { value: "en", label: "English" },
                                        { value: "hi", label: t("Hindi / Hinglish") },
                                    ]}
                                />
                            </SettingsField>
                            <SettingsField label={t("Landing page")}>
                                <SegmentedControl
                                    value={form.defaultLandingPage}
                                    onChange={value => updateForm("defaultLandingPage", value)}
                                    options={[
                                        { value: "org", label: t("Last workspace") },
                                        { value: "account", label: t("Account") },
                                    ]}
                                />
                            </SettingsField>
                        </>
                    ) : (
                        <>
                            <ReadOnlyRow label={t("Message language")} value={profile.defaultMessageLanguage === "hi" ? t("Hindi / Hinglish") : "English"} />
                            <ReadOnlyRow label={t("Landing page")} value={profile.defaultLandingPage === "account" ? "Account" : "Last workspace"} />
                        </>
                    )}
                </SettingsPanel>

                <SettingsPanel id="access" title={t("Access")} description={t("Read-only membership and role summary.")} icon={Shield}>
                    <ReadOnlyRow label={t("Organizations")} value={profile.organizations.length} />
                    <ReadOnlyRow label={t("Branches")} value={totalBranches} />
                    <ReadOnlyRow label={t("Branch roles")} value={profile.staff.length} />
                    <div className="px-5 py-4">
                        <div className="grid gap-2 md:grid-cols-2">
                            {profile.organizations.map(org => (
                                <Link key={org.id} href={`/org/${org.id}`} aria-label={`Open ${org.name}`}>
                                    <SettingsCard className="h-full transition-colors hover:border-[color:var(--ui-form-input-focus-border)]">
                                        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-primary)]">
                                            <Building2 size={14} className="text-[color:var(--ui-form-accent)]" />
                                            {org.name}
                                        </div>
                                        <SettingsSubtleText className="mt-1">{t("{value} / {count} branches", { value: org.businessType || "Education Business", count: org.branches.length })}</SettingsSubtleText>
                                    </SettingsCard>
                                </Link>
                            ))}
                            {profile.staff.map(member => (
                                <Link key={member.id} href={`/branch/${member.branch.id}`} aria-label={`Open ${member.branch.name}`}>
                                    <SettingsCard className="h-full transition-colors hover:border-[color:var(--ui-form-input-focus-border)]">
                                        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-primary)]">
                                            <GitBranch size={14} className="text-[color:var(--ui-badge-purple-text)]" />
                                            {member.branch.name}
                                        </div>
                                        <SettingsSubtleText className="mt-1">{member.role}</SettingsSubtleText>
                                    </SettingsCard>
                                </Link>
                            ))}
                            {profile.organizations.length === 0 && profile.staff.length === 0 && (
                                <SettingsEmptyState>{t("No workspace access found.")}</SettingsEmptyState>
                            )}
                        </div>
                    </div>
                </SettingsPanel>

                <SettingsPanel id="system" title={t("System Info")} description={t("Identifiers are read-only.")} icon={Monitor}>
                    <ReadOnlyRow label={t("User ID")} value={<span className="font-mono">{profile.id}</span>} />
                    <ReadOnlyRow label={t("Member since")} value={<span className="inline-flex items-center gap-2"><Calendar size={14} />{format(new Date(profile.createdAt), "PPP")}</span>} />
                    <ReadOnlyRow label={t("Account email")} value={profile.email} />
                </SettingsPanel>
            </SettingsWorkspace>

            <SettingsSaveBar
                visible={isEditing}
                hasChanges={hasChanges}
                saving={saving}
                status={saveStatus}
                error={saveError}
                onSave={save}
                onCancel={requestCancelEditing}
            />
            <ConfirmDialog
                isOpen={discardDialogOpen}
                onClose={() => setDiscardDialogOpen(false)}
                onConfirm={discardChanges}
                variant="warning"
                title={t("Discard account changes?")}
                description={t("Your unsaved account settings will be restored to their last saved values.")}
                confirmText="Discard changes"
                cancelText="Keep editing"
            />
        </>
    );
}
