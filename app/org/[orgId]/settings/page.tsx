"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
    AlertCircle,
    Briefcase,
    Building2,
    Calendar,
    Clock,
    CreditCard,
    GitBranch,
    Hash,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    Shield,
} from "lucide-react";
import Link from "next/link";
import { AppButton, PageLoadingSkeleton } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import {
    ReadOnlyRow,
    SegmentedControl,
    SettingsCard,
    SettingsEmptyState,
    SettingsField,
    SettingsInput,
    SettingsPanel,
    SettingsSaveBar,
    SettingsSelect,
    SettingsSubtleText,
    SettingsTextArea,
    SettingsWorkspace,
} from "@/components/settings/SettingsWorkspace";
import { useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { OrganizationWhatsAppPanel } from "@/components/whatsapp/OrganizationWhatsAppPanel";
import {
    pageErrorIconClass,
    pageErrorStateClass,
    pageMutedTextClass,
} from "@/components/ui/pageSurface";
import {
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    parseIntegerField,
    validateOptionalEmail,
    validateOptionalText,
    validateRequiredPhone,
    validateRequiredText,
} from "@/lib/formValidation";
import { billing, type BillingOverview, type OrganizationSubscriptionDto } from "@/lib/api/billing";
import { cn } from "@/lib/utils";
interface BranchSummary {
    id: string;
    name: string;
    city: string | null;
    createdAt: string;
}

interface OrgDetails {
    id: string;
    name: string;
    businessType: string | null;
    legalName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    timezone: string;
    currency: string;
    weekStartsOn: 0 | 1;
    paymentGraceDays: number;
    ownerId: string;
    owner?: { id: string; name: string | null; email: string };
    subscription?: OrganizationSubscriptionDto | null;
    createdAt: string;
    branches: BranchSummary[];
    _count: { branches: number };
}

type OrgForm = Pick<
    OrgDetails,
    | "name"
    | "businessType"
    | "legalName"
    | "contactEmail"
    | "contactPhone"
    | "address"
    | "timezone"
    | "currency"
    | "weekStartsOn"
    | "paymentGraceDays"
>;

const SECTIONS = [
    { id: "profile", label: "Business Profile", icon: Building2 },
    { id: "contact", label: "Contact", icon: MapPin },
    { id: "regional", label: "Regional Defaults", icon: Clock },
    { id: "branches", label: "Branches", icon: GitBranch },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "system", label: "System Info", icon: Shield },
];

const SECTIONS_WITH_WHATSAPP = [
    ...SECTIONS.slice(0, 4),
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    ...SECTIONS.slice(4),
];

const BUSINESS_TYPES = ["Study Hall", "Library", "Coaching Center", "Tuition Class", "Other"];

function toForm(org: OrgDetails): OrgForm {
    return {
        name: org.name ?? "",
        businessType: org.businessType ?? "",
        legalName: org.legalName ?? "",
        contactEmail: org.contactEmail ?? "",
        contactPhone: org.contactPhone ?? "",
        address: org.address ?? "",
        timezone: org.timezone ?? "Asia/Kolkata",
        currency: org.currency ?? "INR",
        weekStartsOn: org.weekStartsOn ?? 1,
        paymentGraceDays: org.paymentGraceDays ?? 0,
    };
}

export default function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
    const t = useTranslation();
    return (
        <Suspense fallback={<PageLoadingSkeleton label={t("Loading organization settings")} variant="settings" maxWidth="content" />}>
            <OrgSettingsContent params={params} />
        </Suspense>
    );
}

