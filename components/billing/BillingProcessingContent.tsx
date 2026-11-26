"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import Link from "next/link";
import { accountBillingOperationReturn, accountBillingProcessingDestination } from "@/lib/accountNavigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RotateCcw } from "lucide-react";
import { billingForBranch, type BillingOperationDto } from "@/lib/api/billing";
import { needsSourceCancellationReview } from "@/lib/billingState";
import {
  getRazorpayCheckoutPayload,
  isRazorpayCheckoutReady,
  openHostedPaymentRecovery,
  openRazorpayCheckout,
  RazorpayCheckoutScript,
  RECOVERY_UNAVAILABLE_MESSAGE,
  type RazorpayCheckoutEventResult,
} from "@/components/billing/RazorpayCheckoutLauncher";
import { AppButton, AppPanel } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListPage } from "@/components/ui/RecordList";

const PROVIDER_CONFIRMED = new Set<BillingOperationDto["operationStatus"]>(["APPLIED", "SCHEDULED"]);
const TERMINAL_OPERATION_STATUSES = new Set<BillingOperationDto["operationStatus"]>([
  "APPLIED",
  "SCHEDULED",
  "ABANDONED",
  "DECLINED",
  "FAILED",
]);
const POLL_INTERVAL_MS = 2_000;
const RECONCILE_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 30;

export type ProcessingReconcileGate = {
  key: string;
  nextAllowedAt: number;
  inFlight: Promise<unknown> | null;
};

export function reconcileWithCooldown(
  gate: ProcessingReconcileGate,
  key: string,
  reconcile: () => Promise<unknown>,
  now = Date.now()
) {
  if (gate.key !== key) {
    gate.key = key;
    gate.nextAllowedAt = 0;
    gate.inFlight = null;
  }
  if (gate.inFlight) return gate.inFlight;
  if (now < gate.nextAllowedAt) return Promise.resolve();

  gate.nextAllowedAt = now + RECONCILE_INTERVAL_MS;
  const request = Promise.resolve().then(reconcile);
  gate.inFlight = request;
  return request.finally(() => {
    if (gate.inFlight === request) gate.inFlight = null;
  });
}

export function preferProviderConfirmedOperation(
  current: BillingOperationDto | null,
  incoming: BillingOperationDto,
  checkoutReopened = false
) {
  if (!current) return incoming;
  // A confirmed replacement can still be waiting for evidence that the source
  // was cancelled. Older records retain SCHEDULED throughout that hold.
  if (current.id === incoming.id && (needsSourceCancellationReview(current) || needsSourceCancellationReview(incoming))) {
    return Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt) ? incoming : current;
  }
  if (PROVIDER_CONFIRMED.has(current.operationStatus) && !PROVIDER_CONFIRMED.has(incoming.operationStatus)) {
    return current;
  }
  // A successful owner retry may deliberately reopen a failed attempt. Ordinary
  // polling still cannot roll a terminal outcome back to stale pending state.
  if (checkoutReopened && incoming.id === current.id && incoming.operationStatus === "CHECKOUT_OPEN") {
    return incoming;
  }
  if (
    TERMINAL_OPERATION_STATUSES.has(current.operationStatus)
    && !TERMINAL_OPERATION_STATUSES.has(incoming.operationStatus)
  ) {
    return current;
  }
  return incoming;
}

export function isBillingOperationTerminal(status: BillingOperationDto["operationStatus"]) {
  return TERMINAL_OPERATION_STATUSES.has(status);
}

export function getBillingProcessingCopy(operation: BillingOperationDto | null, timedOut: boolean, recoveryUnavailable = false) {
  if (!operation) return { title: "Checking your billing update", body: "We are securely checking Razorpay for confirmation." };
  if (needsSourceCancellationReview(operation)) return {
    title: "Checking the previous subscription",
    body: "Razorpay still needs to confirm cancellation of the previous subscription.",
  };
  if (operation.operationStatus === "APPLIED") return { title: "Billing update confirmed", body: "Your account now reflects the provider-confirmed change." };
  if (operation.operationStatus === "SCHEDULED") return { title: "Change scheduled", body: "Your current access stays in place until the effective date shown in billing settings." };
  if (recoveryUnavailable && !isBillingOperationTerminal(operation.operationStatus)) return { title: "Payment recovery", body: RECOVERY_UNAVAILABLE_MESSAGE };
  if (operation.canResumePaymentRecovery) return { title: "Payment recovery", body: "You can continue the payment for this branch’s existing subscription." };
  if (operation.canResumePaymentRecovery === false && isBillingOperationTerminal(operation.operationStatus)) {
    return { title: "Payment recovery ended", body: "Return to billing to see the available actions for this branch." };
  }
  if (operation.operationStatus === "ABANDONED") return { title: "Payment was not completed", body: "Your current plan or trial has not been changed." };
  if (operation.operationStatus === "DECLINED") return { title: "Authorization was not confirmed", body: "You can retry with another supported recurring payment method. Check your bank statement before retrying if the provider response was unclear." };
  if (operation.operationStatus === "FAILED") return { title: "We could not apply the billing update", body: operation.message || "Your existing access remains unchanged. You can safely retry." };
  if (timedOut) return { title: "Confirmation is taking longer than usual", body: "You can leave this page. We will keep reconciling the provider state and show the result in billing settings." };
  return { title: "Verifying with Razorpay", body: "Keep this page open while we confirm the subscription, payment, and paid period." };
}

