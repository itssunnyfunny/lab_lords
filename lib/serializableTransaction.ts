import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

function isTransactionWriteConflict(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) return false;
    if (error.code === "P2034") return true;
    if (error.code !== "P2010" || !("meta" in error)) return false;

    // Prisma's PostgreSQL adapter surfaces raw FOR UPDATE conflicts as P2010.
    const meta = error.meta as { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    const sqlState = meta?.driverAdapterError?.cause?.originalCode ?? meta?.code;
    return sqlState === "40001" || sqlState === "40P01";
}

/** Retry the complete validated operation after PostgreSQL serialization conflicts. */
export async function runSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try { return await prisma.$transaction(operation, { isolationLevel: "Serializable" }); }
        catch (error) {
            if (attempt === 3 || !isTransactionWriteConflict(error)) throw error;
        }
    }
    throw new Error("The operation could not be completed.");
}
