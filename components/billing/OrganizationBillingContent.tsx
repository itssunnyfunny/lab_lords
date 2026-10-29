"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, CreditCard, History, Loader2, Receipt, Sparkles, XCircle } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppButton } from "@/components/ui";
import { SettingsPanel, SettingsSubtleText, SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BillingPriceSummary } from "@/components/billing/BillingPriceSummary";
import { BillingPaymentMethodsOverview } from "@/components/billing/BillingPaymentMethodsOverview";
import { WorkspacePreviews } from "@/components/billing/WorkspacePreviews";
import { workspaceDowngradeNotice } from "@/lib/workspacePresentation";
import { CheckoutConfirmationDialog } from "@/components/billing/CheckoutConfirmationDialog";
import { PaymentOutcomeDialog, type PaymentOutcome } from "@/components/billing/PaymentOutcomeDialog";
import { getRazorpayCheckoutPayload, isRazorpayCheckoutPayload, isRazorpayCheckoutReady, openRazorpayCheckout, RazorpayCheckoutScript, type RazorpayCheckoutEventResult, type RazorpayCheckoutMode, type RazorpayCheckoutPayloadLike } from "@/components/billing/RazorpayCheckoutLauncher";
import { formErrorBannerClass, formSuccessBannerClass, formWarningBannerClass } from "@/components/ui/formSurface";
import { billing, type BillingOverview, type BillingPlanDto, type OrganizationSubscriptionDto } from "@/lib/api/billing";
import { billingPlanName, billingPlanRank, isCheckoutBillingPlanId, type CheckoutBillingPlanId } from "@/lib/billingPlans";
import { cn } from "@/lib/utils";
import { getProviderPaymentMethodLabel, isSupportedRecurringPaymentMethod } from "@/lib/billingPaymentMethods";
import { BillingHistoryBrowser } from "@/components/billing/BillingHistoryBrowser";
import { BillingInvoiceHistory } from "@/components/billing/BillingInvoiceHistory";
import { useBillingExperience } from "@/components/billing/BillingExperienceProvider";

const BILLING_SECTIONS = [
    { id: "billing", label: "Overview", icon: CreditCard },
    { id: "plans", label: "Plans", icon: Sparkles },
    { id: "subscription", label: "Subscription controls", icon: CreditCard },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "history", label: "Subscription history", icon: History },
];

type BillingContact = { contactEmail: string | null; contactPhone: string | null; owner?: { email: string } };

