-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'FEE_COLLECTED';
ALTER TYPE "AuditAction" ADD VALUE 'FEE_COLLECTION_VOIDED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "collectedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ledgerBacked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waivedAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FeeCollection" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "FeeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCollectionAllocation" (
    "collectionId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "FeeCollectionAllocation_pkey" PRIMARY KEY ("collectionId","paymentId")
);

-- CreateIndex
CREATE INDEX "FeeCollection_branchId_collectedAt_id_idx" ON "FeeCollection"("branchId", "collectedAt", "id");

-- CreateIndex
CREATE INDEX "FeeCollection_studentId_branchId_collectedAt_idx" ON "FeeCollection"("studentId", "branchId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCollection_branchId_idempotencyKey_key" ON "FeeCollection"("branchId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCollection_branchId_receiptNumber_key" ON "FeeCollection"("branchId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCollection_id_studentId_branchId_key" ON "FeeCollection"("id", "studentId", "branchId");

-- CreateIndex
CREATE INDEX "FeeCollectionAllocation_paymentId_branchId_idx" ON "FeeCollectionAllocation"("paymentId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_studentId_branchId_key" ON "Payment"("id", "studentId", "branchId");

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollectionAllocation" ADD CONSTRAINT "FeeCollectionAllocation_collectionId_studentId_branchId_fkey" FOREIGN KEY ("collectionId", "studentId", "branchId") REFERENCES "FeeCollection"("id", "studentId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCollectionAllocation" ADD CONSTRAINT "FeeCollectionAllocation_paymentId_studentId_branchId_fkey" FOREIGN KEY ("paymentId", "studentId", "branchId") REFERENCES "Payment"("id", "studentId", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No historical payment/status/date backfill. Existing rows retain their meaning.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collection_balance_check" CHECK (
    "collectedAmount" >= 0 AND "waivedAmount" >= 0 AND
    (NOT "ledgerBacked" OR "collectedAmount"::bigint + "waivedAmount" <= "amount")
);
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "FeeCollectionAllocation" ADD CONSTRAINT "FeeCollectionAllocation_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "FeeCollection" ADD CONSTRAINT "FeeCollection_void_evidence" CHECK (
    ("voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL) OR
    ("voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND "voidReason" IS NOT NULL AND length(trim("voidReason")) > 0)
);

CREATE FUNCTION preserve_fee_collection_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Collection evidence cannot be deleted'; END IF;
    IF (to_jsonb(NEW) - ARRAY['voidedAt','voidedById','voidReason']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['voidedAt','voidedById','voidReason']) OR
       (OLD."voidedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
        RAISE EXCEPTION 'Collection evidence is immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER "FeeCollection_immutable" BEFORE UPDATE OR DELETE ON "FeeCollection"
    FOR EACH ROW EXECUTE FUNCTION preserve_fee_collection_evidence();

CREATE FUNCTION preserve_fee_allocation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Collection allocations are immutable'; END $$;
CREATE TRIGGER "FeeCollectionAllocation_immutable" BEFORE UPDATE OR DELETE ON "FeeCollectionAllocation"
    FOR EACH ROW EXECUTE FUNCTION preserve_fee_allocation_evidence();

-- Deferred validation sees the complete collection, including allocations and a void.
CREATE FUNCTION check_fee_collection_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fee_id text; collection_id text; p "Payment"%ROWTYPE; expected bigint; receipt_row "FeeCollection"%ROWTYPE;
BEGIN
    IF TG_TABLE_NAME = 'Payment' THEN
        fee_id := NEW."id";
    ELSIF TG_TABLE_NAME = 'FeeCollectionAllocation' THEN
        fee_id := NEW."paymentId"; collection_id := NEW."collectionId";
    ELSE
        collection_id := NEW."id";
    END IF;
    IF fee_id IS NOT NULL THEN
        SELECT * INTO p FROM "Payment" WHERE "id" = fee_id;
        IF p."ledgerBacked" THEN
            SELECT coalesce(sum(a."amount"),0) INTO expected FROM "FeeCollectionAllocation" a
                JOIN "FeeCollection" c ON c."id" = a."collectionId"
                WHERE a."paymentId" = fee_id AND c."voidedAt" IS NULL;
            IF p."collectedAmount" <> expected THEN RAISE EXCEPTION 'Collection balance does not match allocations'; END IF;
            IF (p."amount" > p."collectedAmount" + p."waivedAmount" AND p."status" <> 'DUE') OR
               (p."amount" = p."collectedAmount" + p."waivedAmount" AND p."status" = 'DUE') THEN
                RAISE EXCEPTION 'Fee status does not match remaining balance';
            END IF;
        END IF;
    END IF;
    IF collection_id IS NOT NULL THEN
        SELECT * INTO receipt_row FROM "FeeCollection" WHERE "id" = collection_id;
        SELECT coalesce(sum("amount"),0) INTO expected FROM "FeeCollectionAllocation" WHERE "collectionId" = collection_id;
        IF receipt_row."amount" <> expected THEN RAISE EXCEPTION 'Collection amount does not match allocations'; END IF;
    END IF;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Payment_ledger_consistent" AFTER INSERT OR UPDATE ON "Payment"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_fee_collection_ledger();
CREATE CONSTRAINT TRIGGER "FeeCollection_ledger_consistent" AFTER INSERT OR UPDATE ON "FeeCollection"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_fee_collection_ledger();
CREATE CONSTRAINT TRIGGER "FeeCollectionAllocation_ledger_consistent" AFTER INSERT ON "FeeCollectionAllocation"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_fee_collection_ledger();
