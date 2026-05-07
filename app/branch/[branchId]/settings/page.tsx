"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    AlertCircle,
    Armchair,
    Bot,
    Building2,
    Calendar,
    CalendarClock,
    Clock,
    GitBranch,
    Hash,
    IndianRupee,
    Loader2,
    MapPin,
    MessageSquare,
    Phone,
    Shield,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import {
    ReadOnlyRow,
    SegmentedControl,
    SettingsField,
    SettingsInput,
    SettingsPanel,
    SettingsSaveBar,
    SettingsSelect,
    SettingsTextArea,
    SettingsToggle,
    SettingsWorkspace,
} from "@/components/settings/SettingsWorkspace";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateOptionalTime,
    validatePhone,
    validateRequiredText,
} from "@/lib/formValidation";

interface ActiveShift {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    price: number;
    isReserved: boolean;
}

interface StaffMember {
    id: string;
    role: string;
    user?: { id: string; name: string | null; email: string } | null;
}

interface BranchData {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    contactPhone: string | null;
    openingTime: string | null;
    closingTime: string | null;
    defaultFee: number | null;
    defaultAdmissionFee: number | null;
    defaultMessageLanguage: "en" | "hi";
    reminderTone: "polite" | "friendly" | "firm";
    aiEnabled: boolean;
    createdAt: string;
    lastDataChange: string;
    organization?: { id: string; name: string; ownerId: string } | null;
    _count?: {
        seats: number;
        students: number;
        shifts: number;
        payments: number;
        staff: number;
    };
    shifts?: ActiveShift[];
    staff?: StaffMember[];
}

type BranchForm = Pick<
    BranchData,
    | "name"
    | "city"
    | "address"
    | "contactPhone"
    | "openingTime"
    | "closingTime"
    | "defaultFee"
    | "defaultAdmissionFee"
    | "defaultMessageLanguage"
    | "reminderTone"
    | "aiEnabled"
>;

const SECTIONS = [
    { id: "profile", label: "Profile", icon: Building2 },
    { id: "defaults", label: "Student Defaults", icon: IndianRupee },
    { id: "communication", label: "Communication", icon: MessageSquare },
    { id: "ai", label: "AI", icon: Bot },
    { id: "access", label: "Access", icon: Shield },
    { id: "system", label: "System Info", icon: Hash },
];

function toForm(branch: BranchData): BranchForm {
    return {
        name: branch.name ?? "",
        city: branch.city ?? "",
        address: branch.address ?? "",
        contactPhone: branch.contactPhone ?? "",
        openingTime: branch.openingTime ?? "",
        closingTime: branch.closingTime ?? "",
        defaultFee: branch.defaultFee ?? 0,
        defaultAdmissionFee: branch.defaultAdmissionFee ?? 0,
        defaultMessageLanguage: branch.defaultMessageLanguage ?? "en",
        reminderTone: branch.reminderTone ?? "polite",
        aiEnabled: branch.aiEnabled ?? true,
    };
}

export default function BranchSettingsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.settings}>
            <BranchSettingsContent branchId={branchId} />
        </BranchAccessGuard>
    );
}

