"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    AlertCircle,
    Building2,
    Calendar,
    GitBranch,
    Hash,
    LayoutDashboard,
    Loader2,
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
    SettingsSelect,
    SettingsWorkspace,
} from "@/components/settings/SettingsWorkspace";
import { Button } from "@/components/ui/Button";
import { useInlineFieldErrors } from "@/components/ui/InlineFieldError";
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
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [form, setForm] = useState<AccountForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState("profile");
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
        if (!form) return;
        markSubmitted();
        setSaveError("");
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) {
            if (saveStatus === "error") {
                setSaveStatus("idle");
            }
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
            resetFieldErrors();
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Save failed.");
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-white">
                <Loader2 className="mr-3 animate-spin text-cyan-400" />
                <span className="text-gray-400">Loading account settings...</span>
            </div>
        );
    }

    if (fetchError || !profile || !form) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-white">
                <div className="space-y-4 text-center">
                    <AlertCircle className="mx-auto text-red-400" size={38} />
                    <p className="text-gray-400">{fetchError || "Account not found."}</p>
                    <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
                </div>
            </div>
        );
    }

    const totalBranches = profile.organizations.reduce((sum, org) => sum + org.branches.length, 0);

    return (
        <>
            <SettingsWorkspace
                title="Account Settings"
                subtitle="Manage your profile, preferences, and workspace defaults."
                sections={SECTIONS}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
            >
                <SettingsPanel id="profile" title="Profile" description="These details identify you across the workspace." icon={User}>
                    <SettingsField label="Display name" description="Shown in account menus and staff lists." error={nameError} errorId="account-name-error">
                        <SettingsInput
                            value={form.name ?? ""}
                            onChange={e => updateForm("name", e.target.value)}
                            onBlur={() => markTouched("name")}
                            placeholder="Your name"
                            error={nameError}
                            errorId="account-name-error"
                        />
                    </SettingsField>
                    <SettingsField label="Phone" description="Required contact number for account operations." error={phoneError} errorId="account-phone-error">
                        <SettingsInput
                            value={form.phone ?? ""}
                            onChange={e => updateForm("phone", e.target.value)}
                            onBlur={() => markTouched("phone")}
                            placeholder="+91 98765 43210"
                            error={phoneError}
                            errorId="account-phone-error"
                        />
                    </SettingsField>
                    <ReadOnlyRow label="Email" value={<span className="inline-flex items-center gap-2"><Mail size={14} />{profile.email}</span>} />
                </SettingsPanel>

                <SettingsPanel id="preferences" title="Preferences" description="Persisted personal defaults for this account." icon={SlidersHorizontal}>
                    <SettingsField label="Timezone">
                        <SettingsSelect value={form.timezone} onChange={e => updateForm("timezone", e.target.value)}>
                            <option value="Asia/Kolkata">Asia/Kolkata</option>
                            <option value="UTC">UTC</option>
                        </SettingsSelect>
                    </SettingsField>
                    <SettingsField label="Locale">
                        <SettingsSelect value={form.locale} onChange={e => updateForm("locale", e.target.value)}>
                            <option value="en-IN">English India</option>
                            <option value="en-US">English US</option>
                        </SettingsSelect>
                    </SettingsField>
                    <SettingsField label="Date format">
                        <SettingsSelect value={form.dateFormat} onChange={e => updateForm("dateFormat", e.target.value)}>
                            <option value="dd MMM yyyy">dd MMM yyyy</option>
                            <option value="MMM dd, yyyy">MMM dd, yyyy</option>
                            <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                        </SettingsSelect>
                    </SettingsField>
                    <SettingsField label="Theme preference" description="Stored now; global theme wiring remains outside this settings pass.">
                        <SegmentedControl
                            value={form.themePreference}
                            onChange={value => updateForm("themePreference", value)}
                            options={[
                                { value: "dark", label: "Dark" },
                                { value: "system", label: "System" },
                            ]}
                        />
                    </SettingsField>
                    <SettingsField label="Density">
                        <SegmentedControl
                            value={form.densityPreference}
                            onChange={value => updateForm("densityPreference", value)}
                            options={[
                                { value: "comfortable", label: "Comfortable" },
                                { value: "compact", label: "Compact" },
                            ]}
                        />
                    </SettingsField>
                </SettingsPanel>

                <SettingsPanel id="workspace" title="Workspace Defaults" description="Defaults used by message and navigation experiences." icon={LayoutDashboard}>
                    <SettingsField label="Message language">
                        <SegmentedControl
                            value={form.defaultMessageLanguage}
                            onChange={value => updateForm("defaultMessageLanguage", value)}
                            options={[
                                { value: "en", label: "English" },
                                { value: "hi", label: "Hindi" },
                            ]}
                        />
                    </SettingsField>
                    <SettingsField label="Landing page">
                        <SegmentedControl
                            value={form.defaultLandingPage}
                            onChange={value => updateForm("defaultLandingPage", value)}
                            options={[
                                { value: "org", label: "Organizations" },
                                { value: "account", label: "Account" },
                            ]}
                        />
                    </SettingsField>
                </SettingsPanel>

                <SettingsPanel id="access" title="Access" description="Read-only membership and role summary." icon={Shield}>
                    <ReadOnlyRow label="Organizations" value={profile.organizations.length} />
                    <ReadOnlyRow label="Branches" value={totalBranches} />
                    <ReadOnlyRow label="Branch roles" value={profile.staff.length} />
                    <div className="px-5 py-4">
                        <div className="grid gap-2 md:grid-cols-2">
                            {profile.organizations.map(org => (
                                <div key={org.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                                        <Building2 size={14} className="text-cyan-300" />
                                        {org.name}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">{org.businessType || "Education Business"} / {org.branches.length} branches</p>
                                </div>
                            ))}
                            {profile.staff.map(member => (
                                <div key={member.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                                        <GitBranch size={14} className="text-violet-300" />
                                        {member.branch.name}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">{member.role}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </SettingsPanel>

                <SettingsPanel id="system" title="System Info" description="Identifiers are read-only." icon={Monitor}>
                    <ReadOnlyRow label="User ID" value={<span className="font-mono">{profile.id}</span>} />
                    <ReadOnlyRow label="Member since" value={<span className="inline-flex items-center gap-2"><Calendar size={14} />{format(new Date(profile.createdAt), "PPP")}</span>} />
                    <ReadOnlyRow label="Account email" value={profile.email} />
                </SettingsPanel>
            </SettingsWorkspace>

            <SettingsSaveBar
                visible={hasChanges}
                saving={saving}
                status={saveStatus}
                error={saveError}
                onSave={save}
                onReset={reset}
            />
        </>
    );
}
