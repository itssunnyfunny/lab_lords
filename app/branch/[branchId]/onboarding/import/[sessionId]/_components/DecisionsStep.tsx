
import { useTranslation } from "@/components/settings/LocalizedText";import { CheckCircle2, HelpCircle, Link2Off, Save, ShieldCheck, UserRoundCheck } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { labelImportOption } from "@/importing/utils/import-wizard-view-model";
import { pageInsetSurfaceClass, pageMutedTextClass } from "@/components/ui/pageSurface";
import { importFieldClass, StepNotice } from "./shared";
import type { ImportGoal, ImportQuestion } from "./types";

type DecisionsStepProps = {
    questions: ImportQuestion[];
    goal: ImportGoal;
    questionDrafts: Record<string, string>;
    saving: boolean;
    mutationsDisabled: boolean;
    onDraftChange: (questionId: string, value: string) => void;
    onAnswer: (questionId: string, answer: unknown) => void;
    onDeferAllocations: () => void;
    onStudentsOnly: () => void;
    configurationCreation: {
        seats: boolean;
        shifts: boolean;
        multiShifts: boolean;
        approved: boolean;
    };
    onConfigurationApproval: (approved: boolean) => void;
};

export function DecisionsStep({
    questions,
    goal,
    questionDrafts,
    saving,
    mutationsDisabled,
    onDraftChange,
    onAnswer,
    onDeferAllocations,
    onStudentsOnly,
    configurationCreation,
    onConfigurationApproval,
}: DecisionsStepProps) {
    const t = useTranslation();
    const openQuestions = questions.filter(question => question.status === "OPEN");
    const answeredQuestions = questions.filter(question => question.status !== "OPEN");
    const configurationLabels = [
        configurationCreation.seats ? "missing seats" : null,
        configurationCreation.shifts ? "missing shifts" : null,
        configurationCreation.multiShifts ? "missing shift bundles" : null,
    ].filter((value): value is string => Boolean(value));

    return (
        <div className="space-y-5">
            <AppPanel
                title={t("Decisions")}
                description={t("Answer only the decisions needed for this import. Unclear seat, shift, and payment data can be deferred.")}
                action={goal !== "STUDENTS" ?
                    <AppButton
                        variant="secondary"
                        icon={Link2Off}
                        onClick={onDeferAllocations}
                        disabled={mutationsDisabled}
                        aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                        isLoading={saving}
                    >
                        {t("Defer seat/shift mapping")}</AppButton>
                    : undefined}
            >
                <div className="space-y-4">
                    <StepNotice
                        tone={openQuestions.length > 0 || configurationLabels.length > 0 && !configurationCreation.approved ? "warning" : "success"}
                        title={openQuestions.length > 0 ? `${openQuestions.length} decision${openQuestions.length === 1 ? "" : "s"} open` : configurationLabels.length > 0 && !configurationCreation.approved ? t("Setup creation needs approval") : t("No open decisions")}
                        message={openQuestions.length > 0
                            ? "Answers are saved to this staged import, then validation runs again. No branch records are created until the final preview is confirmed."
                            : configurationLabels.length > 0 && !configurationCreation.approved
                                ? "Review the batch action below. The final plan cannot run until this saved revision is explicitly approved."
                            : "Saved decisions are already applied to the current validation plan."}
                    />

                    {configurationLabels.length > 0 && (
                        <fieldset className={cn("p-4", pageInsetSurfaceClass)}>
                            <legend className="sr-only">{t("Approve creation of missing setup records")}</legend>
                            <label htmlFor="configuration-batch-approval" className="flex cursor-pointer items-start gap-3">
                                <input
                                    id="configuration-batch-approval"
                                    type="checkbox"
                                    checked={configurationCreation.approved}
                                    disabled={mutationsDisabled || saving}
                                    aria-describedby="configuration-batch-description"
                                    onChange={event => onConfigurationApproval(event.target.checked)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-cyan-300"
                                />
                                <span className="min-w-0">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                                        <ShieldCheck className="h-4 w-4 text-cyan-300" />
                                        {t("Approve setup creation for this reviewed batch")}</span>
                                    <span id="configuration-batch-description" className={cn("mt-1 block text-xs leading-5", pageMutedTextClass)}>{t("This import is configured to create {join} when a ready row refers to one that does not exist. Approval is saved with this staged import; later changes still require a new reviewed plan before running.", { join: configurationLabels.join(", ") })}</span>
                                </span>
                            </label>
                        </fieldset>
                    )}

                    {goal !== "STUDENTS" && <div className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", pageInsetSurfaceClass)}>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <UserRoundCheck className="h-4 w-4 text-cyan-300" />
                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                                    {t("Import students now, finish setup later")}</p>
                            </div>
                            <p className={cn("mt-1 text-xs leading-5", pageMutedTextClass)}>
                                {t("Defers seat/shift mapping and skips payments for this import while keeping valid student rows importable.")}</p>
                        </div>
                        <AppButton
                            variant="primary"
                            icon={UserRoundCheck}
                            onClick={onStudentsOnly}
                            disabled={mutationsDisabled}
                            aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                            isLoading={saving}
                        >
                            {t("Use students-only mode")}</AppButton>
                    </div>}

                    <div className="space-y-3">
                        {openQuestions.length === 0 && (
                            <div className={cn("p-4 text-sm", pageInsetSurfaceClass, pageMutedTextClass)}>
                                {t("No open decisions are waiting.")}</div>
                        )}

                        {openQuestions.map(question => (
                            <div key={question.id} className={cn("p-4", pageInsetSurfaceClass)}>
                                <div className="flex items-start gap-3">
                                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-[color:var(--text-primary)]">{question.question}</p>
                                            <Badge variant="warning">{question.status}</Badge>
                                        </div>
                                        {question.field && <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{t("Applies to {replace}", { replace: question.field.replace(/\./g, " ") })}</p>}

                                        {(question.options ?? []).length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {(question.options ?? []).map(option => (
                                                    <AppButton
                                                        key={option}
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => onAnswer(question.id, option)}
                                                        disabled={mutationsDisabled}
                                                        aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                                        isLoading={saving}
                                                    >
                                                        {labelImportOption(option)}
                                                    </AppButton>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                            <input
                                                aria-label={`Custom answer for ${question.question}`}
                                                value={questionDrafts[question.id] ?? ""}
                                                onChange={event => onDraftChange(question.id, event.target.value)}
                                                className={cn("min-w-0 flex-1", importFieldClass)}
                                                placeholder={t("Custom answer")}
                                            />
                                            <AppButton
                                                variant="primary"
                                                size="sm"
                                                icon={Save}
                                                disabled={mutationsDisabled || !questionDrafts[question.id]?.trim()}
                                                aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                                onClick={() => onAnswer(question.id, questionDrafts[question.id])}
                                                isLoading={saving}
                                            >
                                                {t("Answer")}</AppButton>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {answeredQuestions.length > 0 && (
                            <details className={cn("rounded-[8px] border border-[color:var(--ui-form-surface-border)]", pageInsetSurfaceClass)}>
                                <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text-primary)]">{t("Answered decisions ({count})", { count: answeredQuestions.length })}</summary>
                                <div className="mt-3 space-y-3">
                                    {answeredQuestions.map(question => (
                                        <div key={question.id} className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                                            <div className="min-w-0">
                                                <p className="font-medium text-[color:var(--text-primary)]">{question.question}</p>
                                                <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{t("Answered: {value}", { value: typeof question.answer === "string" ? labelImportOption(question.answer) : JSON.stringify(question.answer) })}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            </AppPanel>
        </div>
    );
}
