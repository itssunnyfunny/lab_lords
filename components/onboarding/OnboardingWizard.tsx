"use client";

import { use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useBasicNavigationGuard } from "@/components/basic/useBasicNavigationGuard";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Layers, Plus, UploadCloud, Users, X } from "lucide-react";
import { AppButton, Dialog } from "@/components/ui";
import { FieldError, fieldErrorClass, fieldErrorProps, useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import { entryContentClass, entryInlineInfoClass, entryMutedTextClass, entryPanelClass, entryRootClass, entrySubtitleClass, entryTitleClass } from "@/components/ui/entrySurface";
import { formControlClass, formErrorBannerClass, formHelpTextClass, formLabelClass, formSurfaceClass } from "@/components/ui/formSurface";
import { SeatNumberingBuilder, createSimpleSeatNumbering, resolveSeatNumberingForCount } from "@/components/seats/SeatNumberingBuilder";
import { LocalizedError, useTranslation } from "@/components/settings/LocalizedText";
import { FORM_LIMITS, parseIntegerField, validateOptionalText, validateRequiredPhone, validateRequiredText } from "@/lib/formValidation";
import { generateSeatLabelsForSeatCount, type SeatNumberingConfig } from "@/lib/seatNumbering";
import { isCheckoutBillingPlanId, publicBillingPlans, WHATSAPP_PLAN_AVAILABILITY, type CheckoutBillingPlanId } from "@/lib/billingPlans";
import { combinationFeeSuggestion, removeSetupTimeSlot, suggestedSchedule, TIME_SLOT_OVERLAP_ERROR, validateSetupSchedule, type SetupCombination, type SetupSchedule, type SetupTimeSlot } from "@/lib/onboardingSchedule";
import { onboardingDestination, onboardingStorageKey, readOnboardingCommand, runOnboardingCommand, type OnboardingCommand, type OnboardingDraft } from "@/lib/onboardingPendingCommand";
import { cn } from "@/lib/utils";
import { suggestedWorkspaceName } from "@/lib/onboardingNames";

const plans = publicBillingPlans();
const steps = ["Your business", "Seats & timings", "Your free trial", "Review & start"] as const;
type Step = 1 | 2 | 3 | 4;
const headings = ["Tell us about your business", "Make room for your students", "Try the plan that fits your work", "A good start, your way"] as const;
const descriptions = [
    "A few details to make Lab Lords yours. You can edit these later.",
    "Count your physical seats, then choose when students can use them and what they pay.",
    "Eligible new owners can try Basic, Standard or Pro for 30 days. No card needed.",
    "Review what will be created, then choose how to add your first students.",
] as const;
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export default function OnboardingPage({ searchParams }: { searchParams: Promise<{ billingPlan?: string }> }) {
    const t = useTranslation();
    const query = use(searchParams);
    const { isLoaded, isSignedIn, user } = useUser();
    if (!isLoaded || !isSignedIn || !user) {
        return <div className={entryRootClass}><p role="status">{t.owned(isLoaded ? "Sign in to continue setup." : "Loading setup...")}</p></div>;
    }
    return <OnboardingAccountPage key={user.id} accountId={user.id} signupName={user.firstName || user.fullName} initialPhone={user.primaryPhoneNumber?.phoneNumber ?? ""}
        requestedBillingPlan={isCheckoutBillingPlanId(query.billingPlan) ? query.billingPlan : null} />;
}

function SetupField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
    const t = useTranslation();
    return <div className="min-w-0">
        <label htmlFor={id} className={cn(formLabelClass, "mb-2 block")}>{t.owned(label)}</label>
        {children}
        {hint && <p id={`${id}-hint`} className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned(hint)}</p>}
        <FieldError id={`${id}-error`} error={error} />
    </div>;
}

