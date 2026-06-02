import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";

interface KnownShift {
    name: string;
}

interface KnownMultiShift {
    name: string;
    components?: { shiftName?: string; shift?: { name?: string } }[];
}

function key(value: string | undefined | null) {
    return (value ?? "").trim().toLowerCase();
}

export function promoteKnownMultiShiftAllocation(
    normalized: ImportNormalizedRow,
    context: {
        shiftsByName: ReadonlyMap<string, KnownShift>;
        multiShiftsByName: ReadonlyMap<string, KnownMultiShift>;
    }
): ImportNormalizedRow {
    const shiftName = normalized.allocation?.shiftName ?? normalized.shift?.name;
    const shiftKey = key(shiftName);
    if (!shiftKey || normalized.allocation?.multiShiftName || normalized.multiShift?.name) return normalized;
    if (context.shiftsByName.has(shiftKey)) return normalized;

    const multiShift = context.multiShiftsByName.get(shiftKey);
    if (!multiShift) return normalized;

    const allocation = { ...(normalized.allocation ?? {}) };
    delete allocation.shiftName;
    allocation.multiShiftName = multiShift.name;

    const next: ImportNormalizedRow = {
        ...normalized,
        allocation,
        multiShift: {
            ...normalized.multiShift,
            name: multiShift.name,
            componentShiftNames: multiShift.components
                ?.map(component => component.shiftName ?? component.shift?.name)
                .filter((name): name is string => Boolean(name))
                ?? normalized.multiShift?.componentShiftNames,
        },
    };

    if (key(normalized.shift?.name) === shiftKey) {
        const shiftRemainder = { ...(normalized.shift ?? {}) };
        delete shiftRemainder.name;
        next.shift = Object.keys(shiftRemainder).length > 0 ? shiftRemainder : undefined;
    }

    return next;
}
