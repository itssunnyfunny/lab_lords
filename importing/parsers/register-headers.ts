const key = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
/** Only move past single-cell title lines to an unmistakable register header.
 * Those lines remain staged records for the owner to explicitly leave out. */
export function registerHeaderIndex(rows: Array<{ cells: string[] }>) {
    for (let index = 0; index < Math.min(rows.length, 20); index++) {
        const cells = rows[index].cells.map(key);
        if (cells.some(cell => /^(?:student |member |full )?name$/.test(cell))
            && cells.filter(cell => /^(?:phone|mobile|joined date|joining date|monthly fee|shift|seat|payment status|paid amount)$/.test(cell)).length >= 2) return index;
        if (cells.filter(Boolean).length > 1) return 0;
    }
    return 0;
}
export function repeatedRegisterHeader(raw: Record<string, unknown>, columns: string[]) {
    const filled = columns.filter(column => String(raw[column] ?? "").trim());
    return filled.length >= 2 && filled.every(column => key(String(raw[column])) === key(column));
}
