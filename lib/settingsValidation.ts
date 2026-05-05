const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid settings payload");
    }
}

export function assertKnownFields(body: Record<string, unknown>, allowed: readonly string[]) {
    const allowedSet = new Set(allowed);
    const unknown = Object.keys(body).filter(key => !allowedSet.has(key));
    if (unknown.length > 0) {
        throw new Error(`Unknown settings field: ${unknown[0]}`);
    }
}

export function optionalText(
    value: unknown,
    label: string,
    options: { required?: boolean; max?: number } = {}
): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) {
        if (options.required) throw new Error(`${label} is required`);
        return null;
    }
    if (typeof value !== "string") throw new Error(`${label} must be text`);

    const trimmed = value.trim();
    if (!trimmed) {
        if (options.required) throw new Error(`${label} is required`);
        return null;
    }
    if (options.max && trimmed.length > options.max) {
        throw new Error(`${label} must be ${options.max} characters or fewer`);
    }
    return trimmed;
}

export function optionalEmail(value: unknown, label: string): string | null | undefined {
    const text = optionalText(value, label, { max: 160 });
    if (text && !EMAIL_PATTERN.test(text)) throw new Error(`${label} must be a valid email`);
    return text;
}

export function optionalTime(value: unknown, label: string): string | null | undefined {
    const text = optionalText(value, label, { max: 5 });
    if (text && !TIME_PATTERN.test(text)) throw new Error(`${label} must use HH:mm format`);
    return text;
}

export function optionalNumber(
    value: unknown,
    label: string,
    options: { min?: number; max?: number } = {}
): number | undefined {
    if (value === undefined) return undefined;
    if (value === null) return undefined;
    if (typeof value !== "number" && typeof value !== "string") {
        throw new Error(`${label} must be a whole number`);
    }

    const raw = typeof value === "number" ? String(value) : value.trim();
    if (!raw) return undefined;
    if (!/^-?\d+$/.test(raw)) throw new Error(`${label} must be a whole number`);

    const number = Number(raw);
    if (!Number.isInteger(number)) throw new Error(`${label} must be a whole number`);
    if (options.min !== undefined && number < options.min) throw new Error(`${label} must be at least ${options.min}`);
    if (options.max !== undefined && number > options.max) throw new Error(`${label} must be ${options.max} or less`);
    return number;
}

export function optionalBoolean(value: unknown, label: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") throw new Error(`${label} must be true or false`);
    return value;
}

export function optionalChoice<T extends readonly (string | number)[]>(
    value: unknown,
    label: string,
    choices: T
): T[number] | undefined {
    if (value === undefined) return undefined;
    if (!choices.includes(value as T[number])) {
        throw new Error(`${label} is not supported`);
    }
    return value as T[number];
}
