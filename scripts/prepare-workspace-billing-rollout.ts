// Keep old operator commands from changing the billing model or creating a trial grant.
console.error("Aggregate billing promotion has been retired. Use the branch initialization procedure in docs/billing/independent-branch-rollout.md.");
process.exitCode = 1;
