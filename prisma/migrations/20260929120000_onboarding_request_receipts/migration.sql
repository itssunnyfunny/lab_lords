-- Additive command receipts; no backfill, request bodies, provider data or expiry.
BEGIN;

CREATE TABLE "OnboardingRequest" (
    "ownerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingRequest_pkey" PRIMARY KEY ("ownerId", "idempotencyKey")
);

CREATE INDEX "OnboardingRequest_organizationId_idx" ON "OnboardingRequest"("organizationId");
CREATE INDEX "OnboardingRequest_branchId_organizationId_idx" ON "OnboardingRequest"("branchId", "organizationId");

-- Result deletion must not erase command identity and make an old retry a new setup.
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_branchId_organizationId_fkey"
    FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