function OnboardingAccountPage({ accountId, requestedBillingPlan, initialPhone = "", signupName }: {
    accountId: string; requestedBillingPlan: CheckoutBillingPlanId | null; initialPhone?: string; signupName?: string | null;
}) {
    const t = useTranslation();
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const workspaceSuggestion = suggestedWorkspaceName(signupName);
    const [formData, setFormData] = useState({ orgName: "", ownerPhone: initialPhone, branchName: "", city: "", seatCount: "", seatNumbering: createSimpleSeatNumbering() });
    const [schedule, setSchedule] = useState<SetupSchedule>(() => suggestedSchedule());
    const [trialPlan, setTrialPlan] = useState<CheckoutBillingPlanId | null>(requestedBillingPlan);
    const [startingPoint, setStartingPoint] = useState<"IMPORT" | "CLEAN" | null>(null);
    const [customSeats, setCustomSeats] = useState(false);
    const [combinationsExpanded, setCombinationsExpanded] = useState(false);
    const [multiplePreset, setMultiplePreset] = useState(false);
    const [replaceSchedule, setReplaceSchedule] = useState(false);
    const [sharedFee, setSharedFee] = useState("");
    const [sharedFeeError, setSharedFeeError] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedCommand, setSavedCommand] = useState<OnboardingCommand | null>(null);
    const [storageReady, setStorageReady] = useState(false);
    const [storageError, setStorageError] = useState<string | null>(null);
    const active = useRef(false), busy = useRef(false), rowSequence = useRef(0);
    const heading = useRef<HTMLHeadingElement>(null);
    const { markTouched, markSubmitted, resetFieldErrors, visibleError, touched } = useInlineFieldErrors<string>();
    const loadSavedCommand = useCallback(() => {
        try { setSavedCommand(readOnboardingCommand(accountId)); setStorageReady(true); setStorageError(null); }
        catch (failure) { setStorageReady(false); setStorageError(failure instanceof Error ? failure.message : "Your saved setup could not be accessed safely."); }
    }, [accountId]);
    useEffect(() => {
        active.current = true;
        loadSavedCommand();
        const changed = (event: StorageEvent) => { if (event.key === null || event.key === onboardingStorageKey(accountId)) loadSavedCommand(); };
        window.addEventListener("storage", changed);
        return () => { active.current = false; window.removeEventListener("storage", changed); };
    }, [accountId, loadSavedCommand]);
    useEffect(() => { if (step > 1) heading.current?.focus(); }, [step]);

    const dirty = !savedCommand && (step > 1 || !!formData.orgName || formData.ownerPhone !== initialPhone || !!formData.branchName || !!formData.city || !!formData.seatCount || trialPlan !== requestedBillingPlan);
    useBasicNavigationGuard(() => !loading && (!dirty || window.confirm(t.owned("Leave with unsaved changes?"))), dirty || loading, "setupIndex");

    const orgName = validateRequiredText(formData.orgName.trim() || workspaceSuggestion, "Workspace name", 120);
    const phone = validateRequiredPhone(formData.ownerPhone, "Owner phone");
    const branch = validateRequiredText(formData.branchName, "Library / centre name", 120);
    const city = validateOptionalText(formData.city, "City / area", FORM_LIMITS.cityMax);
    const seatCount = parseIntegerField(formData.seatCount, "Physical seats", { required: true, min: 1, max: FORM_LIMITS.seatsMax });
    const numbering = resolveSeatNumberingForCount(formData.seatNumbering, seatCount.ok ? seatCount.value! : 0);
    const seatLabels = seatCount.ok ? generateSeatLabelsForSeatCount(seatCount.value, numbering) : null;
    const validatedSchedule = validateSetupSchedule(schedule);
    const errors: Record<string, string> = { ...validatedSchedule.errors,
        ...(!orgName.ok ? { orgName: orgName.error } : {}), ...(!phone.ok ? { ownerPhone: phone.error } : {}),
        ...(!branch.ok ? { branchName: branch.error } : {}), ...(!city.ok ? { city: city.error } : {}),
        ...(!seatCount.ok ? { seatCount: seatCount.error } : {}), ...(seatLabels && !seatLabels.ok ? { seatNumbering: seatLabels.error } : {}),
    };
    const touchedTimingConflict = Object.entries(validatedSchedule.errors).some(([key, message]) => message === TIME_SLOT_OVERLAP_ERROR && touched[key]);
    const fieldError = (key: string) => errors[key] === TIME_SLOT_OVERLAP_ERROR && touchedTimingConflict ? errors[key] : visibleError(key, errors);
    const inputProps = (id: string, key: string) => ({
        id, className: cn(formControlClass, "min-h-11 px-3 py-2.5", fieldErrorClass(fieldError(key))),
        onBlur: () => markTouched(key), ...fieldErrorProps(`${id}-error`, fieldError(key)),
    });
    const updateField = (name: keyof typeof formData, value: string | SeatNumberingConfig) => {
        setFormData(previous => ({ ...previous, [name]: value })); setError(null);
    };
    const updateSlot = (id: string, patch: Partial<SetupTimeSlot>) => setSchedule(previous => ({ ...previous, shifts: previous.shifts.map(row => row.clientId === id ? { ...row, ...patch } : row) }));
    const updateCombination = (id: string, patch: Partial<SetupCombination>) => setSchedule(previous => ({ ...previous, multiShifts: previous.multiShifts.map(row => row.clientId === id ? { ...row, ...patch } : row) }));
    const addSlot = () => {
        const clientId = `extra-${++rowSequence.current}`;
        resetFieldErrors();
        setSchedule(previous => ({ ...previous, shifts: [...previous.shifts, { clientId, name: "", startTime: "", endTime: "", price: "" }] }));
    };
    const addCombination = () => {
        const clientId = `extra-${++rowSequence.current}`;
        resetFieldErrors();
        setCombinationsExpanded(true);
        setSchedule(previous => ({ ...previous, multiShifts: [...previous.multiShifts, { clientId, name: "", price: "", componentShiftIds: [] }] }));
    };
    const applyPreset = () => { setSchedule(suggestedSchedule(true)); setMultiplePreset(true); setReplaceSchedule(false); resetFieldErrors(); };
    const choosePreset = () => {
        if (JSON.stringify(schedule) === JSON.stringify(suggestedSchedule())) applyPreset();
        else setReplaceSchedule(true);
    };
    const applySharedFee = () => {
        const parsed = parseIntegerField(sharedFee, "Student monthly fee", { required: true, min: 0, max: FORM_LIMITS.moneyMax });
        if (!parsed.ok) { setSharedFeeError("Enter a monthly fee, or enter 0 for no fee."); return; }
        setSchedule(previous => ({ ...previous, shifts: previous.shifts.map(row => ({ ...row, price: String(parsed.value) })) }));
        setSharedFeeError(undefined);
    };
    const next = () => {
        markSubmitted(); setError(null);
        if (step === 1 && (!orgName.ok || !phone.ok || !branch.ok || !city.ok)) return;
        if (step === 2 && (!seatCount.ok || !seatLabels?.ok || Object.keys(validatedSchedule.errors).length > 0)) {
            if (schedule.multiShifts.some(row => Object.keys(validatedSchedule.errors).some(key => key.startsWith(`${row.clientId}.`)))) setCombinationsExpanded(true);
            return;
        }
        if (step === 3 && !trialPlan) { setError("Choose Basic, Standard or Pro for your trial."); return; }
        resetFieldErrors(); setStep(previous => (previous + 1) as Step);
    };
    const goBack = (to: Step) => { setError(null); resetFieldErrors(); setStep(to); };
    const completeSetup = async (draft?: OnboardingDraft) => {
        if (busy.current || !active.current || !storageReady) return;
        busy.current = true; setLoading(true); setError(null);
        try {
            const receipt = await runOnboardingCommand({ accountId, draft, isCurrent: () => active.current });
            if (!active.current) return;
            setSavedCommand(receipt); router.push(onboardingDestination(receipt));
        } catch (failure) {
            if (!active.current) return;
            loadSavedCommand(); setError(failure instanceof Error ? failure.message : "Setup could not be confirmed. Retry the saved setup.");
        } finally { busy.current = false; if (active.current) setLoading(false); }
    };
    const submit = async () => {
        if (!orgName.ok || !phone.ok || !branch.ok || !city.ok) { goBack(1); markSubmitted(); return; }
        if (!seatCount.ok || !seatLabels?.ok || Object.keys(validatedSchedule.errors).length) { goBack(2); markSubmitted(); return; }
        if (!trialPlan) { goBack(3); return; }
        if (!startingPoint) { setError("Choose to import records or add students manually."); return; }
        await completeSetup({ startingPoint, payload: {
            orgName: orgName.value, ownerPhone: phone.value, branchName: branch.value, city: city.value,
            seatCount: seatCount.value!, seatNumbering: numbering, shifts: validatedSchedule.shifts,
            multiShifts: validatedSchedule.multiShifts, trialPlan, selectedPostTrialPlan: trialPlan,
        } });
    };
    const selectedPlan = plans.find(plan => plan.id === trialPlan);

    return <div data-app-design-pilot="workspace" className="mx-auto w-full max-w-6xl py-6">
        <div className={cn(entryContentClass, "w-full max-w-6xl")}>

            <div className={cn(entryPanelClass, "grid overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]")}>
                <aside className="border-b border-[color:var(--ui-form-section-divider)] bg-[color:var(--ui-form-muted-surface-bg)] p-5 lg:border-b-0 lg:border-r lg:p-7">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--ui-form-accent)]">{t.owned("A little more organised, from day one")}</p>
                    <h1 className={cn(entryTitleClass, "mt-3")}>{t("Set up Lab Lords")}</h1>
                    <p className={cn(entrySubtitleClass, "mt-3")}>{t.owned("Your business. Your seats. A simpler day ahead.")}</p>
                    <ol aria-label={t.owned("Setup progress")} className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3">
                        {steps.map((label, index) => <li key={label}>
                            <button type="button" disabled={index + 1 >= step || loading || !!savedCommand || !storageReady} onClick={() => goBack((index + 1) as Step)} aria-current={index + 1 === step ? "step" : undefined}
                                className={cn("flex min-h-12 w-full items-center gap-3 rounded-[var(--ui-radius-control)] border p-3 text-left text-sm disabled:cursor-default", index + 1 === step ? "border-[color:var(--ui-form-accent)] bg-[color:var(--ui-form-surface-bg)]" : "border-transparent")}>
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--ui-form-section-divider)] text-xs">{index + 1 < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span><span>{t.owned(label)}</span>
                            </button>
                        </li>)}
                    </ol>
                    <p className={cn(formHelpTextClass, "mt-6 text-xs leading-5")}><Clock3 size={14} className="mr-1 inline" aria-hidden="true" />{t.owned("No card needed. Review everything before you start.")}</p>
                </aside>
                <section className="min-w-0 p-5 sm:p-8 lg:p-10" aria-busy={loading}>
                    {!storageReady ? <div role="status" className="space-y-4"><p>{storageError ? <LocalizedError error={storageError} /> : t.owned("Loading your saved setup...")}</p><AppButton onClick={loadSavedCommand}>{t("Retry saved setup check")}</AppButton></div>
                    : savedCommand ? <div className="space-y-5">
                        <CheckCircle2 size={32} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" />
                        <h2 className={entryTitleClass}>{t(savedCommand.status === "pending" ? "Recover your saved setup" : "Your workspace is ready")}</h2>
                        <p className={entrySubtitleClass}>{t.owned(savedCommand.status === "pending" ? "Your original details are saved. Retry that same setup to confirm its result; do not start again." : "Your setup is saved. Continue without creating another workspace or trial.")}</p>
                        {error && <p role="alert" className={cn(formErrorBannerClass, "p-4")}><LocalizedError error={error} /></p>}
                        <AppButton disabled={loading} onClick={() => savedCommand.status === "completed" ? router.push(onboardingDestination(savedCommand)) : completeSetup()}>{t(savedCommand.status === "pending" ? "Retry saved setup" : "Continue to workspace")}</AppButton>
                    </div> : <>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ui-form-accent)]">{t("Step {step} of 4", { step })}</p>
                        <h2 ref={heading} tabIndex={-1} className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] outline-none sm:text-3xl">{t.owned(headings[step - 1])}</h2>
                        <p className={cn(entryMutedTextClass, "mt-3 max-w-2xl text-sm leading-6")}>{t.owned(descriptions[step - 1])}</p>
                        <fieldset disabled={loading} className="mt-7 min-w-0 space-y-6">
                            <legend className="sr-only">{t.owned(headings[step - 1])}</legend>
                            {step === 1 && <div className="space-y-5">
                                <SetupField id="setup-business" label="Library / centre name" hint="Use the name on your signboard. This is the branch name you will see every day." error={fieldError("branchName")}>
                                    <input {...inputProps("setup-business", "branchName")} name="branchName" value={formData.branchName} placeholder="Saraswati Library" maxLength={120} autoComplete="organization" onChange={event => updateField("branchName", event.target.value)} aria-describedby={fieldError("branchName") ? "setup-business-error" : "setup-business-hint"} />
                                </SetupField>
                                <SetupField id="setup-phone" label="Owner phone" hint="Used for your business contact details. This does not connect WhatsApp." error={fieldError("ownerPhone")}>
                                    <input {...inputProps("setup-phone", "ownerPhone")} type="tel" inputMode="tel" name="ownerPhone" value={formData.ownerPhone} autoComplete="tel" placeholder="+91 98765 43210" onChange={event => updateField("ownerPhone", event.target.value)} />
                                </SetupField>
                                <SetupField id="setup-city" label="City / area (optional)" error={fieldError("city")}><input {...inputProps("setup-city", "city")} name="city" value={formData.city} maxLength={FORM_LIMITS.cityMax} autoComplete="address-level2" onChange={event => updateField("city", event.target.value)} /></SetupField>
                                <details className="border-t border-[color:var(--ui-form-section-divider)] pt-5">
                                    <summary className="min-h-11 cursor-pointer text-sm">{t.owned("Workspace name (optional)")}: {formData.orgName.trim() || workspaceSuggestion}</summary>
                                    <SetupField id="setup-workspace" label="Workspace name" hint="Your workspace groups your branches and billing. You can rename it in workspace settings; rename this library in branch settings." error={fieldError("orgName")}><input {...inputProps("setup-workspace", "orgName")} name="workspaceName" autoComplete="off" value={formData.orgName} placeholder={workspaceSuggestion} maxLength={120} onChange={event => updateField("orgName", event.target.value)} /></SetupField>
                                </details>
                            </div>}
                            {step === 2 && <div className="space-y-7">
                                <SetupField id="setup-seats" label="How many physical seats are here?" hint="Count each chair or study desk once, even when different students use it at different times." error={fieldError("seatCount")}><input {...inputProps("setup-seats", "seatCount")} name="seatCount" inputMode="numeric" pattern="[0-9]*" value={formData.seatCount} onChange={event => updateField("seatCount", event.target.value)} className={cn(inputProps("setup-seats", "seatCount").className, "max-w-48 text-lg")} /></SetupField>
                                {seatLabels?.ok && <p className={cn(entryInlineInfoClass, "p-3 text-sm")} role="status">{t.owned("Seat labels")}: {seatLabels.value.slice(0, 5).join(", ")}{seatLabels.value.length > 5 ? ` … ${seatLabels.value.at(-1)}` : ""} · {t.owned("{count} physical seats", { count: seatLabels.value.length })}</p>}
                                <button type="button" aria-expanded={customSeats} aria-controls="setup-seat-labels" className="min-h-11 text-sm font-semibold text-[color:var(--ui-form-accent)]" onClick={() => setCustomSeats(previous => !previous)}>{t.owned(customSeats ? "Hide seat label settings" : "Use custom seat labels, such as A1 or B1")}</button>
                                {customSeats && <div id="setup-seat-labels" className="[&_input[type=number]]:[appearance:textfield] [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none"><SeatNumberingBuilder value={formData.seatNumbering} expectedCount={seatCount.ok ? seatCount.value : undefined} onChange={value => { updateField("seatNumbering", value); markTouched("seatNumbering"); }} /><FieldError error={fieldError("seatNumbering")} /></div>}
                                <div className="border-t border-[color:var(--ui-form-section-divider)] pt-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{t.owned("Daily timings & student fees")}</h3>{!multiplePreset && <AppButton type="button" variant="secondary" density="compact" onClick={choosePreset}>{t.owned("Use morning, afternoon & evening")}</AppButton>}</div>
                                    <p className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned("Suggested timings are editable. These become your location's actual time slots when you confirm setup.")}</p>
                                    <p className={cn(entryInlineInfoClass, "mt-3 p-3 text-sm")}><strong>{t.owned("These are fees your students pay you.")}</strong> {t.owned("They are separate from your Lab Lords subscription. Enter 0 only when you intend no fee.")}</p>
                                    {schedule.shifts.length > 1 && <div className={cn(formSurfaceClass, "mt-4 flex flex-wrap items-end gap-3 p-3")}>
                                        <div className="min-w-0 flex-1"><label htmlFor="setup-shared-fee" className={cn(formLabelClass, "mb-1 block")}>{t.owned("Same monthly fee for every time slot?")}</label><input id="setup-shared-fee" value={sharedFee} onChange={event => setSharedFee(event.target.value)} inputMode="numeric" className={cn(formControlClass, "min-h-11 px-3")} {...fieldErrorProps("setup-shared-fee-error", sharedFeeError)} /><FieldError id="setup-shared-fee-error" error={sharedFeeError} /></div>
                                        <AppButton type="button" variant="secondary" onClick={applySharedFee}>{t.owned("Apply to all time slots")}</AppButton>
                                    </div>}
                                    <div className="mt-4 space-y-4">{schedule.shifts.map((row, index) => <section key={row.clientId} className={cn(formSurfaceClass, "space-y-4 p-4")} aria-label={t.owned("Time slot {number}", { number: index + 1 })}>
                                        <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">{t.owned("Time slot {number}", { number: index + 1 })}</h4>{schedule.shifts.length > 1 && <button type="button" className="flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] text-[color:var(--text-secondary)]" aria-label={t.owned("Remove time slot {number}", { number: index + 1 })} onClick={() => { setSchedule(previous => removeSetupTimeSlot(previous, row.clientId)); resetFieldErrors(); }}><X size={18} /></button>}</div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <SetupField id={`${row.clientId}-name`} label="Time slot name" error={fieldError(`${row.clientId}.name`)}><input {...inputProps(`${row.clientId}-name`, `${row.clientId}.name`)} value={row.name} maxLength={50} onChange={event => updateSlot(row.clientId, { name: event.target.value })} /></SetupField>
                                            <SetupField id={`${row.clientId}-price`} label="Student monthly fee (₹)" error={fieldError(`${row.clientId}.price`)}><input {...inputProps(`${row.clientId}-price`, `${row.clientId}.price`)} inputMode="numeric" pattern="[0-9]*" value={row.price} onChange={event => updateSlot(row.clientId, { price: event.target.value })} /></SetupField>
                                            <SetupField id={`${row.clientId}-start`} label="Starts at" error={fieldError(`${row.clientId}.startTime`)}><input {...inputProps(`${row.clientId}-start`, `${row.clientId}.startTime`)} type="time" value={row.startTime} onChange={event => updateSlot(row.clientId, { startTime: event.target.value })} /></SetupField>
                                            <SetupField id={`${row.clientId}-end`} label="Ends at" error={fieldError(`${row.clientId}.endTime`)}><input {...inputProps(`${row.clientId}-end`, `${row.clientId}.endTime`)} type="time" value={row.endTime} onChange={event => updateSlot(row.clientId, { endTime: event.target.value })} /></SetupField>
                                        </div>
                                        {row.startTime && row.endTime && row.endTime <= row.startTime && <p className={cn(formHelpTextClass, "text-xs")}>{t.owned(row.endTime === row.startTime ? "Matching start and end times mean 24-hour access." : "This time slot ends the next day.")}</p>}
                                    </section>)}</div>
                                    <FieldError error={fieldError("shifts")} />
                                    <AppButton type="button" variant="secondary" icon={Plus} className="mt-4" disabled={schedule.shifts.length >= FORM_LIMITS.shiftsMax} onClick={addSlot}>{t.owned("Add another daily time slot")}</AppButton>
                                </div>
                                <details className="border-t border-[color:var(--ui-form-section-divider)] pt-6" open={combinationsExpanded} onToggle={event => setCombinationsExpanded(event.currentTarget.open)}>
                                    <summary className="min-h-11 cursor-pointer text-lg font-semibold"><span className="inline-flex items-center gap-2"><Layers size={20} aria-hidden="true" />{t.owned("Combined access (optional)")}</span></summary>
                                    <p className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned("For example, Full day can include Morning, Afternoon and Evening under one name and monthly fee. It combines existing time slots; it does not create another overlapping slot.")}</p>
                                    <p className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned("Different combinations can share time slots. A seat still cannot be assigned to two students at the same time.")}</p>
                                    <div className="mt-4 space-y-4">{schedule.multiShifts.map((row, index) => {
                                        const suggestion = combinationFeeSuggestion(row, schedule.shifts);
                                        return <section key={row.clientId} className={cn(formSurfaceClass, "space-y-4 p-4")} aria-label={t.owned("Combination {number}", { number: index + 1 })}>
                                            <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{t.owned("Combination {number}", { number: index + 1 })}</h4><button type="button" className="flex h-11 w-11 items-center justify-center" aria-label={t.owned("Remove combination {number}", { number: index + 1 })} onClick={() => { setSchedule(previous => ({ ...previous, multiShifts: previous.multiShifts.filter(item => item.clientId !== row.clientId) })); resetFieldErrors(); }}><X size={18} /></button></div>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <SetupField id={`${row.clientId}-name`} label="Combination name" error={fieldError(`${row.clientId}.name`)}><input {...inputProps(`${row.clientId}-name`, `${row.clientId}.name`)} value={row.name} maxLength={50} onChange={event => updateCombination(row.clientId, { name: event.target.value })} /></SetupField>
                                                <SetupField id={`${row.clientId}-price`} label="Combined monthly fee (₹)" error={fieldError(`${row.clientId}.price`)}><input {...inputProps(`${row.clientId}-price`, `${row.clientId}.price`)} inputMode="numeric" value={row.price} onChange={event => updateCombination(row.clientId, { price: event.target.value })} /></SetupField>
                                            </div>
                                            <fieldset className="space-y-2" {...fieldErrorProps(`${row.clientId}-components-error`, fieldError(`${row.clientId}.components`))} onBlur={() => markTouched(`${row.clientId}.components`)}>
                                                <legend className={cn(formLabelClass, "mb-2")}>{t.owned("Include at least two time slots")}</legend>
                                                {schedule.shifts.map((slot, slotIndex) => <label key={slot.clientId} className={cn(formSurfaceClass, "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm")}><input type="checkbox" checked={row.componentShiftIds.includes(slot.clientId)} onChange={event => updateCombination(row.clientId, { componentShiftIds: event.target.checked ? [...row.componentShiftIds, slot.clientId] : row.componentShiftIds.filter(id => id !== slot.clientId) })} />{slot.name || t.owned("Time slot {number}", { number: slotIndex + 1 })}<span className="ml-auto text-xs">{slot.startTime}–{slot.endTime}</span></label>)}
                                                <FieldError id={`${row.clientId}-components-error`} error={fieldError(`${row.clientId}.components`)} />
                                            </fieldset>
                                            {suggestion !== null && <div className="flex flex-wrap items-center gap-2 text-xs"><p className={formHelpTextClass}>{t.owned("Individual fees total {amount}. Your combined fee can be different.", { amount: money(suggestion) })}</p><AppButton type="button" variant="secondary" density="compact" onClick={() => updateCombination(row.clientId, { price: String(suggestion) })}>{t.owned("Use this total")}</AppButton></div>}
                                        </section>;
                                    })}</div>
                                    <FieldError error={fieldError("multiShifts")} />
                                    <AppButton type="button" variant="secondary" icon={Plus} className="mt-4" disabled={schedule.shifts.length < 2 || schedule.multiShifts.length >= FORM_LIMITS.multiShiftsMax} onClick={addCombination}>{t.owned("Add a combination")}</AppButton>
                                    {schedule.shifts.length < 2 && <p className={cn(formHelpTextClass, "mt-2 text-xs")}>{t.owned("You only need combinations when you have two or more time slots.")}</p>}
                                </details>
                            </div>}
                            {step === 3 && <div className="space-y-4">
                                <div className={cn(entryInlineInfoClass, "p-4 text-sm")}><strong>{t.owned("This is your Lab Lords plan, not your student fees.")}</strong><p className="mt-1">{t.owned("Your chosen plan's features are available during the trial. Selecting it does not create a subscription or charge you.")}</p></div>
                                <div className="grid gap-3 sm:grid-cols-3">{plans.map(plan => <button key={plan.id} type="button" aria-pressed={trialPlan === plan.id} onClick={() => { setTrialPlan(plan.id); setError(null); }} className={cn(formSurfaceClass, "relative flex min-h-56 flex-col items-start p-4 text-left", trialPlan === plan.id && "border-[color:var(--ui-form-accent)] ring-1 ring-[color:var(--ui-form-accent)]")}>
                                    <span className="text-lg font-semibold">{t.owned(plan.shortName)}</span><span className="mt-3 text-2xl font-semibold">{t.owned("Free for 30 days")}</span><span className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned("Then {amount} per location / month", { amount: money(plan.amount ?? 0) })}</span>
                                    <span className="mt-4 text-sm leading-6">{t.owned(plan.id === "BASIC" ? "Students, seats, fees and spreadsheet import." : plan.id === "STANDARD" ? "Basic features, plus attendance, follow-ups, staff, analytics and AI reports." : "Standard features, plus WhatsApp integration and automation, subject to setup and availability.")}</span>
                                    <span className="mt-auto flex items-center gap-2 pt-4 text-sm font-semibold text-[color:var(--ui-form-accent)]">{trialPlan === plan.id && <CheckCircle2 size={18} aria-hidden="true" />}{t.owned(trialPlan === plan.id ? "Selected" : "Choose this trial")}</span>
                                </button>)}</div>
                                <p className={cn(formHelpTextClass, "text-xs leading-5")}>{t.owned(WHATSAPP_PLAN_AVAILABILITY)}</p>
                                <p className={cn(formHelpTextClass, "text-xs leading-5")}>{t.owned("One trial per owner. Changing your plan later does not restart or extend the trial. Paid access needs separate payment authorization.")}</p>
                            </div>}
                            {step === 4 && <div className="space-y-6">
                                <section className={cn(formSurfaceClass, "p-4 sm:p-5")}><h3 className="font-semibold">{t.owned("Ready to create")}</h3>
                                    <dl className="mt-4 space-y-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className={formHelpTextClass}>{t.owned("Workspace name")}</dt><dd className="break-words font-medium">{formData.orgName.trim() || workspaceSuggestion}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className={formHelpTextClass}>{t.owned("Library / centre name")}</dt><dd className="break-words">{formData.branchName}{formData.city ? ` · ${formData.city}` : ""}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className={formHelpTextClass}>{t.owned("Physical seats")}</dt><dd>{formData.seatCount}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className={formHelpTextClass}>{t.owned("Your free trial")}</dt><dd>{selectedPlan?.shortName} · {t.owned("30 days, if eligible")}</dd></div></dl>
                                    <div className="mt-4 border-t border-[color:var(--ui-form-section-divider)] pt-4"><h4 className="text-sm font-semibold">{t.owned("Daily timings & student fees")}</h4><ul className="mt-2 space-y-2 text-sm">{schedule.shifts.map(row => <li key={row.clientId} className="flex flex-wrap justify-between gap-2"><span>{row.name} · {row.startTime}–{row.endTime}</span><span>{money(Number(row.price))} {t.owned("per month")}</span></li>)}{schedule.multiShifts.map(row => <li key={row.clientId} className="space-y-1"><div className="flex flex-wrap justify-between gap-2"><span>{row.name}</span><span>{money(Number(row.price))} {t.owned("per month")}</span></div><p className={cn(formHelpTextClass, "text-xs")}>{row.componentShiftIds.map(id => schedule.shifts.find(slot => slot.clientId === id)?.name).join(" + ")}</p></li>)}</ul></div>
                                    <p className={cn(formHelpTextClass, "mt-4 text-xs leading-5")}>{t.owned("Nothing has been created yet. Go back to change any detail before confirming.")}</p>
                                </section>
                                <div><h3 className="font-semibold">{t.owned("How would you like to add students?")}</h3><p className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned("Spreadsheet import is included in every plan. You can skip it now and return from Students later.")}</p>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">{([{ id: "IMPORT", label: "Import existing records", description: "Review your spreadsheet before anything is added.", icon: UploadCloud }, { id: "CLEAN", label: "Add students manually", description: "Open your workspace and add your first student when you are ready.", icon: Users }] as const).map(choice => <button key={choice.id} type="button" aria-pressed={startingPoint === choice.id} onClick={() => { setStartingPoint(choice.id); setError(null); }} className={cn(formSurfaceClass, "flex min-h-36 flex-col items-start p-4 text-left", startingPoint === choice.id && "border-[color:var(--ui-form-accent)] ring-1 ring-[color:var(--ui-form-accent)]")}><choice.icon size={22} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" /><strong className="mt-3 text-sm">{t.owned(choice.label)}</strong><span className={cn(formHelpTextClass, "mt-2 text-xs leading-5")}>{t.owned(choice.description)}</span></button>)}</div>
                                </div>
                                <p className={cn(entryInlineInfoClass, "p-4 text-sm")}><strong>{t.owned("No card. No automatic plan charge.")}</strong> {t.owned("Confirmation creates your business, first location, seats and chosen time slots together. Your selected trial starts now if your owner account is eligible.")}</p>
                            </div>}
                            {error && <p role="alert" className={cn(formErrorBannerClass, "p-4 text-sm")}><LocalizedError error={error} /></p>}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--ui-form-section-divider)] pt-5">
                                {step > 1 ? <AppButton type="button" variant="secondary" icon={ArrowLeft} onClick={() => goBack((step - 1) as Step)}>{t("Back")}</AppButton> : <span />}
                                <AppButton type="button" variant="primary" rightIcon={ArrowRight} disabled={loading} onClick={() => step === 4 ? submit() : next()}>{t.owned(step === 4 ? loading ? "Creating your workspace..." : "Create my workspace" : "Continue")}</AppButton>
                            </div>
                        </fieldset>
                    </>}
                </section>
            </div>
        </div>
        {replaceSchedule && <Dialog open title={t.owned("Replace your current timings?")} onClose={() => setReplaceSchedule(false)}><p>{t.owned("This replaces your time slots, combinations and entered fees with three editable suggestions. Your business and seat details stay saved.")}</p><div className="mt-5 flex flex-wrap justify-end gap-3"><AppButton variant="secondary" onClick={() => setReplaceSchedule(false)}>{t.owned("Keep my timings")}</AppButton><AppButton onClick={applyPreset}>{t.owned("Use suggested timings")}</AppButton></div></Dialog>}
    </div>;
}