function OrgSettingsContent({ params }: { params: Promise<{ orgId: string }> }) {
    const t = useTranslation();
    const { orgId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const billingQuery = searchParams.toString();
    useEffect(() => {
        if (searchParams.has("billingPlan") || window.location.hash === "#billing") {
            router.replace(`/org/${encodeURIComponent(orgId)}/billing${billingQuery ? `?${billingQuery}` : ""}#billing`);
        }
    }, [orgId, router, searchParams, billingQuery]);

    const [org, setOrg] = useState<OrgDetails | null>(null);
    const [form, setForm] = useState<OrgForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState("profile");
    const [whatsAppAvailable, setWhatsAppAvailable] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [saveError, setSaveError] = useState("");
    const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
    const [billingLoading, setBillingLoading] = useState(true);
    const { markTouched, markSubmitted, resetFieldErrors, visibleError } = useInlineFieldErrors<
        "name" | "businessType" | "legalName" | "contactEmail" | "contactPhone" | "address" | "paymentGraceDays"
    >();

    const loadBilling = useCallback(async () => {
        setBillingLoading(true);
        try { setBillingOverview(await billing.getOverview(orgId)); }
        catch { setBillingOverview(null); }
        finally { setBillingLoading(false); }
    }, [orgId]);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/organizations/${orgId}`);
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to load organization settings");
                }
                const data = await res.json();
                setOrg(data);
                setForm(toForm(data));
                resetFieldErrors();
                await loadBilling();
            } catch (err) {
                setFetchError(err instanceof Error ? err.message : "Something went wrong.");
                setBillingLoading(false);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [orgId, loadBilling, resetFieldErrors]);

    const hasChanges = useMemo(() => {
        if (!org || !form) return false;
        return JSON.stringify(form) !== JSON.stringify(toForm(org));
    }, [org, form]);

    const organizationCanEdit = billingOverview?.entitlements.canWrite ?? false;
    const organizationEditReason = billingOverview?.entitlements.accessReason
        ?? (billingLoading ? "Checking workspace access..." : "Organization settings are unavailable until billing access is restored.");

    const updateForm = <K extends keyof OrgForm>(key: K, value: OrgForm[K]) => {
        if (!organizationCanEdit || !isEditing) return;
        setForm(prev => prev ? { ...prev, [key]: value } : prev);
        if (saveStatus !== "idle") setSaveStatus("idle");
    };

    const reset = () => {
        if (!org) return;
        setForm(toForm(org));
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
        if (!organizationCanEdit) return;
        setSaveStatus("idle");
        setSaveError("");
        setIsEditing(true);
    };

    const validateForm = () => {
        const errors: Partial<Record<"name" | "businessType" | "legalName" | "contactEmail" | "contactPhone" | "address" | "paymentGraceDays", string>> = {};
        if (!form) return { errors, values: null };
        const nameResult = validateRequiredText(form.name, "Organization name", 120);
        const businessTypeResult = validateOptionalText(form.businessType, "Business type", 80);
        const legalNameResult = validateOptionalText(form.legalName, "Legal name", 160);
        const contactEmailResult = validateOptionalEmail(form.contactEmail, "Contact email");
        const contactPhoneResult = validateRequiredPhone(form.contactPhone, "Contact phone");
        const addressResult = validateOptionalText(form.address, "Address", 240);
        const paymentGraceDaysResult = parseIntegerField(form.paymentGraceDays, "Payment grace days", {
            min: 0,
            max: 60,
        });

        if (!nameResult.ok) errors.name = nameResult.error;
        if (!businessTypeResult.ok) errors.businessType = businessTypeResult.error;
        if (!legalNameResult.ok) errors.legalName = legalNameResult.error;
        if (!contactEmailResult.ok) errors.contactEmail = contactEmailResult.error;
        if (!contactPhoneResult.ok) errors.contactPhone = contactPhoneResult.error;
        if (!addressResult.ok) errors.address = addressResult.error;
        if (!paymentGraceDaysResult.ok) errors.paymentGraceDays = paymentGraceDaysResult.error;

        if (
            !nameResult.ok ||
            !businessTypeResult.ok ||
            !legalNameResult.ok ||
            !contactEmailResult.ok ||
            !contactPhoneResult.ok ||
            !addressResult.ok ||
            !paymentGraceDaysResult.ok
        ) return { errors, values: null };
        return {
            errors,
            values: {
                nameResult,
                businessTypeResult,
                legalNameResult,
                contactEmailResult,
                contactPhoneResult,
                addressResult,
                paymentGraceDaysResult,
            },
        };
    };

    const validation = validateForm();
    const nameError = visibleError("name", validation.errors);
    const businessTypeError = visibleError("businessType", validation.errors);
    const legalNameError = visibleError("legalName", validation.errors);
    const contactEmailError = visibleError("contactEmail", validation.errors);
    const contactPhoneError = visibleError("contactPhone", validation.errors);
    const addressError = visibleError("address", validation.errors);
    const paymentGraceDaysError = visibleError("paymentGraceDays", validation.errors);

    const save = async () => {
        if (!form || !isEditing) return;
        if (!organizationCanEdit) {
            setSaveError(organizationEditReason);
            setSaveStatus("error");
            return;
        }
        markSubmitted();
        setSaveError("");
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) {
            if (saveStatus === "error") setSaveStatus("idle");
            return;
        }
        const {
            nameResult,
            businessTypeResult,
            legalNameResult,
            contactEmailResult,
            contactPhoneResult,
            addressResult,
            paymentGraceDaysResult,
        } = result.values;
        setSaving(true);
        setSaveStatus("idle");
        setSaveError("");
        try {
            const res = await fetch(`/api/organizations/${orgId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    name: nameResult.value,
                    businessType: businessTypeResult.value ?? null,
                    legalName: legalNameResult.value ?? null,
                    contactEmail: contactEmailResult.value ?? null,
                    contactPhone: contactPhoneResult.value,
                    address: addressResult.value ?? null,
                    paymentGraceDays: paymentGraceDaysResult.value ?? 0,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save organization settings");
            }
            const updated = await res.json();
            const nextOrg = { ...(org as OrgDetails), ...updated };
            setOrg(nextOrg);
            setForm(toForm(nextOrg));
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
        return <PageLoadingSkeleton label={t("Loading organization settings")} variant="settings" maxWidth="content" />;
    }

    if (fetchError || !org || !form) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <p className={pageMutedTextClass}>{fetchError || "Organization not found."}</p>
                <AppButton variant="secondary" onClick={() => router.back()}>{t("Back")}</AppButton>
            </div>
        );
    }

    return (
        <>
            <SettingsWorkspace
                title={t("Organization Settings")}
                subtitle={t("Configure business identity, contact details, and workspace defaults.")}
                sections={whatsAppAvailable ? SECTIONS_WITH_WHATSAPP : SECTIONS}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                actions={!isEditing ? (
                    <AppButton
                        variant="primary"
                        density="compact"
                        size="sm"
                        disabled={!organizationCanEdit}
                        title={!organizationCanEdit ? organizationEditReason : undefined}
                        onClick={beginEditing}
                        className="min-h-11 lg:min-h-9"
                    >
                        {t("Edit settings")}</AppButton>
                ) : null}
            >
                {billingOverview && !organizationCanEdit ? (
                    <aside className={cn("flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", formWarningBannerClass)}>
                        <p>{organizationEditReason}</p>
                        <a href={`/org/${encodeURIComponent(orgId)}/billing`} className="shrink-0 font-semibold underline underline-offset-4">{t("Review billing")}</a>
                    </aside>
                ) : null}
                <SettingsPanel id="profile" title={t("Business Profile")} description={t("Core business information used across this organization.")} icon={Building2}>
                    {isEditing && organizationCanEdit ? (
                        <>
                            <SettingsField label={t("Organization name")} description={t("The public workspace name.")} error={nameError} errorId="org-name-error">
                                <SettingsInput value={form.name} onChange={e => updateForm("name", e.target.value)} onBlur={() => markTouched("name")} placeholder={t("Organization name")} error={nameError} errorId="org-name-error" />
                            </SettingsField>
                            <SettingsField label={t("Legal name")} description={t("Optional legal or billing name.")} error={legalNameError} errorId="org-legal-name-error">
                                <SettingsInput value={form.legalName ?? ""} onChange={e => updateForm("legalName", e.target.value)} onBlur={() => markTouched("legalName")} placeholder={t("Registered business name")} error={legalNameError} errorId="org-legal-name-error" />
                            </SettingsField>
                            <SettingsField label={t("Business type")} error={businessTypeError} errorId="org-business-type-error">
                                <SettingsSelect
                                    value={form.businessType ?? ""}
                                    onValueChange={value => updateForm("businessType", value)}
                                    onBlur={() => markTouched("businessType")}
                                    error={businessTypeError}
                                    errorId="org-business-type-error"
                                    options={[
                                        { value: "", label: t("Not set") },
                                        ...BUSINESS_TYPES.map(type => ({ value: type, label: type })),
                                    ]}
                                />
                            </SettingsField>
                        </>
                    ) : (
                        <>
                            <ReadOnlyRow label={t("Organization name")} value={org.name} />
                            <ReadOnlyRow label={t("Legal name")} value={org.legalName || "Not set"} />
                            <ReadOnlyRow label={t("Business type")} value={org.businessType || "Not set"} />
                        </>
                    )}
                </SettingsPanel>

                <SettingsPanel id="contact" title={t("Contact")} description={t("Contact details for operations and billing conversations.")} icon={MapPin}>
                    {isEditing && organizationCanEdit ? (
                        <>
                            <SettingsField label={t("Contact email")} error={contactEmailError} errorId="org-contact-email-error">
                                <SettingsInput value={form.contactEmail ?? ""} onChange={e => updateForm("contactEmail", e.target.value)} onBlur={() => markTouched("contactEmail")} placeholder="owner@example.com" error={contactEmailError} errorId="org-contact-email-error" />
                            </SettingsField>
                            <SettingsField label={t("Contact phone")} description={t("Required phone number for owner and operations contact.")} error={contactPhoneError} errorId="org-contact-phone-error">
                                <SettingsInput value={form.contactPhone ?? ""} onChange={e => updateForm("contactPhone", e.target.value)} onBlur={() => markTouched("contactPhone")} placeholder="+91 98765 43210" error={contactPhoneError} errorId="org-contact-phone-error" />
                            </SettingsField>
                            <SettingsField label={t("Address")} error={addressError} errorId="org-address-error">
                                <SettingsTextArea value={form.address ?? ""} onChange={e => updateForm("address", e.target.value)} onBlur={() => markTouched("address")} placeholder={t("Organization address")} error={addressError} errorId="org-address-error" />
                            </SettingsField>
                        </>
                    ) : (
                        <>
                            <ReadOnlyRow label={t("Contact email")} value={org.contactEmail || "Not set"} />
                            <ReadOnlyRow label={t("Contact phone")} value={org.contactPhone || "Not set"} />
                            <ReadOnlyRow label={t("Address")} value={org.address || "Not set"} />
                        </>
                    )}
                </SettingsPanel>

                <SettingsPanel id="regional" title={t("Regional Defaults")} description={t("Defaults new branches can align with later.")} icon={Clock}>
                    {isEditing && organizationCanEdit ? (
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
                            <SettingsField label={t("Currency")}>
                                <SettingsSelect
                                    value={form.currency}
                                    onValueChange={value => updateForm("currency", value)}
                                    options={[
                                        { value: "INR", label: "INR" },
                                        { value: "USD", label: "USD" },
                                    ]}
                                />
                            </SettingsField>
                            <SettingsField label={t("Week starts on")}>
                                <SegmentedControl
                                    value={String(form.weekStartsOn) as "0" | "1"}
                                    onChange={value => updateForm("weekStartsOn", Number(value) as 0 | 1)}
                                    options={[
                                        { value: "1", label: t("Monday") },
                                        { value: "0", label: t("Sunday") },
                                    ]}
                                />
                            </SettingsField>
                            <SettingsField label={t("Payment grace days")} description={t("Stored organization policy for payment follow-up windows.")} error={paymentGraceDaysError} errorId="org-payment-grace-days-error">
                                <SettingsInput type="number" min={0} max={60} value={form.paymentGraceDays} onChange={e => updateForm("paymentGraceDays", Number(e.target.value))} onBlur={() => markTouched("paymentGraceDays")} error={paymentGraceDaysError} errorId="org-payment-grace-days-error" />
                            </SettingsField>
                        </>
                    ) : (
                        <>
                            <ReadOnlyRow label={t("Timezone")} value={org.timezone} />
                            <ReadOnlyRow label={t("Currency")} value={org.currency} />
                            <ReadOnlyRow label={t("Week starts on")} value={org.weekStartsOn === 0 ? "Sunday" : "Monday"} />
                            <ReadOnlyRow label={t("Payment grace days")} value={org.paymentGraceDays} />
                        </>
                    )}
                </SettingsPanel>

                <SettingsPanel id="branches" title={t("Branches")} description={t("Open a branch to manage branch-level settings.")} icon={GitBranch}>
                    <ReadOnlyRow label={t("Total branches")} value={org._count.branches} />
                    <div className="grid gap-2 px-5 py-4 md:grid-cols-2">
                        {org.branches.length === 0 ? (
                            <SettingsEmptyState>{t("No branches yet.")}</SettingsEmptyState>
                        ) : org.branches.map(branch => (
                            <SettingsCard
                                key={branch.id}
                                onClick={() => router.push(`/branch/${branch.id}/settings`)}
                            >
                                <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-primary)]">
                                    <GitBranch size={14} className="text-[color:var(--ui-form-accent)]" />
                                    {branch.name}
                                </div>
                                <SettingsSubtleText className="mt-1">
                                    {branch.city || "No city set"} / {format(new Date(branch.createdAt), "PP")}
                                </SettingsSubtleText>
                            </SettingsCard>
                        ))}
                    </div>
                </SettingsPanel>

                <OrganizationWhatsAppPanel
                    organizationId={orgId}
                    organizationName={org.name}
                    onAvailabilityChange={setWhatsAppAvailable}
                />

                <SettingsPanel id="billing" title={t("Billing")} description={t("Manage your plan, payment method, invoices, and workspace access.")} icon={CreditCard}>
                    <div className="px-5 py-4">
                        <Link href={`/org/${encodeURIComponent(orgId)}/billing`} className={appActionClassName("primary")}>{t("Manage billing")}</Link>
                    </div>
                </SettingsPanel>

                <SettingsPanel id="system" title={t("System Info")} description={t("Owner and identifiers are read-only.")} icon={Shield}>
                    <ReadOnlyRow label={t("Owner")} value={<span className="inline-flex items-center gap-2"><Mail size={14} />{org.owner?.email || org.ownerId}</span>} />
                    <ReadOnlyRow label={t("Organization ID")} value={<span className="font-mono">{org.id}</span>} />
                    <ReadOnlyRow label={t("Created")} value={<span className="inline-flex items-center gap-2"><Calendar size={14} />{format(new Date(org.createdAt), "PPP")}</span>} />
                    <ReadOnlyRow label={t("Business type")} value={<span className="inline-flex items-center gap-2"><Briefcase size={14} />{org.businessType || "Not set"}</span>} />
                    <ReadOnlyRow label={t("Billing currency")} value={<span className="inline-flex items-center gap-2"><CreditCard size={14} />{org.currency}</span>} />
                    <ReadOnlyRow label={t("Contact phone")} value={<span className="inline-flex items-center gap-2"><Phone size={14} />{org.contactPhone || "Not set"}</span>} />
                    <ReadOnlyRow label={t("Owner ID")} value={<span className="font-mono">{org.ownerId}</span>} />
                    <ReadOnlyRow label={t("Hash")} value={<span className="inline-flex items-center gap-2"><Hash size={14} />{t("System managed")}</span>} />
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
                title={t("Discard organization changes?")}
                description={t("Your unsaved organization settings will be restored to their last saved values.")}
                confirmText="Discard changes"
                cancelText="Keep editing"
            />
        </>
    );
}
