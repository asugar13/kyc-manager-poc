# Seed data

The eight synthetic cases loaded into every version (Part A: `server/src/seed.ts`; Parts B and B′: `npm run seed -w dataverse`, which reuses the same file).

| Case | Applicant | Status | Why it is in the queue |
|---|---|---|---|
| KYC-1041 | Amelia Hartley | pending | Ordinary case: random QA sample, all checks pass |
| KYC-1042 | Viktor Sokolov | pending | **Flagged**: sanctions fuzzy match, address check failed |
| KYC-1043 | Chidera Nwosu | info_requested | Document expires within 30 days |
| KYC-1044 | Marta Kowalczyk | approved | Selfie match below auto-approve threshold (already decided) |
| KYC-1045 | Daniel Okonkwo-Reyes | escalated | Confirmed PEP (already escalated) |
| KYC-1046 | Sofia Andersson | pending | Third onboarding attempt in 30 days |
| KYC-1047 | Rahul Mehta | pending | Declared income inconsistent with occupation |
| KYC-1048 | Grace O'Sullivan | pending | Large initial deposit, source of funds required |
