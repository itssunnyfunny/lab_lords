import type { ImportBranchContext, ImportMappingState, ImportNormalizedRow } from "../contracts/import-session.contract";
import { unresolvedShift } from "./import-guidance";

/** Provider-visible relationships contain generated aliases only, never labels,
 * record IDs, amounts, times or uploaded values. Equivalence is computed locally. */
export type GuidedShiftAIContext = {
    groups: Array<{ sourceAlias: string; meaningAlias: string; affectedRecords: number }>;
    choices: Array<{ choiceAlias: string; kind: "SHIFT" | "BUNDLE" }>;
    answers: Array<{ answerAlias: string; meaningAlias: string; choiceAlias: string }>;
};
export type GuidedShiftProposal = { sourceAlias: string; choiceAlias: string; answerAlias: string };
type Choice = { id: string; name: string; kind: "SHIFT" | "BUNDLE"; componentShiftNames?: string[] };
type Row = { id: string; status: string; skipped: boolean; normalizedData: unknown };
function meaning(value: string) {
    return value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/[\s.\-_]+/g, "");
}

export function buildGuidedShiftAssistance(rows: Row[], branch: ImportBranchContext, answers: NonNullable<ImportMappingState["guidance"]>["answers"]) {
    const choices = new Map<string, Choice>([
        ...branch.shifts.map(choice => ({ ...choice, kind: "SHIFT" as const })),
        ...branch.multiShifts.map(choice => ({ ...choice, kind: "BUNDLE" as const })),
    ].slice(0, 200).map((choice, index) => [`choice_${index + 1}`, choice]));
    const meanings = new Map<string, string>();
    const aliasFor = (value: string) => {
        const key = meaning(value);
        if (!meanings.has(key)) meanings.set(key, `meaning_${meanings.size + 1}`);
        return meanings.get(key)!;
    };
    const context: GuidedShiftAIContext = { groups: [], choices: [...choices].map(([choiceAlias, choice]) => ({ choiceAlias, kind: choice.kind })), answers: [] };
    for (const answer of answers.slice(-20)) {
        if (answer.field !== "allocation.shiftName" || !meaning(answer.source)) continue;
        const matches = [...choices].filter(([, choice]) => choice.name === answer.target);
        if (matches.length !== 1) continue;
        context.answers.push({ answerAlias: `answer_${context.answers.length + 1}`, meaningAlias: aliasFor(answer.source), choiceAlias: matches[0][0] });
    }
    const sources = new Map<string, string>();
    const grouped = new Map<string, { source: string; count: number }>();
    for (const row of rows) {
        if (row.status === "FAILED") continue;
        const source = unresolvedShift(row, branch);
        if (!source || !meaning(source)) continue;
        const key = source.toLocaleLowerCase("en-IN");
        const group = grouped.get(key);
        if (group) group.count++; else grouped.set(key, { source, count: 1 });
    }
    for (const group of [...grouped.values()].slice(0, 30)) {
        const sourceAlias = `source_${sources.size + 1}`;
        sources.set(sourceAlias, group.source);
        context.groups.push({ sourceAlias, meaningAlias: aliasFor(group.source), affectedRecords: group.count });
    }
    return { context, sources, choices };
}

/** A model can only reuse a single, uncontradicted owner-confirmed meaning.
 * Unknown aliases, arbitrary branch choices and conflicting answers are rejected. */
export function validGuidedShiftProposals(value: unknown, context?: GuidedShiftAIContext): GuidedShiftProposal[] {
    if (!context || !Array.isArray(value)) return [];
    const proposals = new Map<string, GuidedShiftProposal>();
    for (const item of value.slice(0, 30)) {
        if (!item || typeof item !== "object") continue;
        const proposal = item as GuidedShiftProposal;
        const group = context.groups.find(group => group.sourceAlias === proposal.sourceAlias);
        const answer = context.answers.find(answer => answer.answerAlias === proposal.answerAlias);
        if (!group || !answer || answer.meaningAlias !== group.meaningAlias || answer.choiceAlias !== proposal.choiceAlias
            || !context.choices.some(choice => choice.choiceAlias === proposal.choiceAlias)
            || context.answers.some(other => other.meaningAlias === group.meaningAlias && other.choiceAlias !== proposal.choiceAlias)) continue;
        proposals.set(proposal.sourceAlias, { sourceAlias: proposal.sourceAlias, choiceAlias: proposal.choiceAlias, answerAlias: proposal.answerAlias });
    }
    return [...proposals.values()];
}

export function withGuidedShiftChoice(normalized: ImportNormalizedRow, choice: Pick<Choice, "name" | "kind" | "componentShiftNames">) {
    const data = structuredClone(normalized);
    data.allocation = { ...data.allocation };
    delete data.allocation.shiftName; delete data.allocation.multiShiftName;
    delete data.shift; delete data.multiShift;
    if (choice.kind === "BUNDLE") {
        data.allocation.multiShiftName = choice.name;
        data.multiShift = { name: choice.name, componentShiftNames: choice.componentShiftNames };
    } else { data.allocation.shiftName = choice.name; data.shift = { name: choice.name }; }
    return data;
}
