import type { Prisma } from "@/app/generated/prisma/client";
import { runSerializableTransaction } from "@/lib/serializableTransaction";

/** All allocation creation/replacement and shift writes use this protocol.
 * Serializable predicate reads fence concurrent inserts into the source set;
 * retries must repeat validation, never just the final writes.
 * Import execution composes the same work in its own serializable transaction.
 */
export async function runAllocationTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
    return runSerializableTransaction(operation);
}