export default function BillingProcessingContent({ orgId, changeId, branchId, returnTo }: { orgId: string; changeId: string; branchId: string; returnTo?: string }) {
    const t = useTranslation();
  const router = useRouter();
  const billing = useMemo(() => billingForBranch(branchId), [branchId]);
  const [operation, setOperation] = useState<BillingOperationDto | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [pollGeneration, setPollGeneration] = useState(0);
  const [checkoutReady, setCheckoutReady] = useState(() => isRazorpayCheckoutReady());
  const operationKey = `${orgId}:${branchId ?? ""}:${changeId}`;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const operationRef = useRef<{ key: string; value: BillingOperationDto | null }>({
    key: operationKey,
    value: null,
  });
  const reconcileGateRef = useRef<ProcessingReconcileGate>({ key: "", nextAllowedAt: 0, inFlight: null });

  const applyOperation = useCallback((incoming: BillingOperationDto, checkoutReopened = false) => {
    if (operationRef.current.key !== operationKey) {
      operationRef.current = { key: operationKey, value: null };
    }
    const preferred = preferProviderConfirmedOperation(operationRef.current.value, incoming, checkoutReopened);
    operationRef.current.value = preferred;
    setOperation(preferred);
    return preferred;
  }, [operationKey]);

  const reconcileIfDue = useCallback(async () => {
    await reconcileWithCooldown(
      reconcileGateRef.current,
      operationKey,
      () => billing.reconcileOperation(orgId, changeId)
    );
  }, [billing, changeId, operationKey, orgId]);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    let timer: number | undefined;

    const check = async () => {
      let preferred: BillingOperationDto;
      try {
        const current = await billing.getOperation(orgId, changeId);
        if (stopped) return;
        preferred = applyOperation(current.operation);
        if (isBillingOperationTerminal(preferred.operationStatus)) {
          setError("");
          return;
        }
      } catch (requestError) {
        if (stopped) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to check billing status");
        attempts += 1;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setTimedOut(true);
          return;
        }
        timer = window.setTimeout(check, POLL_INTERVAL_MS);
        return;
      }

      let reconciliationError = "";
      try {
        await reconcileIfDue();
      } catch (requestError) {
        reconciliationError = requestError instanceof Error
          ? requestError.message
          : "Razorpay confirmation is temporarily unavailable";
      }

      if (stopped) return;

      try {
        const result = await billing.getOperation(orgId, changeId);
        if (stopped) return;
        preferred = applyOperation(result.operation);
        setError(reconciliationError);
        attempts += 1;
        if (isBillingOperationTerminal(preferred.operationStatus)) return;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setTimedOut(true);
          return;
        }
        timer = window.setTimeout(check, POLL_INTERVAL_MS);
      } catch (requestError) {
        if (stopped) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to check billing status");
        attempts += 1;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setTimedOut(true);
          return;
        }
        timer = window.setTimeout(check, POLL_INTERVAL_MS);
      }
    };
    void check();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [applyOperation, billing, changeId, orgId, pollGeneration, reconcileIfDue]);

  const content = getBillingProcessingCopy(operation, timedOut, recoveryUnavailable);
  const sourceReview = needsSourceCancellationReview(operation);
  const resumeRecovery = operation?.canResumePaymentRecovery === true;
  const successful = !sourceReview && (operation?.operationStatus === "APPLIED" || operation?.operationStatus === "SCHEDULED");
  useEffect(() => {
    if (successful) window.dispatchEvent(new Event("billing-access-changed"));
  }, [successful]);
  const failed = operation && (sourceReview || ["DECLINED", "ABANDONED", "FAILED"].includes(operation.operationStatus));
  const waitingForCheckout = !resumeRecovery && !sourceReview && operation?.type === "SUBSCRIPTION_AUTHORIZATION" && !checkoutReady;
  const returnPath = accountBillingOperationReturn(orgId, operation?.returnPath, branchId, returnTo);

  const retry = async () => {
    if (waitingForCheckout) {
      setError("Razorpay Checkout is still loading. Please wait a moment and try again.");
      return;
    }
    setRetrying(true);
    setError("");
    try {
      if (sourceReview) {
        const result = await billing.reconcileOperation(orgId, changeId);
        if (!mounted.current) return;
        if (result.operation) applyOperation(result.operation);
        setPollGeneration(current => current + 1);
        return;
      }
      const result = await billing.retryOperation(orgId, changeId);
      if (!mounted.current) return;
      setRecoveryUnavailable("recoveryUnavailable" in result && result.recoveryUnavailable === true);
      if (openHostedPaymentRecovery(result)) return;
      const checkout = getRazorpayCheckoutPayload(result);
      if (checkout) {
        if (!checkoutReady || !isRazorpayCheckoutReady()) {
          setError("Razorpay Checkout is still loading. Please wait a moment and try again.");
          return;
        }
        if (result.operation) applyOperation(result.operation, true);
        openRazorpayCheckout({
          payload: checkout,
          mode: checkout.subscription_card_change ? "RECOVERY" : "AUTHORIZATION",
          verify: (response) => billing.verifySubscription(orgId, {
            changeId: checkout.changeId,
            razorpay_subscription_id: response.razorpay_subscription_id ?? checkout.subscriptionId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
          recordEvent: async (checkoutResult: RazorpayCheckoutEventResult) => {
            await billing.recordCheckoutEvent(
              orgId,
              checkout.changeId,
              checkoutResult.event,
              checkoutResult.failure
            );
          },
          navigate: (processingUrl) => {
            if (!mounted.current) return;
            router.replace(accountBillingProcessingDestination(processingUrl, returnPath));
            setTimedOut(false);
            setPollGeneration((current) => current + 1);
          },
          onStateChange: (state) => {
            if (["ABANDONED", "DECLINED", "FAILED"].includes(state)) {
              setTimedOut(false);
              setPollGeneration((current) => current + 1);
            }
          },
          onVerificationError: () => setError(""),
        });
        return;
      }

      if (result.operation) applyOperation(result.operation);
      // Provider-native updates do not use Checkout. Poll this operation again
      // instead of navigating back to the page that is already open.
      setTimedOut(false);
      setPollGeneration((current) => current + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to retry billing update");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <RecordListPage title={t("Billing confirmation")} description={t("Provider-confirmed subscription processing")}>
      <RazorpayCheckoutScript
        onReady={() => setCheckoutReady(true)}
        onError={() => setError("Razorpay Checkout could not be loaded. Check your connection and try again.")}
      />
      <AppPanel density="compact" className="mx-auto w-full max-w-2xl">
        <div
          className="flex flex-col items-center gap-5 py-8 text-center"
          aria-busy={!successful && !failed && !timedOut && !resumeRecovery}
        >
          {successful ? <CheckCircle2 className="h-12 w-12 text-[color:var(--ui-tone-success-emphasis)]" /> : failed ? <AlertCircle className="h-12 w-12 text-[color:var(--ui-tone-warning-emphasis)]" /> : timedOut || resumeRecovery ? <Clock3 className="h-12 w-12 text-[color:var(--ui-tone-warning-emphasis)]" /> : <Loader2 className="h-12 w-12 animate-spin text-[color:var(--ui-accent)]" />}
          <div className="space-y-2" role="status" aria-live="polite" aria-atomic="true">
            <h2 className="text-xl font-bold text-[color:var(--ui-text)]">{t.owned(content.title)}</h2>
            <p className="max-w-lg text-sm text-[color:var(--ui-text-muted)]">{sourceReview ? t.owned(content.body) : t.error(content.body)}</p>
          </div>
          {error && <p className="text-sm text-[color:var(--ui-tone-danger-text)]" role="alert"><LocalizedError error={error} /></p>}
          <div className="flex flex-wrap justify-center gap-3">
            {(resumeRecovery || (failed && operation.canResumePaymentRecovery === undefined)) && (
              <AppButton
                density="compact"
                icon={RotateCcw}
                isLoading={retrying}
                disabled={waitingForCheckout}
                onClick={retry}
              >
                {resumeRecovery ? t("Resume payment recovery") : sourceReview ? t.owned("Check cancellation status") : waitingForCheckout ? t("Loading secure checkout...") : t("Retry safely")}
              </AppButton>
            )}
            {(successful || failed || timedOut) && (
              <Link className={appActionClassName("secondary")} href={returnPath}>
                {t("Continue")}</Link>
            )}
          </div>
        </div>
      </AppPanel>
    </RecordListPage>
  );
}
