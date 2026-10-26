import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

/** Retry the complete validated operation after PostgreSQL serialization conflicts. */
export async function runSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try { return await prisma.$transaction(operation, { isolationLevel: "Serializable" }); }
        catch (error) {
            if (attempt === 3 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2034") throw error;
        }
    }
    throw new Error("The operation could not be completed.");
}
