import { isOnboardingResult, submitOnboarding, type OnboardingPayload, type OnboardingResult } from "@/lib/api/onboarding";

type StartingPoint = "IMPORT" | "CLEAN";
interface CommandIdentity {
    commandId: string;
    startingPoint: StartingPoint;
}
export interface PendingOnboardingCommand extends CommandIdentity {
    status: "pending";
    body: string;
}
export interface CompletedOnboardingCommand extends CommandIdentity {
    status: "completed";
    result: OnboardingResult;
}
export type OnboardingCommand = PendingOnboardingCommand | CompletedOnboardingCommand;
interface OnboardingLedger {
    version: 1;
    accountId: string;
    pending: PendingOnboardingCommand | null;
    completed: CompletedOnboardingCommand[];
}
export interface OnboardingDraft {
    payload: OnboardingPayload;
    startingPoint: StartingPoint;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storageMessage = "Your saved setup could not be accessed safely. Enable browser storage and retry. Do not clear browser data or start setup in another browser while its result is uncertain.";

export function onboardingStorageKey(accountId: string) {
    return `lab-lords:onboarding:v1:${encodeURIComponent(accountId)}`;
}

function browserStorage() {
    try {
        if (!navigator.locks?.request || !crypto.randomUUID) throw new Error();
        return window.localStorage;
    } catch {
        throw new Error(storageMessage);
    }
}

function isCommand(value: unknown, status: OnboardingCommand["status"]): boolean {
    if (!value || typeof value !== "object") return false;
    const command = value as Partial<CommandIdentity> & { status?: string; body?: unknown; result?: unknown };
    if (command.status !== status || typeof command.commandId !== "string" || !uuidPattern.test(command.commandId)
        || !["IMPORT", "CLEAN"].includes(command.startingPoint ?? "")) return false;
    if (status === "completed") return isOnboardingResult(command.result);
    if (typeof command.body !== "string" || command.body.length > 128_000) return false;
    try {
        const body: unknown = JSON.parse(command.body);
        return !!body && typeof body === "object" && !Array.isArray(body);
    } catch {
        return false;
    }
}

function readLedger(storage: Storage, accountId: string): OnboardingLedger {
    try {
        const raw = storage.getItem(onboardingStorageKey(accountId));
        if (raw === null) return { version: 1, accountId, pending: null, completed: [] };
        const ledger = JSON.parse(raw) as OnboardingLedger;
        if (ledger.version !== 1 || ledger.accountId !== accountId
            || (ledger.pending !== null && !isCommand(ledger.pending, "pending"))
            || !Array.isArray(ledger.completed) || !ledger.completed.every(command => isCommand(command, "completed"))) throw new Error();
        return ledger;
    } catch {
        // A corrupt or unreadable receipt is not proof that no request committed.
        throw new Error(storageMessage);
    }
}

function writeVerified(storage: Storage, ledger: OnboardingLedger) {
    try {
        const key = onboardingStorageKey(ledger.accountId);
        const serialized = JSON.stringify(ledger);
        storage.setItem(key, serialized);
        if (storage.getItem(key) !== serialized) throw new Error();
    } catch {
        throw new Error(storageMessage);
    }
}

export function readOnboardingCommand(accountId: string): OnboardingCommand | null {
    const ledger = readLedger(browserStorage(), accountId);
    return ledger.pending ?? ledger.completed.at(-1) ?? null;
}

export function onboardingDestination(command: CompletedOnboardingCommand) {
    const branchPath = `/branch/${encodeURIComponent(command.result.branch.id)}`;
    return command.startingPoint === "IMPORT" ? `${branchPath}/onboarding/import` : branchPath;
}

export async function runOnboardingCommand({ accountId, draft, newAfterCommandId, isCurrent }: {
    accountId: string;
    draft?: OnboardingDraft;
    // Only an explicit new-setup action after a confirmed result supplies this.
    newAfterCommandId?: string;
    isCurrent: () => boolean;
}): Promise<CompletedOnboardingCommand> {
    const storage = browserStorage();
    // All tabs use one account-scoped slot. The lock covers allocation, durable
    // persistence and bounded dispatch; it never waits for user interaction.
    return navigator.locks.request(onboardingStorageKey(accountId), async () => {
        if (!isCurrent()) throw new Error("Your account changed. Reopen setup for the current account.");
        const ledger = readLedger(storage, accountId);
        const completed = ledger.completed.at(-1);
        if (!ledger.pending && completed && (!draft || newAfterCommandId !== completed.commandId)) return completed;
        if (!ledger.pending) {
            if (!draft) throw new Error("No saved setup is available to recover.");
            const commandId = crypto.randomUUID();
            if (!uuidPattern.test(commandId)) throw new Error(storageMessage);
            ledger.pending = {
                status: "pending", commandId, startingPoint: draft.startingPoint,
                body: JSON.stringify(draft.payload),
            };
            if (!isCommand(ledger.pending, "pending")) throw new Error(storageMessage);
        }
        const pending = ledger.pending;
        writeVerified(storage, ledger);
        if (!isCurrent()) throw new Error("Your account changed. Reopen setup for the current account.");
        const result = await submitOnboarding(accountId, pending.commandId, pending.body);
        const receipt: CompletedOnboardingCommand = {
            status: "completed", commandId: pending.commandId, startingPoint: pending.startingPoint, result,
        };
        // Keep all confirmed IDs, but stop retaining the submitted phone/draft.
        // A failed write leaves the original pending key available for replay.
        writeVerified(storage, { ...ledger, pending: null, completed: [...ledger.completed, receipt] });
        return receipt;
    });
}
