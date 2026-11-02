-- Existing grants promised Standard access. Never derive a trial tier from the
-- organization's historical post-trial preference, or change any trial dates.
ALTER TABLE "OwnerTrialGrant"
  ADD COLUMN "trialPlan" "SaasPlan" NOT NULL DEFAULT 'STANDARD';
