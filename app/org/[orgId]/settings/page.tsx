"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    Loader2,
    Mail,
    MapPin,
    Phone,
    Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
    ReadOnlyRow,
    SegmentedControl,
    SettingsField,
    SettingsInput,
    SettingsPanel,
    SettingsSaveBar,
    SettingsSelect,
    SettingsTextArea,
    SettingsWorkspace,
} from "@/components/settings/SettingsWorkspace";

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
    { id: "system", label: "System Info", icon: Shield },
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
    const { orgId } = use(params);
    const router = useRouter();

    const [org, setOrg] = useState<OrgDetails | null>(null);
    const [form, setForm] = useState<OrgForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState("profile");
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [saveError, setSaveError] = useState("");

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
            } catch (err) {
                setFetchError(err instanceof Error ? err.message : "Something went wrong.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [orgId]);

    const hasChanges = useMemo(() => {
        if (!org || !form) return false;
        return JSON.stringify(form) !== JSON.stringify(toForm(org));
    }, [org, form]);

    const updateForm = <K extends keyof OrgForm>(key: K, value: OrgForm[K]) => {
        setForm(prev => prev ? { ...prev, [key]: value } : prev);
        if (saveStatus !== "idle") setSaveStatus("idle");
    };

    const reset = () => {
        if (!org) return;
        setForm(toForm(org));
        setSaveStatus("idle");
        setSaveError("");
    };

    const save = async () => {
        if (!form) return;
        setSaving(true);
        setSaveStatus("idle");
        setSaveError("");
        try {
            const res = await fetch(`/api/organizations/${orgId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save organization settings");
            }
            const updated = await res.json();
            const nextOrg = { ...(org as OrgDetails), ...updated };
            setOrg(nextOrg);
            setForm(toForm(nextOrg));
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
                <span className="text-gray-400">Loading organization settings...</span>
            </div>
        );
    }

    if (fetchError || !org || !form) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-white">
                <div className="space-y-4 text-center">
                    <AlertCircle className="mx-auto text-red-400" size={38} />
                    <p className="text-gray-400">{fetchError || "Organization not found."}</p>
                    <Button variant="outline" onClick={() => router.back()}>Back</Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <SettingsWorkspace
                title="Organization Settings"
                subtitle="Configure business identity, contact details, and workspace defaults."
                sections={SECTIONS}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
            >
                <SettingsPanel id="profile" title="Business Profile" description="Core business information used across this organization." icon={Building2}>
                    <SettingsField label="Organization name" description="The public workspace name.">
                        <SettingsInput value={form.name} onChange={e => updateForm("name", e.target.value)} placeholder="Organization name" />
                    </SettingsField>
                    <SettingsField label="Legal name" description="Optional legal or billing name.">
                        <SettingsInput value={form.legalName ?? ""} onChange={e => updateForm("legalName", e.target.value)} placeholder="Registered business name" />
                    </SettingsField>
                    <SettingsField label="Business type">
                        <SettingsSelect value={form.businessType ?? ""} onChange={e => updateForm("businessType", e.target.value)}>
                            <option value="">Not set</option>
                            {BUSINESS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </SettingsSelect>
                    </SettingsField>
                </SettingsPanel>

                <SettingsPanel id="contact" title="Contact" description="Contact details for operations and billing conversations." icon={MapPin}>
                    <SettingsField label="Contact email">
                        <SettingsInput value={form.contactEmail ?? ""} onChange={e => updateForm("contactEmail", e.target.value)} placeholder="owner@example.com" />
                    </SettingsField>
                    <SettingsField label="Contact phone">
                        <SettingsInput value={form.contactPhone ?? ""} onChange={e => updateForm("contactPhone", e.target.value)} placeholder="+91 98765 43210" />
                    </SettingsField>
                    <SettingsField label="Address">
                        <SettingsTextArea value={form.address ?? ""} onChange={e => updateForm("address", e.target.value)} placeholder="Organization address" />
                    </SettingsField>
                </SettingsPanel>

                <SettingsPanel id="regional" title="Regional Defaults" description="Defaults new branches can align with later." icon={Clock}>
                    <SettingsField label="Timezone">
                        <SettingsSelect value={form.timezone} onChange={e => updateForm("timezone", e.target.value)}>
                            <option value="Asia/Kolkata">Asia/Kolkata</option>
                            <option value="UTC">UTC</option>
                        </SettingsSelect>
                    </SettingsField>
                    <SettingsField label="Currency">
                        <SettingsSelect value={form.currency} onChange={e => updateForm("currency", e.target.value)}>
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                        </SettingsSelect>
                    </SettingsField>
                    <SettingsField label="Week starts on">
                        <SegmentedControl
                            value={String(form.weekStartsOn) as "0" | "1"}
                            onChange={value => updateForm("weekStartsOn", Number(value) as 0 | 1)}
                            options={[
                                { value: "1", label: "Monday" },
                                { value: "0", label: "Sunday" },
                            ]}
                        />
                    </SettingsField>
                    <SettingsField label="Payment grace days" description="Stored organization policy for payment follow-up windows.">
                        <SettingsInput type="number" min={0} max={60} value={form.paymentGraceDays} onChange={e => updateForm("paymentGraceDays", Number(e.target.value))} />
                    </SettingsField>
                </SettingsPanel>

                <SettingsPanel id="branches" title="Branches" description="Open a branch to manage branch-level settings." icon={GitBranch}>
                    <ReadOnlyRow label="Total branches" value={org._count.branches} />
                    <div className="grid gap-2 px-5 py-4 md:grid-cols-2">
                        {org.branches.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">No branches yet.</div>
                        ) : org.branches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => router.push(`/branch/${branch.id}/settings`)}
                                className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-left transition-colors hover:border-cyan-500/30 hover:bg-white/[0.05]"
                            >
                                <div className="flex items-center gap-2 text-sm font-medium text-white">
                                    <GitBranch size={14} className="text-cyan-300" />
                                    {branch.name}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">{branch.city || "No city set"} / {format(new Date(branch.createdAt), "PP")}</p>
                            </button>
                        ))}
                    </div>
                </SettingsPanel>

                <SettingsPanel id="system" title="System Info" description="Owner and identifiers are read-only." icon={Shield}>
                    <ReadOnlyRow label="Owner" value={<span className="inline-flex items-center gap-2"><Mail size={14} />{org.owner?.email || org.ownerId}</span>} />
                    <ReadOnlyRow label="Organization ID" value={<span className="font-mono">{org.id}</span>} />
                    <ReadOnlyRow label="Created" value={<span className="inline-flex items-center gap-2"><Calendar size={14} />{format(new Date(org.createdAt), "PPP")}</span>} />
                    <ReadOnlyRow label="Business type" value={<span className="inline-flex items-center gap-2"><Briefcase size={14} />{org.businessType || "Not set"}</span>} />
                    <ReadOnlyRow label="Billing currency" value={<span className="inline-flex items-center gap-2"><CreditCard size={14} />{org.currency}</span>} />
                    <ReadOnlyRow label="Contact phone" value={<span className="inline-flex items-center gap-2"><Phone size={14} />{org.contactPhone || "Not set"}</span>} />
                    <ReadOnlyRow label="Owner ID" value={<span className="font-mono">{org.ownerId}</span>} />
                    <ReadOnlyRow label="Hash" value={<span className="inline-flex items-center gap-2"><Hash size={14} />System managed</span>} />
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