function BranchSettingsContent({ branchId }: { branchId: string }) {
    const router = useRouter();

    const [branch, setBranch] = useState<BranchData | null>(null);
    const [form, setForm] = useState<BranchForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState("profile");
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [saveError, setSaveError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/branches/${branchId}`);
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to load branch settings");
                }
                const data = await res.json();
                setBranch(data);
                setForm(toForm(data));
            } catch (err) {
                setFetchError(err instanceof Error ? err.message : "Something went wrong.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [branchId]);

    const hasChanges = useMemo(() => {
        if (!branch || !form) return false;
        return JSON.stringify(form) !== JSON.stringify(toForm(branch));
    }, [branch, form]);

    const updateForm = <K extends keyof BranchForm>(key: K, value: BranchForm[K]) => {
        setForm(prev => prev ? { ...prev, [key]: value } : prev);
        if (saveStatus !== "idle") setSaveStatus("idle");
    };

    const reset = () => {
        if (!branch) return;
        setForm(toForm(branch));
        setSaveStatus("idle");
        setSaveError("");
    };

    const save = async () => {
        if (!form) return;
        const nameResult = validateRequiredText(form.name, "Branch name", 120);
        if (!nameResult.ok) {
            setSaveError(nameResult.error);
            setSaveStatus("error");
            return;
        }
        const cityResult = validateOptionalText(form.city, "City", FORM_LIMITS.cityMax);
        if (!cityResult.ok) {
            setSaveError(cityResult.error);
            setSaveStatus("error");
            return;
        }
        const addressResult = validateOptionalText(form.address, "Address", 240);
        if (!addressResult.ok) {
            setSaveError(addressResult.error);
            setSaveStatus("error");
            return;
        }
        const contactPhoneResult = validatePhone(form.contactPhone);
        if (!contactPhoneResult.ok) {
            setSaveError(contactPhoneResult.error);
            setSaveStatus("error");
            return;
        }
        const openingTimeResult = validateOptionalTime(form.openingTime, "Opening time");
        if (!openingTimeResult.ok) {
            setSaveError(openingTimeResult.error);
            setSaveStatus("error");
            return;
        }
        const closingTimeResult = validateOptionalTime(form.closingTime, "Closing time");
        if (!closingTimeResult.ok) {
            setSaveError(closingTimeResult.error);
            setSaveStatus("error");
            return;
        }
        if ((openingTimeResult.value && !closingTimeResult.value) || (!openingTimeResult.value && closingTimeResult.value)) {
            setSaveError("Operating hours must have both opening and closing time, or neither.");
            setSaveStatus("error");
            return;
        }
        const defaultFeeResult = parseIntegerField(form.defaultFee, "Default monthly fee", {
            min: 0,
            max: FORM_LIMITS.moneyMax,
        });
        if (!defaultFeeResult.ok) {
            setSaveError(defaultFeeResult.error);
            setSaveStatus("error");
            return;
        }
        const defaultAdmissionFeeResult = parseIntegerField(form.defaultAdmissionFee, "Default admission fee", {
            min: 0,
            max: FORM_LIMITS.moneyMax,
        });
        if (!defaultAdmissionFeeResult.ok) {
            setSaveError(defaultAdmissionFeeResult.error);
            setSaveStatus("error");
            return;
        }
        setSaving(true);
        setSaveStatus("idle");
        setSaveError("");
        try {
            const res = await fetch(`/api/branches/${branchId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    name: nameResult.value,
                    city: cityResult.value ?? null,
                    address: addressResult.value ?? null,
                    contactPhone: contactPhoneResult.value ?? null,
                    openingTime: openingTimeResult.value,
                    closingTime: closingTimeResult.value,
                    defaultFee: defaultFeeResult.value ?? 0,
                    defaultAdmissionFee: defaultAdmissionFeeResult.value ?? 0,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save branch settings");
            }
            const updated = await res.json();
            setBranch(updated);
            setForm(toForm(updated));
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
                <span className="text-gray-400">Loading branch settings...</span>
            </div>
        );
    }

    if (fetchError || !branch || !form) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-white">
                <div className="space-y-4 text-center">
                    <AlertCircle className="mx-auto text-red-400" size={38} />
                    <p className="text-gray-400">{fetchError || "Branch not found."}</p>
                    <Button variant="outline" onClick={() => router.back()}>Back</Button>
                </div>
            </div>
        );
    }

    const counts = branch._count ?? { seats: 0, students: 0, shifts: 0, payments: 0, staff: 0 };
    const shifts = branch.shifts ?? [];
    const staff = branch.staff ?? [];

    return (
        <>
            <SettingsWorkspace
                title="Branch Settings"
                subtitle="Configure the branch profile, billing defaults, reminders, AI, and access overview."
                sections={SECTIONS}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
            >
                <SettingsPanel id="profile" title="Profile" description="Operational identity and public branch contact details." icon={Building2}>
                    <SettingsField label="Branch name">
                        <SettingsInput value={form.name} onChange={e => updateForm("name", e.target.value)} placeholder="Main Branch" />
                    </SettingsField>
                    <SettingsField label="City">
                        <SettingsInput value={form.city ?? ""} onChange={e => updateForm("city", e.target.value)} placeholder="Delhi" />
                    </SettingsField>
                    <SettingsField label="Address">
                        <SettingsTextArea value={form.address ?? ""} onChange={e => updateForm("address", e.target.value)} placeholder="Branch address" />
                    </SettingsField>
                    <SettingsField label="Contact phone">
                        <SettingsInput value={form.contactPhone ?? ""} onChange={e => updateForm("contactPhone", e.target.value)} placeholder="+91 98765 43210" />
                    </SettingsField>
                    <SettingsField label="Operating hours" description="Stored as the branch default opening and closing window.">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <SettingsInput type="time" value={form.openingTime ?? ""} onChange={e => updateForm("openingTime", e.target.value)} />
                            <SettingsInput type="time" value={form.closingTime ?? ""} onChange={e => updateForm("closingTime", e.target.value)} />
                        </div>
                    </SettingsField>
                </SettingsPanel>

                <SettingsPanel id="defaults" title="Student Defaults" description="Defaults applied when creating new students in this branch." icon={IndianRupee}>
                    <SettingsField label="Default monthly fee" description="Used when a new student has no manual fee or shift-linked fee.">
                        <SettingsInput type="number" min={0} value={form.defaultFee ?? 0} onChange={e => updateForm("defaultFee", Number(e.target.value))} />
                    </SettingsField>
                    <SettingsField label="Default admission fee" description="Pre-fills new student admission fee and is used if no admission fee is supplied.">
                        <SettingsInput type="number" min={0} value={form.defaultAdmissionFee ?? 0} onChange={e => updateForm("defaultAdmissionFee", Number(e.target.value))} />
                    </SettingsField>
                    <ReadOnlyRow label="Active students" value={<span className="inline-flex items-center gap-2"><Users size={14} />{counts.students}</span>} />
                    <ReadOnlyRow label="Seat capacity" value={<span className="inline-flex items-center gap-2"><Armchair size={14} />{counts.seats} seats</span>} />
                </SettingsPanel>

                <SettingsPanel id="communication" title="Communication" description="Defaults for manually copied payment reminder drafts." icon={MessageSquare}>
                    <SettingsField label="Default message language">
                        <SegmentedControl
                            value={form.defaultMessageLanguage}
                            onChange={value => updateForm("defaultMessageLanguage", value)}
                            options={[
                                { value: "en", label: "English" },
                                { value: "hi", label: "Hindi" },
                            ]}
                        />
                    </SettingsField>
                    <SettingsField label="Reminder tone">
                        <SettingsSelect value={form.reminderTone} onChange={e => updateForm("reminderTone", e.target.value as BranchForm["reminderTone"])}>
                            <option value="polite">Polite</option>
                            <option value="friendly">Friendly</option>
                            <option value="firm">Firm</option>
                        </SettingsSelect>
                    </SettingsField>
                    <ReadOnlyRow label="Payments due" value={counts.payments} />
                </SettingsPanel>

                <SettingsPanel id="ai" title="AI" description="Control whether this branch can generate AI reports." icon={Bot}>
                    <SettingsField label="AI reports">
                        <SettingsToggle
                            checked={form.aiEnabled}
                            onChange={value => updateForm("aiEnabled", value)}
                            label={form.aiEnabled ? "AI generation enabled" : "AI generation disabled"}
                            description={form.aiEnabled ? "Branch AI reports can run using the current branch data." : "AI report generation will return a disabled state for this branch."}
                        />
                    </SettingsField>
                    {!form.aiEnabled && (
                        <div className="px-5 py-4">
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                AI is off for this branch. Existing reports remain visible, but new generation is blocked.
                            </div>
                        </div>
                    )}
                </SettingsPanel>

                <SettingsPanel id="access" title="Access" description="Team summary for this branch." icon={Shield}>
                    <ReadOnlyRow label="Staff members" value={counts.staff} />
                    <div className="grid gap-2 px-5 py-4 md:grid-cols-2">
                        {staff.map(member => (
                            <div key={member.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="truncate text-sm font-medium text-white">{member.user?.name || member.user?.email || member.user?.id}</span>
                                    <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">{member.role}</span>
                                </div>
                                <p className="mt-1 truncate text-xs text-gray-500">{member.user?.email || "No email"}</p>
                            </div>
                        ))}
                        {staff.length === 0 && (
                            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">No staff records found.</div>
                        )}
                    </div>
                    <div className="px-5 pb-4">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/branch/${branchId}/staff`)}>
                            Manage Staff
                        </Button>
                    </div>
                </SettingsPanel>

                <SettingsPanel id="system" title="System Info" description="Read-only branch metadata and active shift summary." icon={Hash}>
                    <ReadOnlyRow label="Organization" value={<span className="inline-flex items-center gap-2"><GitBranch size={14} />{branch.organization?.name || "N/A"}</span>} />
                    <ReadOnlyRow label="Branch ID" value={<span className="font-mono">{branch.id}</span>} />
                    <ReadOnlyRow label="Created" value={<span className="inline-flex items-center gap-2"><Calendar size={14} />{format(new Date(branch.createdAt), "PPP")}</span>} />
                    <ReadOnlyRow label="Last data change" value={format(new Date(branch.lastDataChange), "PPp")} />
                    <div className="px-5 py-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                            <CalendarClock size={15} className="text-cyan-300" />
                            Active shifts
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                            {shifts.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">No active shifts.</div>
                            ) : shifts.map(shift => (
                                <div key={shift.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-white">{shift.name}</span>
                                        <span className="text-xs text-emerald-300">Rs {shift.price.toLocaleString("en-IN")}</span>
                                    </div>
                                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                        <Clock size={11} />
                                        {shift.startTime && shift.endTime ? `${shift.startTime} - ${shift.endTime}` : "Flexible"}
                                        {shift.isReserved ? " / Reserved" : ""}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ReadOnlyRow label="Location" value={<span className="inline-flex items-center gap-2"><MapPin size={14} />{branch.city || "Not set"}</span>} />
                    <ReadOnlyRow label="Contact" value={<span className="inline-flex items-center gap-2"><Phone size={14} />{branch.contactPhone || "Not set"}</span>} />
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
