/** Validate before importing the shared Prisma client, which also supports Accelerate. */
export function assertDirectConversionDatabase(databaseUrl?: string, accelerateUrl?: string) {
    const target = databaseUrl && URL.canParse(databaseUrl) ? new URL(databaseUrl) : null;
    if (!target || !["postgresql:", "postgres:"].includes(target.protocol)
        || !target.hostname || target.pathname.length < 2 || accelerateUrl) {
        throw new Error("An explicit direct PostgreSQL database target is required");
    }
}