export function OrganizationBillingContent({ orgId }: { orgId: string }) {
    const t = useTranslation();
    const refreshExperience = useBillingExperience()?.refresh;
    const [activeSection, setActiveSection] = useState("billing");
    const [org, setOrg] = useState<BillingContact>({ contactEmail: null, contactPhone: null });
    const router = useRouter();
    const searchParams = useSearchParams();
    const billingPlanParam = searchParams.get("billingPlan");
    const requestedBillingPlanId = isCheckoutBillingPlanId(billingPlanParam) ? billingPlanParam : null;
    const returnToParam = searchParams.get("returnTo");
    const requestedReturnPath = returnToParam?.startsWith("/") && !returnToParam.startsWith("//") && !returnToParam.includes("\\")
        ? returnToParam
        : null;

    const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
    const [billingLoading, setBillingLoading] = useState(true);
    const billingReadVersion = useRef(0);
    const mounted = useRef(false);
    const [billingAction, setBillingAction] = useState<CheckoutBillingPlanId | null>(null);
    const [billingOperationLoading, setBillingOperationLoading] = useState(false);
    const billingOperationInFlightRef = useRef(false);
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveryConfirmationOpen, setRecoveryConfirmationOpen] = useState(false);
    const [confirmationPlan, setConfirmationPlan] = useState<CheckoutBillingPlanId | null>(null);
    const [handledQueryPlan, setHandledQueryPlan] = useState<CheckoutBillingPlanId | null>(null);
    const [paymentOutcome, setPaymentOutcome] = useState<PaymentOutcome | null>(null);
    const [paymentOutcomeMode, setPaymentOutcomeMode] = useState<RazorpayCheckoutMode>("AUTHORIZATION");
    const [outcomeChangeId, setOutcomeChangeId] = useState<string | null>(null);
    const [outcomePlanId, setOutcomePlanId] = useState<CheckoutBillingPlanId | null>(null);
    const [retryingOutcome, setRetryingOutcome] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancellingSubscription, setCancellingSubscription] = useState(false);
    const [checkoutScriptReady, setCheckoutScriptReady] = useState(
        () => isRazorpayCheckoutReady()
    );
    const [billingNotice, setBillingNotice] = useState<{ tone: "success" | "warning" | "error"; message: string } | null>(null);
    const setBillingOperationBusy = useCallback((busy: boolean) => {
        billingOperationInFlightRef.current = busy;
        setBillingOperationLoading(busy);
    }, []);

    const loadBilling = useCallback(async () => {
        if (!mounted.current) return;
        const version = ++billingReadVersion.current;
        setBillingLoading(true);
        try {
            const overview = await billing.getOverview(orgId);
            if (!mounted.current || version !== billingReadVersion.current) return;
            setBillingOverview(overview);
            setBillingNotice(prev => prev?.tone === "error" ? null : prev);
            await refreshExperience?.();
        } catch (err) {
            if (!mounted.current || version !== billingReadVersion.current) return;
            setBillingNotice({
                tone: "error",
                message: err instanceof Error ? err.message : "Failed to load billing plans.",
            });
        } finally {
            if (mounted.current && version === billingReadVersion.current) setBillingLoading(false);
        }
    }, [orgId, refreshExperience]);

    useEffect(() => {
        mounted.current = true;
        void loadBilling();
        return () => { mounted.current = false; billingReadVersion.current += 1; };
    }, [loadBilling]);
    useEffect(() => {
        let active = true;
        void fetch(`/api/organizations/${encodeURIComponent(orgId)}`)
            .then(async response => response.ok ? response.json() as Promise<BillingContact> : null)
            .then(contact => { if (active && contact) setOrg(contact); })
            .catch(() => { /* Checkout obtains authoritative contact details from the server. */ });
        return () => { active = false; };
    }, [orgId]);

    const launchCheckout = useCallback((
        payload: RazorpayCheckoutPayloadLike,
        mode: RazorpayCheckoutMode,
        planId: CheckoutBillingPlanId | null = null
    ) => {
        openRazorpayCheckout({
            payload,
            mode,
            verify: async response => {
                const result = await billing.verifySubscription(orgId, {
                    changeId: payload.changeId,
                    razorpay_subscription_id: response.razorpay_subscription_id ?? payload.subscriptionId,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                });
                setBillingOverview(previous => previous
                    ? result.subscription.position === "PENDING_REPLACEMENT"
                        ? { ...previous, pendingReplacement: result.subscription }
                        : { ...previous, current: result.subscription }
                    : previous);
                return result;
            },
            recordEvent: async (checkoutResult: RazorpayCheckoutEventResult) => {
                await billing.recordCheckoutEvent(
                    orgId,
                    payload.changeId,
                    checkoutResult.event,
                    checkoutResult.failure
                );
            },
            navigate: processingUrl => router.push(processingUrl),
            onStateChange: state => {
                if (state === "OPEN") {
                    setBillingOperationBusy(true);
                    if (planId) setBillingAction(planId);
                    return;
                }
                if (state === "VERIFYING") {
                    setBillingOperationBusy(true);
                    setBillingNotice({ tone: "warning", message: "Razorpay authorization received. Verifying it securely..." });
                    return;
                }
                if (state === "AWAITING_PROVIDER_CONFIRMATION") {
                    setBillingOperationBusy(true);
                    setBillingNotice({ tone: "warning", message: "Confirmation is taking longer than usual. We are checking Razorpay before changing access." });
                    return;
                }
                if (state === "ABANDONED" || state === "DECLINED" || state === "FAILED") {
                    setOutcomeChangeId(payload.changeId);
                    setOutcomePlanId(planId);
                    setPaymentOutcomeMode(mode);
                    setPaymentOutcome({ status: state });
                    setBillingAction(null);
                    setBillingOperationBusy(false);
                    setRecoveryLoading(false);
                    void loadBilling();
                }
            },
            onVerificationError: () => {
                setBillingNotice({ tone: "warning", message: "Browser verification was interrupted. Provider reconciliation is continuing safely." });
            },
        });
    }, [loadBilling, orgId, router, setBillingOperationBusy]);

    const requestSubscription = useCallback((planId: CheckoutBillingPlanId) => {
        setBillingNotice(null);
        setPaymentOutcome(null);
        setConfirmationPlan(planId);
    }, []);

    const confirmSubscription = useCallback(async () => {
        const planId = confirmationPlan;
        if (!planId) return;
        const current = billingOverview?.current;
        const providerUpdate = canChangeProviderPlan(current ?? null);
        const replacementUpdate = requiresReplacementPlanChange(current ?? null);

        if (current && RECOVERY_BILLING_STATUSES.has(current.status)) {
            setConfirmationPlan(null);
            setBillingNotice({
                tone: "warning",
                message: "Restore the subscription payment before changing the plan.",
            });
            return;
        }
        if (current?.cancelAtCycleEnd) {
            setConfirmationPlan(null);
            setBillingNotice({
                tone: "warning",
                message: "Undo the scheduled cancellation before changing the plan.",
            });
            return;
        }
        if (current && !TERMINAL_BILLING_STATUSES.has(current.status) && current.status !== "CREATED" && !providerUpdate) {
            setConfirmationPlan(null);
            setBillingNotice({
                tone: "warning",
                message: "This subscription needs a confirmed supported recurring payment method before its plan can be changed.",
            });
            return;
        }
        if (billingOperationInFlightRef.current) return;

        setBillingOperationBusy(true);
        setBillingAction(planId);
        setBillingNotice(null);
        try {
            if (providerUpdate) {
                if (replacementUpdate && !checkoutScriptReady && !isRazorpayCheckoutReady()) {
                    setBillingNotice({ tone: "warning", message: "Razorpay Checkout is still loading. Please try again in a moment." });
                    setBillingAction(null);
                    setBillingOperationBusy(false);
                    return;
                }
                setConfirmationPlan(null);
                const result = await billing.changePlan(
                    orgId,
                    planId,
                    requestedReturnPath ?? window.location.pathname + window.location.hash
                );
                if ("purpose" in result && isRazorpayCheckoutPayload(result)) {
                    setBillingOverview(previous => previous
                        ? { ...previous, pendingReplacement: result.subscription }
                        : previous);
                    launchCheckout(result, "AUTHORIZATION", planId);
                    return;
                }
                setBillingNotice({ tone: "warning", message: "Your plan change is being reconciled with Razorpay." });
                if (result.processingUrl) router.push(result.processingUrl);
                else {
                    await loadBilling();
                    setBillingAction(null);
                    setBillingOperationBusy(false);
                }
                return;
            }

            if (!checkoutScriptReady || !isRazorpayCheckoutReady()) {
                setBillingNotice({ tone: "warning", message: "Razorpay Checkout is still loading. Please try again in a moment." });
                setBillingAction(null);
                setBillingOperationBusy(false);
                return;
            }

            const checkout = await billing.createSubscription(
                orgId,
                planId,
                requestedReturnPath ?? window.location.pathname + window.location.hash
            );
            setBillingOverview(previous => previous ? { ...previous, current: checkout.subscription } : previous);
            launchCheckout(checkout, "AUTHORIZATION", planId);
            setConfirmationPlan(null);
        } catch (error) {
            setBillingNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to start Razorpay authorization." });
            setBillingAction(null);
            setBillingOperationBusy(false);
        }
    }, [billingOverview, checkoutScriptReady, confirmationPlan, launchCheckout, loadBilling, orgId, requestedReturnPath, router, setBillingOperationBusy]);

    const startRecovery = useCallback(async () => {
        if (billingOperationInFlightRef.current) return;
        setRecoveryLoading(true);
        setBillingOperationBusy(true);
        setBillingNotice(null);
        try {
            const recovery = await billing.createRecovery(orgId, window.location.pathname + window.location.hash);
            setRecoveryConfirmationOpen(false);
            if ("hostedRecoveryUrl" in recovery && recovery.hostedRecoveryUrl) {
                window.location.assign(recovery.hostedRecoveryUrl);
                return;
            }
            if (!checkoutScriptReady || !isRazorpayCheckoutReady()) {
                router.push(recovery.processingUrl);
                return;
            }
            if (recovery.purpose === "REPLACEMENT") {
                setBillingOverview(previous => previous
                    ? { ...previous, pendingReplacement: recovery.subscription }
                    : previous);
            }
            launchCheckout(
                recovery,
                recovery.purpose === "REPLACEMENT" ? "AUTHORIZATION" : "RECOVERY"
            );
        } catch (error) {
            setBillingNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to start payment recovery." });
            setRecoveryLoading(false);
            setBillingOperationBusy(false);
        }
    }, [checkoutScriptReady, launchCheckout, orgId, router, setBillingOperationBusy]);

    const startPaymentMethodChange = useCallback(async () => {
        const current = billingOverview?.current;
        if (
            billingOperationInFlightRef.current
            || billingOverview?.pendingReplacement
            || !current
            || !isCheckoutBillingPlanId(current.plan)
            || !isSupportedRecurringPaymentMethod(current.providerPaymentMethod)
        ) return;
        if (!checkoutScriptReady || !isRazorpayCheckoutReady()) {
            setBillingNotice({ tone: "warning", message: "Razorpay Checkout is still loading. Please try again in a moment." });
            return;
        }
        setBillingOperationBusy(true);
        setBillingNotice(null);
        try {
            const checkout = await billing.changePaymentMethod(
                orgId,
                window.location.pathname + window.location.hash
            );
            if (!("purpose" in checkout) || !isRazorpayCheckoutPayload(checkout)) {
                if (checkout.processingUrl) router.push(checkout.processingUrl);
                else await loadBilling();
                setBillingOperationBusy(false);
                return;
            }
            setBillingOverview(previous => previous
                ? { ...previous, pendingReplacement: checkout.subscription }
                : previous);
            launchCheckout(checkout, "AUTHORIZATION", current.plan);
        } catch (error) {
            setBillingNotice({
                tone: "error",
                message: error instanceof Error ? error.message : "Unable to start payment-method authorization.",
            });
            setBillingOperationBusy(false);
        }
    }, [billingOverview, checkoutScriptReady, launchCheckout, loadBilling, orgId, router, setBillingOperationBusy]);

    const retryBillingOperation = useCallback(async (changeId: string, planId: CheckoutBillingPlanId | null = null) => {
        const result = await billing.retryOperation(orgId, changeId);
        const checkout = getRazorpayCheckoutPayload(result);
        if (checkout) {
            if (!checkoutScriptReady || !isRazorpayCheckoutReady()) {
                setBillingNotice({ tone: "warning", message: "Razorpay Checkout is still loading. Please try again in a moment." });
                return "REFRESHED" as const;
            }
            launchCheckout(checkout, checkout.subscription_card_change ? "RECOVERY" : "AUTHORIZATION", planId);
            return "CHECKOUT" as const;
        }
        if (result.processingUrl) {
            router.push(result.processingUrl);
            return "PROCESSING" as const;
        }
        await loadBilling();
        return "REFRESHED" as const;
    }, [checkoutScriptReady, launchCheckout, loadBilling, orgId, router]);

    const retryPaymentOutcome = useCallback(async () => {
        if (billingOperationInFlightRef.current) return;
        if (!checkoutScriptReady || !isRazorpayCheckoutReady()) {
            setBillingNotice({ tone: "warning", message: "Razorpay Checkout is still loading. Please try again in a moment." });
            return;
        }
        if (!outcomeChangeId) {
            setPaymentOutcome(null);
            if (outcomePlanId) setConfirmationPlan(outcomePlanId);
            return;
        }
        setBillingOperationBusy(true);
        setRetryingOutcome(true);
        setBillingNotice(null);
        try {
            const result = await retryBillingOperation(outcomeChangeId, outcomePlanId);
            setPaymentOutcome(null);
            if (result === "REFRESHED") setBillingOperationBusy(false);
        } catch (error) {
            setBillingNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to retry authorization." });
            setBillingOperationBusy(false);
        } finally {
            setRetryingOutcome(false);
        }
    }, [checkoutScriptReady, outcomeChangeId, outcomePlanId, retryBillingOperation, setBillingOperationBusy]);

    const confirmCancellation = useCallback(async () => {
        if (!cancelDialogOpen || billingOperationInFlightRef.current) return;
        setBillingOperationBusy(true);
        setCancellingSubscription(true);
        setBillingNotice(null);
        try {
            const result = await billing.cancelSubscription(orgId);
            setBillingOverview(prev => prev ? { ...prev, current: result.subscription } : prev);
            setBillingNotice({
                tone: result.scheduled ? "warning" : "success",
                message: result.scheduled
                    ? getSubscriptionCancellationMode(billingOverview) === "TRIAL"
                        ? "Cancellation is scheduled before the first plan charge. Your trial end date is unchanged."
                        : "Cancellation is scheduled for the end of the current billing cycle."
                    : "The subscription has been cancelled.",
            });
            setCancelDialogOpen(false);
            await loadBilling();
        } catch (err) {
            setBillingNotice({
                tone: "error",
                message: err instanceof Error ? err.message : "Unable to cancel the subscription.",
            });
        } finally {
            setCancellingSubscription(false);
            setBillingOperationBusy(false);
        }
    }, [billingOverview, cancelDialogOpen, loadBilling, orgId, setBillingOperationBusy]);

    const undoCancellation = useCallback(async () => {
        if (billingOperationInFlightRef.current) return;
        setBillingOperationBusy(true);
        setBillingNotice(null);
        try {
            await billing.undoCancellation(orgId);
            await loadBilling();
            setBillingNotice({ tone: "success", message: "The scheduled cancellation was undone." });
        } catch (error) {
            setBillingNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to undo cancellation." });
        } finally { setBillingOperationBusy(false); }
    }, [loadBilling, orgId, setBillingOperationBusy]);

    const claimTrial = useCallback(async () => {
        if (billingOperationInFlightRef.current) return;
        setBillingOperationBusy(true);
        setBillingNotice(null);
        try {
            await billing.claimTrial(orgId);
            await loadBilling();
        } catch (error) {
            setBillingNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to start the trial." });
        } finally { setBillingOperationBusy(false); }
    }, [loadBilling, orgId, setBillingOperationBusy]);

    const undoBillingChange = useCallback(async (changeId: string) => {
        if (billingOperationInFlightRef.current) return;
        setBillingOperationBusy(true);
        setBillingNotice(null);
        try {
            await billing.undoChange(orgId, changeId);
            await loadBilling();
            setBillingNotice({ tone: "success", message: "The pending billing change was undone." });
        } catch (error) {
            setBillingNotice({
                tone: "error",
                message: error instanceof Error ? error.message : "Unable to undo the billing change.",
            });
        } finally {
            setBillingOperationBusy(false);
        }
    }, [loadBilling, orgId, setBillingOperationBusy]);

    useEffect(() => {
        if (!requestedBillingPlanId) return;
        setActiveSection("billing");

        if (!billingOverview || billingLoading || handledQueryPlan === requestedBillingPlanId) return;
        const selectedPlan = billingOverview.plans.find(plan => plan.id === requestedBillingPlanId);
        if (!selectedPlan) return;
        setHandledQueryPlan(requestedBillingPlanId);
        const current = billingOverview.current;
        const experience = billingOverview.experience;

        if (experience.activeOperation) {
            setBillingNotice({
                tone: "warning",
                message: "A billing confirmation is already in progress. Finish or reconcile it before starting another change.",
            });
            return;
        }
        if (current && RECOVERY_BILLING_STATUSES.has(current.status)) {
            setBillingNotice({
                tone: "warning",
                message: "Restore the current recurring payment before changing plans.",
            });
            return;
        }
        if (current?.cancelAtCycleEnd) {
            setBillingNotice({
                tone: "warning",
                message: "Undo the scheduled cancellation before changing plans.",
            });
            return;
        }

        if (isAuthorizedPostTrialPlan(selectedPlan, current, experience)) {
            setBillingNotice({
                tone: "success",
                message: `${selectedPlan.shortName} is already authorized for after the trial.`,
            });
            return;
        }

        if (isCurrentBillingPlan(selectedPlan, current, experience)) {
            setBillingNotice({
                tone: "success",
                message: `${selectedPlan.shortName} is already your current paid plan.`,
            });
            return;
        }

        if (!selectedPlan.active) {
            setBillingNotice({
                tone: "warning",
                message: `${selectedPlan.shortName} is not available for checkout yet.`,
            });
            return;
        }

        setConfirmationPlan(requestedBillingPlanId);
    }, [
        billingLoading,
        billingOverview,
        handledQueryPlan,
        requestedBillingPlanId,
    ]);

    const handleBillingAction = useCallback(async () => {
        const experience = billingOverview?.experience;
        if (!experience || billingOperationInFlightRef.current) return;
        const operationId = experience.activeOperation?.id ?? experience.latestOperation?.id;
        setBillingOperationBusy(true);
        try {
            if (experience.paymentAction === "UPDATE_CARD") {
                if (experience.providerStatus === "PAUSED") {
                    setBillingOperationBusy(false);
                    await startPaymentMethodChange();
                    return;
                }
                setRecoveryConfirmationOpen(true);
                setBillingOperationBusy(false);
                return;
            }
            if (experience.paymentAction === "WAIT_FOR_CONFIRMATION" && operationId) {
                router.push(`/org/${encodeURIComponent(orgId)}/billing/processing/${encodeURIComponent(operationId)}`);
                return;
            }
            if ((experience.paymentAction === "CONTINUE_CHECKOUT"
                || experience.paymentAction === "RETRY_AUTHORIZATION"
                || experience.paymentAction === "RETRY_BILLING_CHANGE") && operationId) {
                const checkoutRequired = experience.paymentAction !== "RETRY_BILLING_CHANGE";
                if (checkoutRequired && (!checkoutScriptReady || !isRazorpayCheckoutReady())) {
                    setBillingNotice({ tone: "warning", message: "Razorpay Checkout is still loading. Please try again in a moment." });
                    setBillingOperationBusy(false);
                    return;
                }
                const result = await retryBillingOperation(
                    operationId,
                    experience.selectedPostTrialPlan
                );
                if (result === "REFRESHED") setBillingOperationBusy(false);
                return;
            }
            if (experience.selectedPostTrialPlan) {
                requestSubscription(experience.selectedPostTrialPlan);
                setBillingOperationBusy(false);
                return;
            }
            setActiveSection("billing");
            setBillingOperationBusy(false);
        } catch (error) {
            setBillingNotice({
                tone: "error",
                message: error instanceof Error ? error.message : "Unable to continue the billing operation.",
            });
            setBillingOperationBusy(false);
        }
    }, [billingOverview, checkoutScriptReady, orgId, requestSubscription, retryBillingOperation, router, setBillingOperationBusy, startPaymentMethodChange]);

    const confirmationPlanDetails = confirmationPlan
        ? billingOverview?.plans.find(plan => plan.id === confirmationPlan) ?? null
        : null;
    const confirmationUsesProviderUpdate = Boolean(
        canChangeProviderPlan(billingOverview?.current ?? null)
    );
    const confirmationUsesReplacement = requiresReplacementPlanChange(billingOverview?.current ?? null);
    const confirmationChangeTiming = confirmationUsesReplacement
        ? "AUTHORIZATION" as const
        : !confirmationUsesProviderUpdate
        ? "AUTHORIZATION" as const
        : billingOverview?.experience.effectivePlan === "STANDARD_TRIAL"
            ? "FUTURE_TRIAL" as const
            : billingPlanRank(confirmationPlan) < billingPlanRank(billingOverview?.current?.plan)
                ? "NEXT_CYCLE" as const
                : "IMMEDIATE_PRORATION" as const;

    const checkoutMethodAvailability: BillingOverview["checkoutMethodAvailability"] = billingOverview?.checkoutMethodAvailability
        ?? (billingOverview?.multiMethodSubscriptionsEnabled
            ? {
                mode: "PROVIDER_MANAGED",
                potentialMethods: ["CARD", "UPI", "EMANDATE"],
                providerControlsVisibility: true,
            }
            : undefined);
    const cancellationMode = getSubscriptionCancellationMode(billingOverview);
    const scheduledCancellation = billingOverview?.experience.scheduledChanges.find(change => change.type === "CANCELLATION" && change.status === "SCHEDULED");
    const cancellationScheduled = Boolean(billingOverview?.current?.cancelAtCycleEnd || scheduledCancellation);
    const cancellationDate = scheduledCancellation?.effectiveAt ?? billingOverview?.current?.cancellationScheduledAt;
    const pendingReplacement = billingOverview?.pendingReplacement ?? null;
    const pendingReplacementChange = billingOverview?.scheduledChanges
        .slice()
        .reverse()
        .find(change => PENDING_REPLACEMENT_CHANGE_TYPES.has(change.type)
            && change.replacementSubscriptionId === pendingReplacement?.id) ?? null;
    const pendingReplacementEffectiveAt = pendingReplacementChange?.effectiveAt
        ?? pendingReplacement?.providerStartAt
        ?? pendingReplacement?.chargeAt
        ?? null;
    const complimentaryReplacementAccess = hasComplimentaryReplacementAccess(billingOverview);
    const pendingReplacementCanUndo = Boolean(
        pendingReplacementChange
        && UNDOABLE_REPLACEMENT_STATUSES.has(pendingReplacementChange.status)
        && (
            !pendingReplacementChange.undoCutoffAt
            || new Date(pendingReplacementChange.undoCutoffAt).getTime() > Date.now()
        )
    );

    return (
        <>
            <RazorpayCheckoutScript
                onReady={() => setCheckoutScriptReady(true)}
                onError={() => {
                    setCheckoutScriptReady(false);
                    setBillingNotice({
                        tone: "error",
                        message: "Razorpay Checkout could not be loaded. Check your connection and refresh the page.",
                    });
                }}
            />
            <SettingsWorkspace
                title={t("Billing and plans")}
                subtitle={t.owned("One organization plan applies to all its branches. Manage subscription payments, invoices and access here. Student fees stay in each branch.")}
                sections={BILLING_SECTIONS}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
            >
                <SettingsPanel id="billing" title={t("Billing")} description={t("Workspace subscription and Razorpay billing state.")} icon={CreditCard}>
                    {billingNotice && (
                        <div role={billingNotice.tone === "error" ? "alert" : "status"} className={cn(
                            "mx-5 my-4 flex items-center gap-2 px-4 py-2 text-sm",
                            billingNotice.tone === "success"
                                ? formSuccessBannerClass
                                : billingNotice.tone === "warning"
                                    ? formWarningBannerClass
                                    : formErrorBannerClass
                        )}>
                            {billingNotice.tone === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                            <span>{billingNotice.tone === "error" ? t.error(billingNotice.message) : t.owned(billingNotice.message)}</span>
                        </div>
                    )}

                    {!billingOverview && !billingLoading ? (
                        <div className="px-5 py-4"><AppButton variant="secondary" onClick={() => void loadBilling()}>{t("Retry")}</AppButton></div>
                    ) : null}
                    {billingOverview?.razorpayTestMode ? (
                        <p role="status" className={cn(formWarningBannerClass, "mx-5 mt-4 px-4 py-3 text-sm")}>{t("Test mode: no live payments are collected.")}</p>
                    ) : null}
                    {billingOverview?.experience && (
                        <div className="mx-5 mt-4 rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-4 py-3 text-sm">
                            <p className="font-semibold text-[color:var(--text-primary)]">{t.owned(formatBillingCustomerState(billingOverview.experience.customerState))}</p>
                            <p className="mt-1 text-[color:var(--text-secondary)]">{billingOverview.experience.customerMessage}</p>
                            {billingOverview.experience.paymentAction !== "NONE"
                                && billingOverview.experience.paymentAction !== "CHOOSE_PLAN"
                                && billingOverview.experience.paymentAction !== "AUTHORIZE_CARD" ? (
                                <AppButton
                                    className="mt-3"
                                    size="sm"
                                    onClick={() => void handleBillingAction()}
                                    isLoading={recoveryLoading || billingOperationLoading}
                                    disabled={recoveryLoading || billingOperationLoading}
                                >
                                    {t.owned(formatBillingAction(billingOverview.experience.paymentAction))}
                                </AppButton>
                            ) : null}
                        </div>
                    )}

                    {billingOverview ? (
                        <BillingPriceSummary experience={billingOverview.experience} current={billingOverview.current} />
                    ) : null}

                    {pendingReplacement ? (
                        <section
                            className="mx-5 mt-4 rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] px-4 py-3 text-sm"
                            aria-label={t("Pending subscription replacement")}
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="font-semibold text-[color:var(--text-primary)]">{t("{shortName} replacement mandate", { shortName: pendingReplacement.shortName })}</p>
                                    <p className="mt-1 text-[color:var(--text-secondary)]">
                                        {getProviderPaymentMethodLabel(pendingReplacement.providerPaymentMethod)}
                                        {pendingReplacementEffectiveAt
                                            ? ` · planned for ${format(new Date(pendingReplacementEffectiveAt), "PP")}`
                                            : t(" · cutover date will appear after Razorpay confirms the mandate")}
                                    </p>
                                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                                        {t("Current billing, invoices, and paid-through dates remain on the existing subscription until cutover.")}</p>
                                    {complimentaryReplacementAccess ? (
                                        <p className="mt-2 font-medium text-[color:var(--ui-badge-success-text)]">
                                            {t("Complimentary upgrade access is active while billing remains on the current subscription.")}</p>
                                    ) : null}
                                </div>
                                {pendingReplacementCanUndo && pendingReplacementChange ? (
                                    <AppButton
                                        variant="secondary"
                                        size="sm"
                                        disabled={billingOperationLoading}
                                        isLoading={billingOperationLoading}
                                        onClick={() => void undoBillingChange(pendingReplacementChange.id)}
                                    >
                                        {t("Undo")}</AppButton>
                                ) : null}
                            </div>
                        </section>
                    ) : null}

                    {billingOverview ? (
                        <BillingPaymentMethodsOverview
                            availability={checkoutMethodAvailability}
                            currentMethod={billingOverview.current?.providerPaymentMethod}
                            canChangeMethod={Boolean(
                                billingOverview.current
                                && isSupportedRecurringPaymentMethod(billingOverview.current.providerPaymentMethod)
                                && isCheckoutBillingPlanId(billingOverview.current.plan)
                                && checkoutMethodAvailability?.mode === "PROVIDER_MANAGED"
                                && !pendingReplacement
                            )}
                            changeDisabled={Boolean(billingOverview.experience.activeOperation)}
                            changeLoading={billingOperationLoading}
                            onChangeMethod={() => void startPaymentMethodChange()}
                        />
                    ) : null}

                </SettingsPanel>
                <SettingsPanel id="plans" title={t("Plans")} description={t("Choose the features your workspace needs.")} icon={Sparkles}>
                    <section className="px-5 py-5" aria-labelledby="billing-plans-title">
                        <div className="mb-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{t("Plans")}</p>
                            <h3 id="billing-plans-title" className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">
                                {t("Choose the right workspace plan")}</h3>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                                {t("Monthly billing is based on the selected plan and active branch count. You review the total before continuing to Razorpay.")}</p>
                        </div>
                        {billingLoading ? (
                            <div className="flex min-h-28 items-center justify-center text-sm text-[color:var(--text-primary)]">
                                <Loader2 className="mr-2 animate-spin" size={18} />
                                {t("Loading billing plans...")}</div>
                        ) : (
                            <div className="grid gap-3 xl:grid-cols-3">
                                {(billingOverview?.plans ?? []).filter(plan => isCheckoutBillingPlanId(plan.id)).map(plan => (
                                    <BillingPlanCard
                                        key={plan.id}
                                        plan={plan}
                                        current={billingOverview?.current ?? null}
                                        experience={billingOverview?.experience ?? null}
                                        busyPlan={billingAction}
                                        checkoutReady={checkoutScriptReady}
                                        operationBusy={billingOperationLoading}
                                        onStart={requestSubscription}
                                    />
                                ))}
                            </div>
                        )}
                        <WorkspacePreviews />
                    </section>

                </SettingsPanel>
                <SettingsPanel id="subscription" title={t("Subscription controls")} description={t("Manage renewals and scheduled changes.")} icon={CreditCard}>
                    {billingOverview?.current
                        && (cancellationScheduled || cancellationMode != null) ? (
                        <section className="space-y-3 px-5 py-4" aria-labelledby="subscription-controls-title">
                            <div>
                                <h3 id="subscription-controls-title" className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Subscription controls")}</h3>
                                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                                    {t.owned(cancellationMode === "TRIAL" ? "Cancelling the authorized subscription keeps your trial end date unchanged." : "Cancellation preserves access through the end of the current paid billing cycle.")}</p>
                            </div>
                            {cancellationScheduled ? (
                                <div className={cn(formWarningBannerClass, "px-4 py-3 text-sm")}>
                                    {cancellationDate
                                        ? t("Cancellation is scheduled for {date}.", { date: format(new Date(cancellationDate), "PP") })
                                        : t("Cancellation is scheduled")}
                                    <div className="mt-3"><AppButton variant="secondary" size="sm" disabled={billingOperationLoading} isLoading={billingOperationLoading} onClick={() => void undoCancellation()}>{t("Undo cancellation")}</AppButton></div>
                                </div>
                            ) : cancellationMode ? (
                                <div className="flex flex-wrap justify-end gap-2">
                                    <AppButton
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setCancelDialogOpen(true)}
                                        disabled={billingOperationLoading || Boolean(billingOverview.experience.activeOperation) || Boolean(pendingReplacement)}
                                    >
                                        {t.owned(cancellationMode === "TRIAL" ? "Cancel before first charge" : "Cancel at cycle end")}</AppButton>
                                </div>
                            ) : null}
                        </section>
                    ) : null}

                    {billingOverview?.ownerTrialEligibility?.claimable && !billingOverview.trial && (
                        <div className="mx-5 mt-4 rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span>{t("Your owner account has one available 30-day Standard trial.")}</span>
                                <AppButton size="sm" disabled={billingOperationLoading} isLoading={billingOperationLoading} onClick={() => void claimTrial()}>
                                    {t("Start trial here")}</AppButton>
                            </div>
                        </div>
                    )}

                    {(billingOverview?.experience.scheduledChanges.length ?? 0) > 0 && (
                        <div className="border-t border-[color:var(--ui-form-section-divider)] px-5 py-4">
                            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Scheduled changes")}</h3>
                            <div className="mt-3 space-y-2">
                                {billingOverview?.experience.scheduledChanges.map(change => (
                                    <div key={change.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] px-3 py-2 text-xs">
                                        <span className="text-[color:var(--text-primary)]">
                                            {t.owned(formatBillingChangeType(change.type))} · {change.status === "SCHEDULED" ? t("Scheduled") : t("Awaiting confirmation")}
                                            {change.effectiveAt ? ` · ${format(new Date(change.effectiveAt), "PP")}` : ""}
                                        </span>
                                        {(change.status === "SCHEDULED" || change.status === "FAILED" || change.status === "AWAITING_PROVIDER_CONFIRMATION") && (
                                            <AppButton variant="secondary" size="sm" disabled={billingOperationLoading} onClick={() => void undoBillingChange(change.id)}>
                                                {t("Undo")}</AppButton>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </SettingsPanel>
                <BillingInvoiceHistory organizationId={orgId} refreshKey={billingOverview} />
                <SettingsPanel id="history" title={t("Subscription history")} icon={History}>
                    <div className="px-5 py-4"><BillingHistoryBrowser organizationId={orgId} /></div>
                    {(billingOverview?.history.length ?? 0) > 0 ? (
                        <div className="border-t border-[color:var(--ui-form-section-divider)] px-5 py-4">
                            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Subscription history")}</h3>
                            <div className="mt-3 space-y-2">
                                {billingOverview?.history.slice(0, 8).map(entry => (
                                    <div
                                        key={entry.id}
                                        className="flex flex-col gap-1 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <span className="font-medium text-[color:var(--text-primary)]">
                                            {entry.plan} · {entry.fromStatus ? `${entry.fromStatus} → ` : ""}{entry.toStatus}
                                        </span>
                                        <span className="text-[color:var(--text-secondary)]">
                                            {entry.source.replaceAll("_", " ")} · {format(new Date(entry.createdAt), "PPp")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : <p className="px-5 py-4 text-sm text-[color:var(--text-secondary)]">{t("No subscription activity yet.")}</p>}
                </SettingsPanel>

            </SettingsWorkspace>
            {confirmationPlanDetails && billingOverview ? (
                <CheckoutConfirmationDialog
                    isOpen={confirmationPlan != null}
                    loading={billingAction === confirmationPlanDetails.id}
                    purpose={confirmationUsesReplacement ? "REPLACEMENT" : "PLAN"}
                    planName={confirmationPlanDetails.shortName}
                    downgradeNotice={workspaceDowngradeNotice(billingOverview.experience.effectivePlan, confirmationPlanDetails.id)}
                    unitAmount={confirmationPlanDetails.amount ?? 0}
                    quantity={billingOverview.experience.projectedQuantity}
                    monthlyTotal={(confirmationPlanDetails.amount ?? 0) * billingOverview.experience.projectedQuantity}
                    trialActive={billingOverview.experience.effectivePlan === "STANDARD_TRIAL"}
                    changeTiming={confirmationChangeTiming}
                    trialEndsAt={billingOverview.experience.trialEndsAt}
                    providerChargeAt={billingOverview.experience.nextChargeAt}
                    effectiveAt={confirmationChangeTiming === "NEXT_CYCLE"
                        ? billingOverview.current?.currentEnd ?? billingOverview.experience.paidThrough
                        : null}
                    planFeeDueToday={confirmationUsesReplacement || billingOverview.experience.effectivePlan === "STANDARD_TRIAL"
                        ? 0
                        : (confirmationPlanDetails.amount ?? 0) * billingOverview.experience.projectedQuantity}
                    contactEmail={org.contactEmail || org.owner?.email}
                    contactPhone={org.contactPhone}
                    testMode={billingOverview.razorpayTestMode}
                    multiMethodEnabled={checkoutMethodAvailability?.mode === "PROVIDER_MANAGED"}
                    onClose={() => setConfirmationPlan(null)}
                    onConfirm={confirmSubscription}
                />
            ) : null}
            <PaymentOutcomeDialog
                outcome={paymentOutcome}
                mode={paymentOutcomeMode}
                retrying={retryingOutcome}
                onRetry={retryPaymentOutcome}
                onClose={() => setPaymentOutcome(null)}
            />
            {billingOverview?.current ? (
                <CheckoutConfirmationDialog
                    isOpen={recoveryConfirmationOpen}
                    loading={recoveryLoading}
                    purpose="RECOVERY"
                    planName={billingPlanName(billingOverview.current.plan)}
                    unitAmount={billingOverview.current.unitAmount}
                    quantity={billingOverview.current.quantity}
                    monthlyTotal={billingOverview.current.monthlyTotal}
                    trialActive={false}
                    changeTiming="AUTHORIZATION"
                    trialEndsAt={null}
                    providerChargeAt={billingOverview.experience.nextChargeAt}
                    effectiveAt={null}
                    planFeeDueToday={billingOverview.current.monthlyTotal}
                    contactEmail={org.contactEmail || org.owner?.email}
                    contactPhone={org.contactPhone}
                    testMode={billingOverview.razorpayTestMode}
                    multiMethodEnabled={checkoutMethodAvailability?.mode === "PROVIDER_MANAGED"}
                    onClose={() => setRecoveryConfirmationOpen(false)}
                    onConfirm={startRecovery}
                />
            ) : null}
            <ConfirmDialog
                isOpen={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onConfirm={confirmCancellation}
                loading={cancellingSubscription}
                variant="danger"
                title={t.owned(cancellationMode === "TRIAL" ? "Cancel the authorized subscription?" : "Cancel at cycle end?")}
                description={t.owned(cancellationMode === "TRIAL"
                    ? "Your Standard trial keeps its original end date. Cancellation is scheduled before the first plan charge."
                    : "Your current access remains available until this billing cycle ends. Razorpay will not renew the subscription afterward. Already-paid fees are handled under the Cancellation and Refund Policy.")}
                confirmText="Schedule cancellation"
            />
        </>
    );
}
const TERMINAL_BILLING_STATUSES = new Set(["CANCELLED", "COMPLETED", "EXPIRED"]);
const PROVIDER_PLAN_UPDATE_STATUSES = new Set(["AUTHENTICATED", "ACTIVE"]);
const RECOVERY_BILLING_STATUSES = new Set(["PENDING", "HALTED"]);
const PENDING_REPLACEMENT_CHANGE_TYPES = new Set([
    "PAYMENT_METHOD_REPLACEMENT",
    "PLAN_UPGRADE",
    "PLAN_DOWNGRADE",
    "TRIAL_SUBSCRIPTION_UPDATE",
    "QUANTITY_INCREASE",
    "BRANCH_REACTIVATION",
    "BRANCH_REMOVAL",
]);
const UNDOABLE_REPLACEMENT_STATUSES = new Set([
    "QUEUED",
    "PROCESSING",
    "AWAITING_PAYMENT",
    "SCHEDULED",
    "FAILED",
]);

/** Mirror the existing service's paid-cycle or active owner-trial cancellation boundary. */
export function getSubscriptionCancellationMode(overview: BillingOverview | null, now = Date.now()): "PAID" | "TRIAL" | null {
    const current = overview?.current;
    if (!current) return null;
    if (current.status === "ACTIVE") return "PAID";
    if (overview?.billingModelVersion === "WORKSPACE_V2" && current.status === "AUTHENTICATED"
        && overview.trial?.status === "ACTIVE" && overview.trial.endsAt
        && Date.parse(overview.trial.endsAt) > now) return "TRIAL";
    return null;
}

/** Display only a still-valid, server-recorded grant for this exact replacement. */
export function hasComplimentaryReplacementAccess(overview: BillingOverview | null, now = Date.now()) {
    const current = overview?.current;
    const candidate = overview?.pendingReplacement;
    if (!current || !candidate || !overview?.entitlements.canWrite) return false;
    const change = overview.scheduledChanges.find(item => item.replacementSubscriptionId === candidate.id
        && item.organizationSubscriptionId === current.id);
    if (!change?.accessGrantedAt || change.accessRevokedAt
        || change.failureCategory === "MANUAL_REVIEW_REQUIRED"
        || !["QUEUED", "PROCESSING", "AWAITING_PAYMENT", "SCHEDULED"].includes(change.status)
        || !isSupportedRecurringPaymentMethod(candidate.providerPaymentMethod)) return false;
    const authorizationCurrent = PROVIDER_PLAN_UPDATE_STATUSES.has(candidate.status)
        || (candidate.status === "PENDING" && candidate.providerPaymentMethod === "EMANDATE"
            && !!change.effectiveAt && Date.parse(change.effectiveAt) <= now
            && !!change.accessGraceEndsAt && Date.parse(change.accessGraceEndsAt) > now);
    if (!authorizationCurrent) return false;
    const planUpgrade = planRank(candidate.plan) > planRank(current.plan)
        && candidate.quantity >= current.quantity
        && overview.entitlements.effectivePlan === candidate.plan;
    const branchAddition = candidate.plan === current.plan && candidate.quantity > current.quantity;
    return planUpgrade || branchAddition;
}

function canChangeProviderPlan(subscription: OrganizationSubscriptionDto | null) {
    return Boolean(
        subscription
        && PROVIDER_PLAN_UPDATE_STATUSES.has(subscription.status)
        && isSupportedRecurringPaymentMethod(subscription.providerPaymentMethod)
        && !subscription.cancelAtCycleEnd
    );
}

function requiresReplacementPlanChange(subscription: OrganizationSubscriptionDto | null) {
    // CARD alone does not prove that Razorpay supports changing the mandate:
    // domestic cards cannot change plan/quantity in place. The server uses a
    // replacement until it has an explicit supported provider capability.
    return canChangeProviderPlan(subscription);
}

function planRank(plan: OrganizationSubscriptionDto["plan"]) {
    return billingPlanRank(plan);
}

function formatBillingCustomerState(state: BillingOverview["experience"]["customerState"]) {
    const labels: Record<BillingOverview["experience"]["customerState"], string> = {
        TRIAL_ACTIVE: "Standard trial active",
        BASIC_ACTIVE: "Basic active",
        STANDARD_ACTIVE: "Standard active",
        PRO_ACTIVE: "Pro active",
        PAYMENT_RETRYING: "Payment retry in progress",
        PAYMENT_HALTED: "Payment method needs attention",
        CONFIRMING: "Confirming with Razorpay",
        PAYMENT_NOT_COMPLETED: "Payment not completed",
        PAYMENT_DECLINED: "Payment authorization declined",
        PAYMENT_FAILED: "Billing update failed",
        ACCESS_ENDED: "Paid access ended",
        AUTHORIZATION_REQUIRED: "Payment-method authorization required",
    };
    return labels[state];
}
function formatBillingAction(action: BillingOverview["experience"]["paymentAction"]) {
    const labels: Record<BillingOverview["experience"]["paymentAction"], string> = {
        NONE: "Manage billing",
        CHOOSE_PLAN: "Choose plan",
        CONTINUE_CHECKOUT: "Continue authorization",
        WAIT_FOR_CONFIRMATION: "View confirmation",
        RETRY_AUTHORIZATION: "Retry authorization",
        RETRY_BILLING_CHANGE: "Retry billing change",
        UPDATE_CARD: "Update payment method and retry",
        AUTHORIZE_CARD: "Authorize payment method",
    };
    return labels[action];
}

function formatBillingChangeType(type: string) {
    const labels: Record<string, string> = {
        SUBSCRIPTION_AUTHORIZATION: "Subscription authorization",
        TRIAL_SUBSCRIPTION_UPDATE: "Post-trial subscription update",
        PLAN_UPGRADE: "Plan upgrade",
        PLAN_DOWNGRADE: "Plan downgrade",
        QUANTITY_INCREASE: "Branch quantity increase",
        BRANCH_REMOVAL: "Branch removal",
        BRANCH_REACTIVATION: "Branch reactivation",
        PAYMENT_METHOD_REPLACEMENT: "Payment method replacement",
        CANCELLATION: "Subscription cancellation",
    };
    return labels[type] ?? "Billing change";
}

function formatPlanAmount(plan: BillingPlanDto) {
    if (plan.amount == null || plan.custom) return "Custom";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: plan.currency,
        maximumFractionDigits: 0,
    }).format(plan.amount);
}

function isCurrentBillingPlan(
    plan: BillingPlanDto,
    current: OrganizationSubscriptionDto | null,
    experience: BillingOverview["experience"] | null | undefined
) {
    const effectivePlanId = experience?.effectivePlan;
    return current?.plan === plan.id
        && current.paidThrough != null
        && effectivePlanId === plan.id;
}

function isAuthorizedPostTrialPlan(
    plan: BillingPlanDto,
    current: OrganizationSubscriptionDto | null,
    experience: BillingOverview["experience"] | null | undefined
) {
    const selectedPlanId = experience?.selectedPostTrialPlan;
    return experience?.effectivePlan === "STANDARD_TRIAL"
        && experience.authorizationStatus === "AUTHORIZED"
        && selectedPlanId === plan.id
        && current?.plan === plan.id;
}

export function BillingPlanCard({
    plan,
    current,
    experience,
    busyPlan,
    checkoutReady,
    operationBusy,
    onStart,
}: {
    plan: BillingPlanDto;
    current: OrganizationSubscriptionDto | null;
    experience: BillingOverview["experience"] | null;
    busyPlan: CheckoutBillingPlanId | null;
    checkoutReady: boolean;
    operationBusy: boolean;
    onStart: (plan: CheckoutBillingPlanId) => void;
}) {
    const t = useTranslation();
    const isCurrent = isCurrentBillingPlan(plan, current, experience);
    const selectedPlanId = experience?.selectedPostTrialPlan;
    const isSelectedAfterTrial = experience?.effectivePlan === "STANDARD_TRIAL" && selectedPlanId === plan.id;
    const isAuthorizedAfterTrial = isAuthorizedPostTrialPlan(plan, current, experience);
    const providerUpdate = canChangeProviderPlan(current);
    const replacementUpdate = requiresReplacementPlanChange(current);
    const recoveryRequired = Boolean(current && RECOVERY_BILLING_STATUSES.has(current.status));
    const cancellationScheduled = Boolean(current?.cancelAtCycleEnd);
    const unsupportedProviderUpdate = Boolean(
        current
        && !TERMINAL_BILLING_STATUSES.has(current.status)
        && current.status !== "CREATED"
        && !providerUpdate
        && !recoveryRequired
        && !cancellationScheduled
    );
    const isBusy = busyPlan === plan.id;
    const operationInProgress = Boolean(experience?.activeOperation);
    const requiresCheckout = !providerUpdate || replacementUpdate;
    const disabled = (!checkoutReady && requiresCheckout)
        || operationBusy
        || Boolean(busyPlan)
        || operationInProgress
        || isCurrent
        || isAuthorizedAfterTrial
        || recoveryRequired
        || cancellationScheduled
        || unsupportedProviderUpdate
        || !plan.active;
    let buttonLabel = `Authorize ${plan.shortName}`;
    if (plan.comingSoon) buttonLabel = "Coming soon";
    else if (plan.custom) buttonLabel = "Custom";
    else if (isCurrent) buttonLabel = "Current plan";
    else if (isAuthorizedAfterTrial) buttonLabel = "Authorized for after trial";
    else if (recoveryRequired) buttonLabel = "Resolve payment first";
    else if (cancellationScheduled) buttonLabel = "Undo cancellation first";
    else if (unsupportedProviderUpdate) buttonLabel = "Payment method confirmation required";
    else if (operationInProgress) buttonLabel = "Authorization in progress";
    else if (!checkoutReady && requiresCheckout) buttonLabel = "Loading checkout...";
    else if (providerUpdate && experience?.effectivePlan === "STANDARD_TRIAL") {
        buttonLabel = `Change to ${plan.shortName} after trial`;
    } else if (providerUpdate && billingPlanRank(plan.id) > billingPlanRank(current?.plan)) {
        buttonLabel = `Upgrade to ${plan.shortName}`;
    } else if (providerUpdate && billingPlanRank(plan.id) < billingPlanRank(current?.plan)) {
        buttonLabel = `Change to ${plan.shortName} at renewal`;
    } else if (providerUpdate) buttonLabel = `Change to ${plan.shortName}`;

    return (
        <div className={cn(
            "flex min-h-[340px] flex-col rounded-[var(--ui-radius-panel)] border p-4",
            plan.featured
                ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]"
                : "border-[color:var(--ui-panel-border)] bg-[color:var(--ui-form-surface-bg)]"
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{plan.shortName}</h3>
                    <SettingsSubtleText className="mt-1">{t.owned(plan.description)}</SettingsSubtleText>
                    {plan.availabilityNote && <SettingsSubtleText className="mt-2">{t.owned(plan.availabilityNote)}</SettingsSubtleText>}
                </div>
                {plan.featured && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--ui-badge-cyan-text)]">
                        <Sparkles size={11} />
                        {t("Popular")}</span>
                )}
            </div>

            <div className="mt-5">
                <span className="text-2xl font-semibold text-[color:var(--text-primary)]">{formatPlanAmount(plan)}</span>
                {!plan.custom && <span className="ml-1 text-xs text-[color:var(--text-secondary)]">{t("/ branch / month")}</span>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {isCurrent && current && (
                    <span className="rounded-full border border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--ui-badge-success-text)]">
                        {t("Current plan")}</span>
                )}
                {isAuthorizedAfterTrial ? (
                    <span className="rounded-full border border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--ui-badge-success-text)]">
                        {t("Authorized after trial")}</span>
                ) : isSelectedAfterTrial ? (
                    <span className="rounded-full border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--ui-badge-cyan-text)]">
                        {t("Selected after trial")}</span>
                ) : null}
                {!plan.active && (
                    <span className="rounded-full border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--text-secondary)]">
                        {plan.custom ? t("Custom") : t("Soon")}
                    </span>
                )}
            </div>

            <div className="mt-5 flex-1 space-y-2.5">
                {plan.capabilities.map(capability => (
                    <div key={capability.id} className={cn("flex gap-2 text-sm", capability.included ? "text-[color:var(--text-secondary)]" : "text-[color:var(--text-muted)]")}>
                        {capability.included ? (
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[color:var(--ui-badge-success-text)]" />
                        ) : (
                            <XCircle size={15} className="mt-0.5 shrink-0 text-[color:var(--text-secondary)]" />
                        )}
                        <span>{t.owned(capability.label)}{capability.included ? "" : t(capability.id === "WHATSAPP_INTEGRATION" ? " — Pro only" : " — Standard or Pro")}</span>
                    </div>
                ))}
            </div>

            <AppButton
                variant={plan.featured ? "primary" : "secondary"}
                size="sm"
                className="mt-5 w-full"
                disabled={disabled}
                isLoading={isBusy}
                onClick={() => onStart(plan.id)}
            >
                {t.owned(buttonLabel)}
            </AppButton>
        </div>
    );
}
